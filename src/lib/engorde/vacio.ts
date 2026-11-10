// Fase 9 · Vacío sanitario: al cerrar un lote (todo afuera), su sitio queda vacío los días configurados
// (Configuración → Engorde → Vacío sanitario) antes de aceptar otro lote.
import "server-only";
import prisma from "@/lib/db/prisma";

const DIA = 86_400_000;

export async function diasVacioSanitario(org: string): Promise<number> {
  const c = await prisma.configProceso.findFirst({ where: { tenantId: org, modulo: "ENGORDE", procesoKey: "vacio_sanitario" }, select: { valor: true } });
  const v = (c?.valor ?? {}) as Record<string, unknown>;
  if (v.activo === false) return 0;
  return Math.max(0, Math.min(60, Number(v.dias ?? 7)));
}

/** Normaliza el sitio para comparar ("Galpón 2" = "galpon 2"). */
export const claveSitio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Si el sitio está en vacío sanitario, hasta cuándo y por qué lote. */
export async function sitioEnVacio(org: string, sitio: string | null | undefined, ahora = new Date()) {
  if (!sitio?.trim()) return null;
  const dias = await diasVacioSanitario(org);
  if (!dias) return null;
  const cerrados = await prisma.growingBatch.findMany({
    where: { tenantId: org, status: "CLOSED", closedAt: { gte: new Date(ahora.getTime() - dias * DIA) }, sitio: { not: null } },
    select: { batchCode: true, sitio: true, closedAt: true }, orderBy: { closedAt: "desc" },
  });
  const ult = cerrados.find(l => claveSitio(l.sitio!) === claveSitio(sitio));
  if (!ult?.closedAt) return null;
  const hasta = new Date(ult.closedAt.getTime() + dias * DIA);
  return hasta.getTime() > ahora.getTime() ? { hasta, lote: ult.batchCode, dias } : null;
}
