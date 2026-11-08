/**
 * Designa al Super Administrador de la plataforma. Idempotente.
 *
 *   SUPERADMIN_EMAIL=correo@dominio AUTORIZA_EMAIL=correo-de-un-admin-TOTAL npm run db:superadmin
 *
 * Nadie se vuelve Super Administrador sin la autorización de uno TOTAL existente: la base lo
 * exige (trigger controlar_admin_plataforma) y deja registrado quién lo autorizó.
 * Lo normal es hacerlo desde /admin/administradores; este script queda para emergencias.
 *
 * 1. Busca la cuenta en Supabase Auth (tiene que haber ingresado al menos una vez,
 *    con Google o con correo).
 * 2. Crea o vincula su perfil en `users`.
 * 3. Le da nivel TOTAL en `admin_plataforma`.
 * Ya no lo suma como miembro de las organizaciones: el panel /admin lee sin membresía (Fase 11).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? "").split(",")[0].trim().toLowerCase();
  if (!email) throw new Error("Falta SUPERADMIN_EMAIL");

  const auth = await prisma.$queryRaw<{ id: string; nombre: string | null; foto: string | null }[]>`
    select id::text as id,
           coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name') as nombre,
           raw_user_meta_data->>'avatar_url' as foto
    from auth.users where lower(email) = ${email} limit 1`;
  if (!auth[0]) throw new Error(`${email} no tiene cuenta en Supabase Auth: que ingrese una vez y volvé a correr esto`);
  const { id: authId, nombre, foto } = auth[0];

  // Perfil: por authUserId, si no por correo (vincula), si no se crea con id = auth id
  let user = await prisma.user.findFirst({ where: { OR: [{ authUserId: authId }, { email }] } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: authId, authUserId: authId, email, name: nombre ?? email.split("@")[0], avatarUrl: foto,
        proveedorLogin: "google", tipoRegistro: "EMPRESA", onboardingCompleto: true,
      },
    });
    console.log(`  ✓ Perfil creado para ${email}`);
  } else if (!user.authUserId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { authUserId: authId } });
    console.log(`  ✓ Perfil existente vinculado a su cuenta de Supabase`);
  }
  await prisma.user.update({ where: { id: user.id }, data: { onboardingCompleto: true, isActive: true } });

  const autoriza = (process.env.AUTORIZA_EMAIL ?? "").trim().toLowerCase();
  const actor = autoriza ? await prisma.user.findFirst({ where: { email: autoriza, adminPlataforma: { nivel: "TOTAL" } }, select: { id: true } }) : null;
  if (!actor) throw new Error("Falta AUTORIZA_EMAIL: el correo de un Super Administrador TOTAL que autoriza el alta");
  await prisma.$transaction([
    prisma.$executeRaw`select set_config('app.actor_id', ${actor.id}, true)`,
    prisma.adminPlataforma.upsert({ where: { userId: user.id }, create: { userId: user.id, nivel: "TOTAL" }, update: { nivel: "TOTAL" } }),
  ]);
  console.log(`  ✓ Super Administrador (nivel TOTAL), autorizado por ${autoriza}`);

  console.log("Listo.");
}

main()
  .catch(e => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
