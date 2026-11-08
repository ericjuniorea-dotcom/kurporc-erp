// Alta de una organización (Fase 6): granja individual, empresa con equipo o tienda.
// Todo en una transacción: organización, granja, unidades de negocio, roles copiados
// de las plantillas, la persona como Administrador General y los datos iniciales que
// el ERP necesita para funcionar.
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { ROLES_PLANTILLA } from "@/lib/permisos/roles-plantilla";

export type TipoAlta = "INDIVIDUAL" | "EMPRESA" | "VENDEDOR";

export interface DatosAlta {
  tipo: TipoAlta;
  nombre: string;              // nombre de la granja, empresa o tienda
  razonSocial?: string | null;
  ruc?: string | null;
  /** El RUC figura activo en el padrón de la DNIT (una tienda queda verificada al crearse). */
  rucVerificado?: boolean;
  rubro?: string | null;
  departamento?: string | null;
  distrito?: string | null;
  whatsapp?: string | null;
  // Granja (INDIVIDUAL / EMPRESA)
  nombreGranja?: string | null;
  madresAprox?: number | null;
  sistemaProductivo?: string | null; // CICLO_COMPLETO | CRIA | ENGORDE | CRIA_RECRIA
  // Tienda (VENDEDOR)
  categoriasVenta?: string[];
  zonasEntrega?: string[];
  claveCreacion: string;       // evita duplicar si se reenvía el formulario
}

const ROLES_ERP = ["ADMIN_GENERAL", "JEFE_PRODUCCION", "VETERINARIO", "ENCARGADO_GESTACION", "ENCARGADO_MATERNIDAD",
  "ENCARGADO_DESTETE_RECRIA", "ENCARGADO_ENGORDE", "LOGISTICA_STOCK", "ADMINISTRACION_FINANZAS", "COMERCIAL",
  "CONTADOR_EXTERNO", "OPERARIO", "SOLO_LECTURA"];
const ROLES_TIENDA = ["VENDEDOR_ADMIN", "VENDEDOR_ATENCION"];

const ETAPAS_ALIMENTACION = [
  { phase: "GESTATION", name: "Alimento gestación", sortOrder: 1 },
  { phase: "LACTATION", name: "Lactancia hembra", sortOrder: 2 },
  { phase: "PRE_STARTER", name: "Pre-starter lechones", sortOrder: 3 },
  { phase: "PHASE_1", name: "Recría Fase 1", sortOrder: 4 },
  { phase: "PHASE_2", name: "Recría Fase 2", sortOrder: 5 },
  { phase: "GROWING", name: "Engorde", sortOrder: 6 },
];

const CONFIG_INICIAL = {
  weaningMaxDays: 28, transferWeightKg: 25, gestationDaysMin: 110, gestationDaysMax: 118,
  farrowingMaxDurationMin: 240, minBirthWeightKg: 1.1,
};

export function codigoDesde(texto: string, max = 30): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^GRANJA-/, "").slice(0, max) || "PRINCIPAL";
}

function slugDesde(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "organizacion";
}

