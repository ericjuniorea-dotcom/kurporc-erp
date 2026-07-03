import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = [
  { id: 1,  name: "super_admin",        nameEs: "Super Admin",                        level: 1, description: "Acceso total a todas las granjas. Gestión de tenants y suscripciones." },
  { id: 2,  name: "farm_admin",         nameEs: "Admin de granja",                    level: 1, description: "Acceso completo a su granja. Gestión de usuarios y roles. Módulo financiero completo." },
  { id: 3,  name: "general_manager",    nameEs: "Gerente general",                    level: 2, description: "Todos los módulos de producción. Reportes y KPIs. Solo lectura en financiero." },
  { id: 4,  name: "vet_chief",          nameEs: "Veterinario Jefe de Producción",     level: 2, description: "ÚNICO ROL que aprueba cambios de fórmula de balanceado. Producción porcina completa. Protocolos sanitarios." },
  { id: 5,  name: "production_chief",   nameEs: "Jefe de producción porcina",         level: 3, description: "Gestión de todas las fases productivas. Aprueba ajustes de stock de operarios." },
  { id: 6,  name: "bal_manager",        nameEs: "Encargado de balanceado",            level: 3, description: "Producción diaria. Stock materias primas. Solo lectura en fórmulas." },
  { id: 7,  name: "logistics_manager",  nameEs: "Encargado de logística",             level: 3, description: "Órdenes de compra. GRN. Traslados. Proyecciones 60 días." },
  { id: 8,  name: "hr_chief",           nameEs: "Jefe de RRHH",                       level: 3, description: "Módulo RRHH completo. Liquidaciones. IPS. SET Paraguay." },
  { id: 9,  name: "accountant",         nameEs: "Contador",                           level: 3, description: "Módulo financiero/administrativo completo. Solo lectura en producción." },
  { id: 10, name: "maternity_manager",  nameEs: "Encargado de maternidad",            level: 3, description: "Todos los eventos de maternidad. Alimentación de su sector. Solicita ajustes de stock." },
  { id: 11, name: "gestation_manager",  nameEs: "Encargado de gestación",             level: 3, description: "Todos los eventos de gestación. Mapa de servicios. Alimentación de su sector." },
  { id: 12, name: "nursery_manager",    nameEs: "Encargado de recría",                level: 3, description: "Recría F1, F2 y engorde. Pesajes y cambios de fase." },
  { id: 13, name: "field_operator",     nameEs: "Operario de campo",                  level: 4, description: "Registro de eventos de su sector. Alimentación diaria. Protocolo sanitario. Solicita ajustes de stock. Acceso al bot de WhatsApp." },
  { id: 14, name: "employee_portal",    nameEs: "Empleado — portal autoservicio",     level: 4, description: "Solo sus datos: recibos de sueldo, liquidaciones IPS, días trabajados." },
];

