// Baja de una cerda (muerte o descarte): una sola función para todos los caminos (ficha, formulario de
// descarte, WhatsApp). Reglas que nunca pueden romperse:
//  1. No se da de baja una cerda con lechones a cargo: antes se donan a otra cerda o se destetan.
//     Así los lechones conservan su trazabilidad en la camada que los recibe.
//  2. La cerda sale del plantel activo (isActive = false, estado muerta o descartada) con su registro de baja.
//  3. Sale de la agenda: sus vacunas pendientes quedan omitidas y sus tareas abiertas se cierran.
//  La base además rechaza cualquier evento reproductivo posterior a la baja (trigger bloquear_eventos_cerda_baja).
import prisma from "@/lib/db/prisma";
import { stockCamada } from "@/lib/auditoria/granja";
import { SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";

export class ErrorBaja extends Error {
  constructor(msg: string, public codigo: "NO_EXISTE" | "YA_DE_BAJA" | "LECHONES_A_CARGO") { super(msg); }
}

export type DatosBaja = {
  tenantId: string; sowId: string; userId: string; tipo: "MUERTE" | "DESCARTE"; fecha: Date; motivo: string;
  /** Campos del formulario completo de descarte (opcionales). */
  extra?: Partial<{
    categoria: string; motivosEspecificos: string[]; tipoDescarte: string; destination: string | null; pesoKg: number | null; condicionCorporal: number | null;
    estadoSanitario: string | null; estadoReproductivo: string | null; estadoProductivo: string | null; numeroParto: number | null; diasUltimoParto: number | null;
    diasUltimoServicio: number | null; numeroServicios: number | null; lechonesDestetados: number | null; diagnostico: string | null; veterinario: string | null;
    observacionesClinicas: string | null; observaciones: string | null; responsableAutoriza: string | null;
  }>;
};

export async function darDeBajaCerda(d: DatosBaja) {
  const sow = await prisma.sow.findFirst({ where: { id: d.sowId, tenantId: d.tenantId }, select: { id: true, identCode: true, isActive: true, plantelState: true } });
  if (!sow) throw new ErrorBaja("La cerda no existe.", "NO_EXISTE");
  if (!sow.isActive) throw new ErrorBaja(`La cerda ${sow.identCode} ya está dada de baja.`, "YA_DE_BAJA");

  // Regla 1: lechones a cargo
  const abiertas = await prisma.farrowingEvent.findMany({ where: { tenantId: d.tenantId, sowId: d.sowId, weaning: null }, select: { startDatetime: true, ...SELECT_STOCK_CAMADA } });
  const conLechones = abiertas.map(c => ({ fecha: c.startDatetime, n: stockCamada(c) })).filter(c => c.n > 0);
  if (conLechones.length) {
    const c = conLechones[0];
    throw new ErrorBaja(
      `La cerda ${sow.identCode} tiene ${c.n} ${c.n > 1 ? "lechones" : "lechón"} a cargo (camada del ${c.fecha.toLocaleDateString("es-PY", { timeZone: "UTC" })}). ` +
      `Antes de darla de baja, doná los lechones a otra cerda (Maternidad → Adopción) o destetalos: así conservan su trazabilidad.`,
      "LECHONES_A_CARGO",
    );
  }

  const estado = d.tipo === "MUERTE" ? "DEAD" : "CULLED";
  const e = d.extra ?? {};
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`select set_config('app.actor_id', ${d.userId}, true)`;
    const updated = await tx.sow.update({
      where: { id: d.sowId },
      data: {
        plantelState: estado, isActive: false,
        animalEvents: { create: {
          tenantId: d.tenantId, eventType: d.tipo === "MUERTE" ? "DEATH" : "DISCARD", eventDate: d.fecha, previousState: sow.plantelState ?? undefined, newState: estado,
          description: `${d.tipo === "MUERTE" ? "Muerte" : "Descarte"}: ${d.motivo}`, moduleSource: "PLANTEL", userId: d.userId, metadata: { categoria: e.categoria ?? null, tipoDescarte: e.tipoDescarte ?? null },
        } },
      },
    });
    const discard = await tx.sowDiscard.create({ data: {
      tenantId: d.tenantId, sowId: d.sowId, discardDate: d.fecha, reason: d.motivo, destination: e.destination ?? (d.tipo === "MUERTE" ? "Muerte" : null), employeeId: d.userId,
      categoria: e.categoria ?? (d.tipo === "MUERTE" ? "Muerte" : "Descarte"), motivosEspecificos: e.motivosEspecificos ?? [], motivoPrincipal: d.motivo,
      tipoDescarte: e.tipoDescarte ?? (d.tipo === "MUERTE" ? "Muerte" : "Descarte"), pesoKg: e.pesoKg ?? null, condicionCorporal: e.condicionCorporal ?? null,
      estadoSanitario: e.estadoSanitario ?? null, estadoReproductivo: e.estadoReproductivo ?? null, estadoProductivo: e.estadoProductivo ?? null,
      numeroParto: e.numeroParto ?? null, diasUltimoParto: e.diasUltimoParto ?? null, diasUltimoServicio: e.diasUltimoServicio ?? null, numeroServicios: e.numeroServicios ?? null,
      lechonesDestetados: e.lechonesDestetados ?? null, diagnostico: e.diagnostico ?? null, veterinario: e.veterinario ?? null, observacionesClinicas: e.observacionesClinicas ?? null,
      observaciones: e.observaciones ?? null, responsableAutoriza: e.responsableAutoriza ?? null,
    } });
    // Regla 3: fuera de la agenda
    const vacunas = await tx.eventoVacunacion.updateMany({ where: { tenantId: d.tenantId, animalId: d.sowId, estado: { in: ["pendiente", "retrasado"] } }, data: { estado: "omitido" } });
    const tareas = await tx.task.updateMany({ where: { tenantId: d.tenantId, animalId: d.sowId, fechaCompletada: null }, data: { fechaCompletada: new Date(), notas: `Cerrada automáticamente: la cerda fue dada de baja (${d.tipo === "MUERTE" ? "muerte" : "descarte"}).` } });
    return { sow: updated, discard, vacunasOmitidas: vacunas.count, tareasCerradas: tareas.count };
  });
}
