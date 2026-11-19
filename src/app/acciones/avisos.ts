"use server";
// Campanita de avisos (dentro de la app): órdenes de trabajo y animales por recibir en los módulos donde la persona
// tiene permiso. Solo lectura; desaparecen cuando se envían o se reciben.
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { generarOrdenesMaternidad } from "@/lib/transferencias/servidor";
import { CATEGORIAS, MODULOS_TRANSFERENCIA, PERMISOS_MODULO, type ModuloTransferencia } from "@/lib/transferencias/tipos";

export type Aviso = { id: string; tipo: "enviar" | "recibir"; titulo: string; detalle: string; href: string; fecha: string };

// La orden automática Gestación → Maternidad se revisa como mucho cada 10 minutos por organización
const ultimaRevision = new Map<string, number>();

export async function misAvisos(): Promise<{ total: number; avisos: Aviso[] }> {
  const permisos = await getPermisos();
  if (!permisos) return { total: 0, avisos: [] };
  const org = permisos.organizacionId;
  const modulos = (Object.keys(PERMISOS_MODULO) as Exclude<ModuloTransferencia, "COMPRA">[]).filter(m => PERMISOS_MODULO[m].some(c => puede(permisos, c)));
  if (!modulos.length) return { total: 0, avisos: [] };

  if ((modulos.includes("GESTACION") || modulos.includes("MATERNIDAD")) && Date.now() - (ultimaRevision.get(org) ?? 0) > 10 * 60_000) {
    ultimaRevision.set(org, Date.now());
    await generarOrdenesMaternidad(org).catch(e => console.error("[ordenes-maternidad]", e));
  }
  const where = { tenantId: org, OR: [{ estado: "ORDEN", origen: { in: modulos } }, { estado: "EN_CAMINO", destino: { in: modulos } }] };
  const [total, filas] = await Promise.all([
    prisma.transferenciaAnimal.count({ where }),
    prisma.transferenciaAnimal.findMany({ where, orderBy: [{ fechaProgramada: "asc" }, { createdAt: "desc" }], take: 30 }),
  ]);
  const sows = Array.from(new Set(filas.map(f => f.sowId).filter((x): x is string => !!x)));
  const cerdas = new Map((sows.length ? await prisma.sow.findMany({ where: { id: { in: sows } }, select: { id: true, caravanaCode: true, identCode: true } }) : []).map(c => [c.id, c.caravanaCode || c.identCode]));
  const et = (m: string) => MODULOS_TRANSFERENCIA[m as ModuloTransferencia]?.etiqueta ?? m;
  return {
    total,
    avisos: filas.map(f => {
      const enviar = f.estado === "ORDEN";
      const quien = f.sowId && cerdas.get(f.sowId) ? `Reproductora ${cerdas.get(f.sowId)}` : `${f.cantidad} ${CATEGORIAS[f.categoria as keyof typeof CATEGORIAS]?.unidad ?? "animales"}`;
      return {
        id: f.id, tipo: enviar ? "enviar" : "recibir",
        titulo: enviar ? `${et(f.origen)}: pasar ${quien} a ${et(f.destino)}` : `${et(f.destino)}: recibir ${quien}`,
        detalle: f.motivo,
        href: MODULOS_TRANSFERENCIA[(enviar ? f.origen : f.destino) as ModuloTransferencia]?.href ?? "/dashboard",
        fecha: (f.fechaProgramada ?? f.createdAt).toISOString(),
      };
    }),
  };
}