async function main() {
  console.log("Seeding KurPorc ERP database...");

  // 1. Crear los 14 roles del sistema
  for (const role of ROLES) {
    await prisma.role.upsert({
      where:  { id: role.id },
      update: { name: role.name, nameEs: role.nameEs, level: role.level, description: role.description },
      create: role,
    });
  }
  console.log("✓ 14 roles creados");

  // 2. Tenant demo para desarrollo
  const demoSlug = "demo-granja";
  let tenant = await prisma.tenant.findUnique({ where: { slug: demoSlug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug:     demoSlug,
        farmName: "Granja Demo KurPorc",
        plan:     "PRO",
        config: {
          weaningMaxDays:         28,
          transferWeightKg:       25,
          gestationDaysMin:       110,
          gestationDaysMax:       118,
          farrowingMaxDurationMin: 240,
          minBirthWeightKg:       1.10,
        },
      },
    });
    console.log(`✓ Tenant demo creado: ${tenant.slug}`);
  }

  // 3. Usuario Super Admin
  const superAdminEmail = "admin@kurporc.com";
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const passwordHash = await bcrypt.hash("KurPorc2026!", 12);
    await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        email:        superAdminEmail,
        name:         "Super Admin",
        passwordHash,
        userRoles: {
          create: [
            { roleId: 1 }, // Super Admin
            { roleId: 2 }, // Farm Admin
          ],
        },
      },
    });
    console.log(`✓ Super Admin creado: ${superAdminEmail} / KurPorc2026!`);
  }

  // 4. Usuario Veterinario Jefe (único que aprueba fórmulas)
  const vetEmail = "veterinario@demo-granja.com";
  const existingVet = await prisma.user.findUnique({ where: { email: vetEmail } });

  if (!existingVet) {
    const passwordHash = await bcrypt.hash("Vet2026!", 12);
    await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        email:        vetEmail,
        name:         "Dr. Alejandro Riquelme",
        passwordHash,
        userRoles: {
          create: [
            { roleId: 4 }, // Veterinario Jefe de Producción
          ],
        },
      },
    });
    console.log(`✓ Veterinario Jefe creado: ${vetEmail} / Vet2026!`);
  }

  // 5. Operario de campo (acceso WhatsApp)
  const operarioEmail = "operario@demo-granja.com";
  const existingOperario = await prisma.user.findUnique({ where: { email: operarioEmail } });

  if (!existingOperario) {
    const passwordHash = await bcrypt.hash("Operario2026!", 12);
    await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        email:        operarioEmail,
        name:         "Juan Benítez",
        phone:        "+595981234567",
        passwordHash,
        userRoles: {
          create: [{ roleId: 13 }], // Operario de campo
        },
      },
    });
    console.log(`✓ Operario creado: ${operarioEmail} / Operario2026!`);
  }

  // 6. Configuración sanitaria por defecto para el tenant demo
  await prisma.healthProtocolConfig.upsert({
    where:  { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:              tenant.id,
      tailDockingEnabled:    true,
      tailDockingDayOfLife:  1,
      toothClippingEnabled:  true,
      toothClippingDayOfLife: 1,
      castrationEnabled:     true,
      castrationDayOfLife:   7,
      ironInjectionEnabled:  true,
      ironDayOfLife:         3,
      ironDoseMl:            1.0,
    },
  });
  console.log("✓ Protocolo sanitario por defecto configurado");

  // 7. Tipos de alimento por defecto
  const feedPhases = [
    { phase: "GESTATION",   name: "Alimento gestación",     sortOrder: 1 },
    { phase: "LACTATION",   name: "Lactancia hembra",        sortOrder: 2 },
    { phase: "PRE_STARTER", name: "Pre-starter lechones",    sortOrder: 3 },
    { phase: "PHASE_1",     name: "Recría Fase 1",           sortOrder: 4 },
    { phase: "PHASE_2",     name: "Recría Fase 2",           sortOrder: 5 },
    { phase: "GROWING",     name: "Engorde",                 sortOrder: 6 },
  ];

  for (const ft of feedPhases) {
    await prisma.feedType.upsert({
      where:  { tenantId_phase: { tenantId: tenant.id, phase: ft.phase } },
      update: {},
      create: { tenantId: tenant.id, ...ft },
    });
  }
  console.log("✓ 6 tipos de alimento creados");

  // 8. Sector demo: Maternidad
  const existingLocation = await prisma.farmLocation.findFirst({
    where: { tenantId: tenant.id, name: "Sala Maternidad" },
  });

  if (!existingLocation) {
    const location = await prisma.farmLocation.create({
      data: {
        tenantId:     tenant.id,
        name:         "Sala Maternidad",
        locationType: "MATERNITY",
      },
    });

    // 12 corrales de maternidad
    for (let i = 1; i <= 12; i++) {
      await prisma.pen.create({
        data: {
          tenantId:   tenant.id,
          locationId: location.id,
          number:     String(i),
          capacity:   1,
        },
      });
    }
    console.log("✓ Sala Maternidad con 12 corrales creada");
  }

  console.log("\n✅ Seed completado exitosamente");
  console.log("───────────────────────────────────────");
  console.log("  Credenciales de acceso:");
  console.log("  Super Admin: admin@kurporc.com / KurPorc2026!");
  console.log("  Veterinario: veterinario@demo-granja.com / Vet2026!");
  console.log("  Operario:    operario@demo-granja.com / Operario2026!");
  console.log("───────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
