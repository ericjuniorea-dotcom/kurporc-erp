/**
 * Fase 3 — Pasa los usuarios existentes (NextAuth) a Supabase Auth.
 * Idempotente: los que ya tienen authUserId se saltean.
 *
 *   npm run db:migrar-auth
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * - Crea el usuario en Supabase Auth con el MISMO hash bcrypt de su contraseña
 *   actual: la persona sigue entrando con la contraseña de siempre.
 * - Correo marcado como confirmado (ya eran usuarios del sistema).
 * - El trigger handle_new_user vincula el perfil (users.authUserId).
 * - Si el correo ya existía en Supabase Auth, se vincula a ese usuario.
 */
import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function buscarPorCorreo(admin: SupabaseClient, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });

  const pendientes = await prisma.user.findMany({
    where: { authUserId: null },
    select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
  });
  console.log(`Usuarios sin cuenta de Supabase Auth: ${pendientes.length}`);

  for (const u of pendientes) {
    const email = u.email.toLowerCase();
    let authId: string | null = null;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: u.name },
      ...(u.passwordHash ? { password_hash: u.passwordHash } : {}),
      ...(u.isActive ? {} : { ban_duration: "876000h" }), // inactivo: no puede entrar
    });

    if (data?.user) {
      authId = data.user.id;
      console.log(`  ✓ ${email}: creado${u.passwordHash ? " (conserva su contraseña)" : " (sin contraseña: entra con Google o recupera)"}`);
    } else if (error && (error.code === "email_exists" || /already/i.test(error.message))) {
      const existente = await buscarPorCorreo(admin, email);
      authId = existente?.id ?? null;
      console.log(`  • ${email}: ya existía en Supabase Auth, se vincula`);
    } else {
      console.error(`  ✗ ${email}: ${error?.code ?? ""} ${error?.message ?? "error desconocido"}`);
      continue;
    }

    if (authId) {
      // El trigger ya lo vincula; esto cubre el caso "ya existía" y lo deja asegurado.
      await prisma.user.updateMany({ where: { id: u.id, authUserId: null }, data: { authUserId: authId } });
    }
  }

  const sinVincular = await prisma.user.count({ where: { authUserId: null } });
  console.log(sinVincular === 0 ? "\nListo: todos los usuarios tienen cuenta de Supabase Auth." : `\nATENCIÓN: ${sinVincular} usuario(s) siguen sin vincular.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
