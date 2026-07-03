import { prisma } from "@/lib/db/prisma";

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function getProtocoloItems(tenantId: string, disparador: string) {
  return prisma.protocoloItem.findMany({
    where: { tenantId, disparador },
    include: { vacuna: { select: { id: true, nombre: true } } },
  });
}

async function upsertEvento(data: {
  tenantId:        string;
  vacunaId:        string;
  protocoloItemId: string;
  sector:          string;
  fecha:           Date;
  animalId?:       string;
  farrowingId?:    string;
  nurseryBatchId?: string;
  targetLabel?:    string;
  dosisNecesarias: number;
  disparador:      string;
}) {
  const exists = await prisma.eventoVacunacion.findFirst({
    where: { tenantId: data.tenantId, disparador: data.disparador },
    select: { id: true },
  });
  if (exists) return;
  await prisma.eventoVacunacion.create({ data: { ...data, estado: "pendiente" } });
}

// Llamar al registrar un parto
export async function generarEventosParto(
  tenantId:    string,
  farrowingId: string,
  partoDate:   Date,
  sowLabel:    string,
  lechones:    number,
) {
  const items = await getProtocoloItems(tenantId, "parto");
  await Promise.all(items.map(item =>
    upsertEvento({
      tenantId,
      vacunaId:        item.vacunaId,
      protocoloItemId: item.id,
      sector:          "maternidad",
      fecha:           addDays(partoDate, item.diaCiclo),
      farrowingId,
      targetLabel:     sowLabel,
      dosisNecesarias: lechones,
      disparador:      `parto-${farrowingId}-vacuna-${item.id}`,
    })
  ));
}

// Llamar al registrar un servicio
export async function generarEventosServicio(
  tenantId:       string,
  serviceEventId: string,
  serviceDate:    Date,
  sowLabel:       string,
  animalId?:      string,
) {
  const items = await getProtocoloItems(tenantId, "servicio");
  await Promise.all(items.map(item =>
    upsertEvento({
      tenantId,
      vacunaId:        item.vacunaId,
      protocoloItemId: item.id,
      sector:          "gestacion",
      fecha:           addDays(serviceDate, item.diaCiclo),
      animalId,
      targetLabel:     sowLabel,
      dosisNecesarias: 1,
      disparador:      `servicio-${serviceEventId}-vacuna-${item.id}`,
    })
  ));
}

// Llamar al crear un lote de destete
export async function generarEventosNursery(
  tenantId:       string,
  nurseryBatchId: string,
  batchCode:      string,
  entryDate:      Date,
  animalCount:    number,
) {
  const items = await getProtocoloItems(tenantId, "destete");
  await Promise.all(items.map(item =>
    upsertEvento({
      tenantId,
      vacunaId:        item.vacunaId,
      protocoloItemId: item.id,
      sector:          "iniciacion",
      fecha:           addDays(entryDate, item.diaCiclo),
      nurseryBatchId,
      targetLabel:     `Lote ${batchCode}`,
      dosisNecesarias: animalCount,
      disparador:      `nursery-${nurseryBatchId}-vacuna-${item.id}`,
    })
  ));
}

// Verificar si una cerda tiene vacunas obligatorias al día (para bloqueo de servicio)
export async function verificarVacunasParaServicio(
  tenantId: string,
  animalId: string,
): Promise<{ bloqueado: boolean; motivo?: string }> {
  // Buscar protocoloItems con bloqueoServicio=true, disparador=servicio
  const itemsBloqueantes = await prisma.protocoloItem.findMany({
    where: { tenantId, bloqueoServicio: true, disparador: "servicio" },
    include: { vacuna: { select: { nombre: true } } },
  });

  if (itemsBloqueantes.length === 0) return { bloqueado: false };

  // Buscar aplicaciones de esas vacunas para esta cerda
  for (const item of itemsBloqueantes) {
    const aplicacion = await prisma.aplicacionVacuna.findFirst({
      where: {
        tenantId,
        vacunaId: item.vacunaId,
        evento: { animalId },
        fechaAplicacion: {
          // Válida en los últimos 6 meses (180 días)
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!aplicacion) {
      return {
        bloqueado: true,
        motivo: `Vacuna "${item.vacuna.nombre}" obligatoria no aplicada o vencida (> 180 días). Aplicar antes de autorizar servicio.`,
      };
    }
  }

  return { bloqueado: false };
}
