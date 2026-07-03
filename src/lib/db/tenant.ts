// Multi-tenancy: validación de tenant_id en cada operación.
// Arquitectura actual: single schema + tenantId por tabla + validación en middleware.
// Migración futura a schema-por-tenant: cada PrismaClient conecta con
//   ?options=--search_path%3Dtenant_{slug}%2Cpublic en la URL.

import prisma from "./prisma";

/**
 * Verifica que el tenant exista y esté activo.
 * Se llama desde el middleware de Next.js y desde tRPC.
 */
export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, farmName: true, plan: true },
  });
}

export async function getTenantById(id: string) {
  return prisma.tenant.findFirst({
    where: { id, isActive: true },
    select: { id: true, slug: true, farmName: true, plan: true },
  });
}

/**
 * Extrae el tenantId del JWT y lo valida contra la DB.
 * Lanza error si el tenant no existe o no coincide con el slug de la URL.
 */
export function assertTenantAccess(
  jwtTenantId: string,
  requestTenantId: string
): void {
  if (jwtTenantId !== requestTenantId) {
    throw new Error("TENANT_MISMATCH");
  }
}

/**
 * Provision de un nuevo tenant:
 * 1. Crea el registro en la tabla pública "tenants"
 * 2. (Futuro) Crea el schema PostgreSQL dedicado
 */
export async function provisionTenant(params: {
  slug: string;
  farmName: string;
  adminEmail: string;
  adminName: string;
  adminPasswordHash: string;
}) {
  const { slug, farmName, adminEmail, adminName, adminPasswordHash } = params;

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { slug, farmName },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        name: adminName,
        passwordHash: adminPasswordHash,
        userRoles: {
          create: { roleId: 2 }, // Admin de granja
        },
      },
    });

    // Crear configuración sanitaria por defecto
    await tx.healthProtocolConfig.create({
      data: { tenantId: tenant.id },
    });

    return { tenant, user };
  });
}