async function slugLibre(tx: Prisma.TransactionClient, base: string): Promise<string> {
  let slug = slugDesde(base);
  if (!(await tx.tenant.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  for (let i = 0; i < 5; i++) {
    const intento = `${slug}-${randomBytes(2).toString("hex")}`;
    if (!(await tx.tenant.findUnique({ where: { slug: intento }, select: { id: true } }))) return intento;
  }
  return `${slug}-${randomBytes(4).toString("hex")}`;
}

export async function crearOrganizacion(userId: string, d: DatosAlta): Promise<{ id: string; creada: boolean }> {
  // Idempotencia: si este mismo formulario ya creó la organización, se devuelve esa
  const previa = await prisma.tenant.findFirst({
    where: { creadoPor: userId, config: { path: ["claveCreacion"], equals: d.claveCreacion } },
    select: { id: true },
  });
  if (previa) return { id: previa.id, creada: false };

  const esTienda = d.tipo === "VENDEDOR";
  const plantillas = ROLES_PLANTILLA.filter(r => (esTienda ? ROLES_TIENDA : ROLES_ERP).includes(r.codigo));

  const id = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.actor_id', ${userId}, true)`;

    const org = await tx.tenant.create({
      data: {
        slug: await slugLibre(tx, d.nombre),
        farmName: d.nombre,
        tipo: d.tipo,
        razonSocial: d.razonSocial || null,
        ruc: d.ruc || null,
        rubro: d.rubro || (esTienda ? "Proveedor" : "Producción porcina"),
        departamento: d.departamento || null,
        distrito: d.distrito || null,
        whatsapp: d.whatsapp || null,
        verificacion: esTienda ? (d.rucVerificado ? "VERIFICADA" : "PENDIENTE") : "NO_APLICA",
        creadoPor: userId,
        config: {
          ...(esTienda ? {} : CONFIG_INICIAL),
          claveCreacion: d.claveCreacion,
          ...(d.madresAprox ? { madresAprox: d.madresAprox } : {}),
          ...(d.sistemaProductivo ? { sistemaProductivo: d.sistemaProductivo } : {}),
          ...(esTienda ? { categoriasVenta: d.categoriasVenta ?? [], zonasEntrega: d.zonasEntrega ?? [] } : {}),
        },
      },
    });

    // Roles de la organización (copia editable de las plantillas)
    const rolesOrg = new Map<string, string>();
    for (const r of plantillas) {
      const rol = await tx.rol.create({
        data: {
          organizacionId: org.id, codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion, esSistema: true,
          permisos: { createMany: { data: r.permisos.map(permisoClave => ({ permisoClave })) } },
        },
      });
      rolesOrg.set(r.codigo, rol.id);
    }

    await tx.miembro.create({
      data: {
        organizacionId: org.id, userId, esPropietario: true, limiteCompraGs: null,
        rolId: rolesOrg.get(esTienda ? "VENDEDOR_ADMIN" : "ADMIN_GENERAL"),
        cargo: esTienda ? "Administrador de la tienda" : "Administrador General",
      },
    });

    await tx.unidadNegocio.create({ data: { organizacionId: org.id, codigo: "COMUN", nombre: "Común", tipo: "COMUN" } });

    if (!esTienda) {
      const nombreGranja = d.nombreGranja || d.nombre;
      const granja = await tx.granja.create({
        data: { organizacionId: org.id, codigo: codigoDesde(nombreGranja), nombre: nombreGranja, departamento: d.departamento || null, distrito: d.distrito || null },
      });
      await tx.unidadNegocio.create({
        data: { organizacionId: org.id, codigo: `GRANJA-${granja.codigo}`, nombre: nombreGranja, tipo: "GRANJA", granjaId: granja.id },
      });
      // Datos que el ERP necesita desde el primer día
      await tx.healthProtocolConfig.create({
        data: {
          tenantId: org.id, tailDockingEnabled: true, tailDockingDayOfLife: 1, toothClippingEnabled: true,
          toothClippingDayOfLife: 1, castrationEnabled: true, castrationDayOfLife: 7,
          ironInjectionEnabled: true, ironDayOfLife: 3, ironDoseMl: 1.0,
        },
      });
      await tx.feedType.createMany({ data: ETAPAS_ALIMENTACION.map(e => ({ tenantId: org.id, ...e })) });
      // Roles legados que todavía usa el menú (hasta la Fase 7): Admin de granja
      await tx.userRole.createMany({ data: [{ userId, roleId: 2 }], skipDuplicates: true });
    }

    const tipoRegistro = d.tipo;
    const u = await tx.user.findUnique({ where: { id: userId }, select: { tenantId: true, tipoRegistro: true } });
    await tx.user.update({
      where: { id: userId },
      data: {
        onboardingCompleto: true,
        ...(u?.tenantId ? {} : { tenantId: org.id }),
        ...(u?.tipoRegistro === "COMPRADOR" ? { tipoRegistro } : {}),
      },
    });
    return org.id;
  });

  return { id, creada: true };
}
