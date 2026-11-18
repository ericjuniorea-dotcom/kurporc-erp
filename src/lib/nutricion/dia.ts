// Sanidad y Nutrición · datos de la carga diaria: animales de cada módulo, balanceados con su stock y costo,
// consumo teórico y lo que ya se cargó ese día (con quién lo cargó y cuánto costó).
import "server-only";
import prisma from "@/lib/db/prisma";
import { idsCamadasAbiertas, SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";
import { stockCamada } from "@/lib/auditoria/granja";
import { esModuloNutricion, type ModuloNutricion } from "./plan";

const DIA = 86_400_000;
export const fechaDia = (s: string) => new Date(`${s}T00:00:00Z`);

export type TipoBalanceado = { id: string; nombre: string; modulo: ModuloNutricion; kgPorAnimal: number | null; productoId: string | null; stockKg: number; costoKg: number | null };
export type Registro = { id: string; feedTypeId: string; farrowingId: string | null; kg: number; costoGs: number; quien: string | null; usuarioId: string | null; hora: string };

export async function datosNutricionDia(tenantId: string, fecha: string) {
  const desde = fechaDia(fecha), hasta = new Date(desde.getTime() + DIA);
  const abiertas = await idsCamadasAbiertas(tenantId);
  const [tipos, camadas, hembrasActivas, iniciacion, engorde, registros] = await Promise.all([
    prisma.feedType.findMany({ where: { tenantId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, modulo: true, kgPorAnimalDia: true, productoBalanceadoId: true } }),
    prisma.farrowingEvent.findMany({ where: { id: { in: abiertas } }, orderBy: { startDatetime: "asc" },
      select: { id: true, startDatetime: true, sow: { select: { id: true, identCode: true, caravanaCode: true } }, ...SELECT_STOCK_CAMADA } }),
    prisma.sow.count({ where: { tenantId, isActive: true } }),
    prisma.nurseryBatch.aggregate({ where: { tenantId, isActive: true }, _sum: { currentCount: true }, _count: { _all: true } }),
    prisma.growingBatch.aggregate({ where: { tenantId, status: "ACTIVE" }, _sum: { currentCount: true }, _count: { _all: true } }),
    prisma.feedRecord.findMany({ where: { tenantId, recordDate: { gte: desde, lt: hasta } }, orderBy: { createdAt: "asc" }, select: { id: true, feedTypeId: true, farrowingId: true, quantityKg: true, employeeId: true, createdAt: true } }),
  ]);

  // Stock y costo promedio de cada balanceado (lotes sin vencer)
  const productos = Array.from(new Set(tipos.map(t => t.productoBalanceadoId).filter((x): x is string => !!x)));
  const lotes = productos.length ? await prisma.loteInventario.findMany({
    where: { tenantId, vacunaId: { in: productos }, cantidadActual: { gt: 0 }, fechaVencimiento: { gte: new Date() } },
    select: { vacunaId: true, cantidadActual: true, costoUnitario: true },
  }) : [];
  const stock = new Map<string, { kg: number; valor: number; conCosto: number }>();
  for (const l of lotes) {
    const s = stock.get(l.vacunaId) ?? { kg: 0, valor: 0, conCosto: 0 };
    s.kg += Number(l.cantidadActual);
    if (l.costoUnitario) { s.valor += Number(l.cantidadActual) * Number(l.costoUnitario); s.conCosto += Number(l.cantidadActual); }
    stock.set(l.vacunaId, s);
  }

  // Costo de cada registro: lo que salió del stock por ese registro × el precio del lote
  const movs = registros.length ? await prisma.movimientoInventario.findMany({
    where: { tenantId, referenciaId: { in: registros.map(r => r.id) }, origen: "ALIMENTACION" },
    select: { referenciaId: true, tipo: true, cantidad: true, lote: { select: { costoUnitario: true } } },
  }) : [];
  const costo = new Map<string, number>();
  for (const m of movs) {
    const v = Math.abs(Number(m.cantidad)) * Number(m.lote?.costoUnitario ?? 0) * (m.tipo === "SALIDA" ? 1 : -1);
    costo.set(m.referenciaId!, (costo.get(m.referenciaId!) ?? 0) + v);
  }
  const quienes = Array.from(new Set(registros.map(r => r.employeeId).filter((x): x is string => !!x)));
  const nombre = new Map((await prisma.user.findMany({ where: { id: { in: quienes } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));

  const listaTipos: TipoBalanceado[] = tipos.filter(t => esModuloNutricion(t.modulo)).map(t => {
    const s = t.productoBalanceadoId ? stock.get(t.productoBalanceadoId) : undefined;
    return { id: t.id, nombre: t.name, modulo: t.modulo as ModuloNutricion, kgPorAnimal: t.kgPorAnimalDia ? Number(t.kgPorAnimalDia) : null,
      productoId: t.productoBalanceadoId, stockKg: s?.kg ?? 0, costoKg: s && s.conCosto > 0 ? s.valor / s.conCosto : null };
  });
  const listaRegistros: Registro[] = registros.map(r => ({
    id: r.id, feedTypeId: r.feedTypeId, farrowingId: r.farrowingId, kg: Number(r.quantityKg),
    costoGs: Math.round(costo.get(r.id) ?? 0), quien: r.employeeId ? nombre.get(r.employeeId) ?? null : null,
    usuarioId: r.employeeId, hora: r.createdAt.toISOString(),
  }));

  return {
    fecha,
    tipos: listaTipos,
    registros: listaRegistros,
    animales: {
      // Gestación: todas las hembras activas que no están en Maternidad
      GESTACION: Math.max(0, hembrasActivas - camadas.length),
      INICIACION: iniciacion._sum.currentCount ?? 0,
      ENGORDE: engorde._sum.currentCount ?? 0,
    },
    lotes: { INICIACION: iniciacion._count._all, ENGORDE: engorde._count._all },
    cerdas: camadas.map(c => ({
      farrowingId: c.id, sowId: c.sow.id, caravana: c.sow.caravanaCode || c.sow.identCode,
      lechones: stockCamada(c), dias: Math.floor((desde.getTime() - Date.UTC(c.startDatetime.getUTCFullYear(), c.startDatetime.getUTCMonth(), c.startDatetime.getUTCDate())) / DIA),
    })),
  };
}

export type DatosNutricionDia = Awaited<ReturnType<typeof datosNutricionDia>>;
