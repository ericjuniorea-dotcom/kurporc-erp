/**
 * Designa al Super Administrador de la plataforma. Idempotente.
 *
 *   SUPERADMIN_EMAIL=correo@dominio npm run db:superadmin
 *
 * 1. Busca la cuenta en Supabase Auth (tiene que haber ingresado al menos una vez,
 *    con Google o con correo).
 * 2. Crea o vincula su perfil en `users`.
 * 3. Le da nivel TOTAL en `admin_plataforma`.
 * 4. Lo suma como Administrador General (no propietario) de las organizaciones
 *    existentes, para que pueda usar el ERP. Con el panel /admin (Fase 11) esto
 *    deja de hacer falta: la lectura de la plataforma no requiere membresía.
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

  await prisma.adminPlataforma.upsert({ where: { userId: user.id }, create: { userId: user.id, nivel: "TOTAL" }, update: { nivel: "TOTAL" } });
  console.log(`  ✓ Super Administrador (nivel TOTAL)`);

  // Roles legados que usa hoy el menú (1 Super Admin, 2 Admin de granja) hasta la Fase 7
  await prisma.userRole.createMany({ data: [{ userId: user.id, roleId: 1 }, { userId: user.id, roleId: 2 }], skipDuplicates: true });

  const orgs = await prisma.tenant.findMany({ where: { tipo: { in: ["EMPRESA", "INDIVIDUAL"] } }, select: { id: true, farmName: true } });
  for (const org of orgs) {
    const rol = await prisma.rol.findFirst({ where: { organizacionId: org.id, codigo: "ADMIN_GENERAL" }, select: { id: true } });
    const existe = await prisma.miembro.findUnique({ where: { organizacionId_userId: { organizacionId: org.id, userId: user.id } } });
    if (!existe) {
      await prisma.miembro.create({
        data: { organizacionId: org.id, userId: user.id, rolId: rol?.id, cargo: "Super Administrador", limiteCompraGs: null },
      });
      console.log(`  ✓ Miembro de ${org.farmName} como Administrador General`);
    }
  }
  if (!user.tenantId && orgs[0]) await prisma.user.update({ where: { id: user.id }, data: { tenantId: orgs[0].id } });
  console.log("Listo.");
}

main()
  .catch(e => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
