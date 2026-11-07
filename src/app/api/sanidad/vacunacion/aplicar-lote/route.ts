export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";

/**
 * Aplica una vacuna a varios EventoVacunacion a la vez (incluso de distintos
 * sectores/módulos, siempre que compartan la misma vacuna), consumiendo un
 * único lote (LoteVacuna) — reutilizando la sesión de vial abierto si todavía
 * tiene dosis y no venció por tiempo, o abriendo una nueva si hace falta.
 * Validaciones en el orden del spec: lote existe → misma vacuna → no vencido
 * → vial no descartado por tiempo → stock suficiente.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, id: userId } = session.user;

  const body = await req.json();
  const { eventoIds, numeroLote, responsable, fechaAplicacion, observaciones, dosisPorAnimal } = body as {
    eventoIds?: string[]; numeroLote?: string; responsable?: string;
    fechaAplicacion?: string; observaciones?: string; dosisPorAnimal?: number;
  };

  if (!Array.isArray(eventoIds) || eventoIds.length === 0) {
    return NextResponse.json({ error: "Seleccioná al menos una cerda/lote pendiente" }, { status: 400 });
  }
  if (!numeroLote) {
    return NextResponse.json({ error: "Número de lote requerido" }, { status: 400 });
  }
  if (!responsable) {
    return NextResponse.json({ error: "Responsable requerido" }, { status: 400 });
  }

  const eventos = await prisma.eventoVacunacion.findMany({
    where: { id: { in: eventoIds }, tenantId },
    include: { vacuna: true },
  });
  if (eventos.length !== eventoIds.length) {
    return NextResponse.json({ error: "Algún evento seleccionado no existe" }, { status: 404 });
  }
  const yaAplicados = eventos.filter(e => e.estado === "aplicado");
  if (yaAplicados.length > 0) {
    return NextResponse.json({ error: `${yaAplicados.length} de los eventos seleccionados ya fueron aplicados` }, { status: 409 });
  }

  // Regla 2: todas las tareas seleccionadas deben ser la misma vacuna
  const vacunaIds = new Set(eventos.map(e => e.vacunaId));
  if (vacunaIds.size > 1) {
    const nombres = Array.from(new Set(eventos.map(e => e.vacuna.nombre)));
    return NextResponse.json({
      error: `La selección cruza distintas vacunas (${nombres.join(", ")}). Armá un solo evento por vacuna.`,
    }, { status: 422 });
  }
  const vacuna = eventos[0].vacuna;

  // Regla 1: el lote debe existir ya en inventario
  const lote = await prisma.loteInventario.findFirst({ where: { tenantId, vacunaId: vacuna.id, numeroLote } });
  if (!lote) {
    return NextResponse.json({ error: "Lote no registrado en inventario. Cargalo primero en Inventario." }, { status: 404 });
  }

  const now = fechaAplicacion ? new Date(fechaAplicacion) : new Date();

  // Regla 3: lote no vencido
  if (lote.fechaVencimiento < now) {
    return NextResponse.json({ error: `El lote ${numeroLote} está vencido (venció ${lote.fechaVencimiento.toLocaleDateString("es-PY")}).` }, { status: 422 });
  }

  // Regla 4: vial abierto no descartado por tiempo
  if (lote.abierto && lote.fechaApertura && vacuna.descarteHorasApertura) {
    const discardAt = new Date(lote.fechaApertura.getTime() + vacuna.descarteHorasApertura * 3600000);
    if (now > discardAt) {
      return NextResponse.json({
        error: `Este vial se abrió el ${lote.fechaApertura.toLocaleString("es-PY")} y debe descartarse (pasaron más de ${vacuna.descarteHorasApertura}h). Las dosis restantes se pierden — registrá un lote/vial nuevo.`,
      }, { status: 422 });
    }
  }

  // Regla 5: stock suficiente (suma de dosis necesarias de todos los eventos,
  // o dosisPorAnimal si el operador editó la dosis precargada del protocolo)
  const dosisTotales = dosisPorAnimal
    ? dosisPorAnimal * eventos.length
    : eventos.reduce((sum, e) => sum + e.dosisNecesarias, 0);
  if (Number(lote.cantidadActual) < dosisTotales) {
    return NextResponse.json({ error: `Stock insuficiente en el lote ${numeroLote}. Disponible: ${Number(lote.cantidadActual)} dosis, se necesitan ${dosisTotales}.` }, { status: 422 });
  }

  // Agrupa todas las AplicacionVacuna creadas en esta misma llamada — equivale
  // a "un evento de aplicación vinculado a N animales" sin necesitar una tabla
  // nueva (ver decisión de arquitectura en el plan).
  const grupoAplicacionId = crypto.randomUUID();

  // Agrupar por sector para poder marcar "aplicado" con updateMany en vez de
  // una llamada por evento — cada ida y vuelta a la base paga ~200ms de
  // latencia de red, así que N eventos secuenciales se sentían como varios
  // segundos de traba; agrupado queda en un puñado de consultas.
  const eventosPorSector = new Map<string, string[]>();
  for (const evento of eventos) {
    const arr = eventosPorSector.get(evento.sector) ?? [];
    arr.push(evento.id);
    eventosPorSector.set(evento.sector, arr);
  }
  const animalEventsData = eventos
    .filter(e => e.animalId)
    .map(evento => ({
      tenantId,
      sowId:        evento.animalId!,
      eventType:    "VACCINATION" as const,
      eventDate:    now,
      description:  `${vacuna.nombre} aplicada (lote ${numeroLote}, aplicación en grupo)`,
      moduleSource: "SANIDAD" as const,
      userId,
      metadata:     { vacunaId: vacuna.id, loteVacunaId: lote.id, eventoVacunacionId: evento.id, sector: evento.sector },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.loteInventario.update({
      where: { id: lote.id },
      data: {
        cantidadActual: { decrement: dosisTotales },
        abierto: true,
        ...(lote.abierto ? {} : { fechaApertura: now, abiertoPorId: userId }),
      },
    });
    await tx.movimientoInventario.create({
      data: { tenantId, productoId: vacuna.id, loteId: lote.id, tipo: "SALIDA", cantidad: dosisTotales, origen: "VACUNACION", referenciaId: grupoAplicacionId },
    });

    await tx.aplicacionVacuna.createMany({
      data: eventos.map(evento => ({
        tenantId,
        eventoId:       evento.id,
        loteVacunaId:   lote.id,
        vacunaId:       vacuna.id,
        dosisAplicadas: dosisPorAnimal ?? evento.dosisNecesarias,
        fechaAplicacion: now,
        responsable,
        observaciones,
        grupoAplicacionId,
      })),
    });

    for (const [sector, ids] of Array.from(eventosPorSector.entries())) {
      await tx.eventoVacunacion.updateMany({
        where: { id: { in: ids } },
        data:  { estado: "aplicado", sectorAlAplicar: sector, updatedAt: new Date() },
      });
    }

    if (animalEventsData.length > 0) {
      await tx.animalEvent.createMany({ data: animalEventsData }).catch(() => {});
    }
  });

  invalidateInventario(tenantId);

  return NextResponse.json({
    lote: { id: lote.id, numeroLote: lote.numeroLote, cantidadActualRestante: Number(lote.cantidadActual) - dosisTotales },
    aplicaciones: eventos.length,
    grupoAplicacionId,
    desglosePorSector: Object.entries(
      eventos.reduce<Record<string, number>>((acc, e) => { acc[e.sector] = (acc[e.sector] ?? 0) + 1; return acc; }, {}),
    ).map(([sector, cantidad]) => ({ sector, cantidad })),
  }, { status: 201 });
}
