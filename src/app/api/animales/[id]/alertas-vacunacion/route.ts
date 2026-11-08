import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

/**
 * Alertas de vacunación de gestación para UNA cerda, basadas en día exacto
 * de gestación (ConfigVacuna.diaGestacion) contado desde su último servicio,
 * filtradas por paridad (misma fuente de verdad — conteo de FarrowingEvent —
 * que ya usa /api/gestacion/disponibles-detail para "primeriza").
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.aplicaciones.ver", "sanidad.tratamientos.ver", "sanidad.protocolos.ver", "sanidad.necropsias.ver", "sanidad.botiquin.ver", "plantel.animales.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({ where: { id: params.id, tenantId }, select: { id: true, identCode: true } });
  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [ultimoServicio, partosCount, esquemas, vaccinationEvents] = await Promise.all([
    prisma.serviceEvent.findFirst({
      where:   { tenantId, sowId: sow.id },
      orderBy: { serviceDate: "desc" },
      select:  { serviceDate: true },
    }),
    prisma.farrowingEvent.count({ where: { tenantId, sowId: sow.id } }),
    prisma.configVacuna.findMany({
      where: { tenantId, modulo: "GESTACION", activa: true, diaGestacion: { not: null } },
      orderBy: [{ enfermedadObjetivo: "asc" }, { ordenDosis: "asc" }],
    }),
    prisma.animalEvent.findMany({
      where:  { tenantId, sowId: sow.id, eventType: "VACCINATION" },
      select: { eventDate: true, metadata: true },
    }),
  ]);

  if (!ultimoServicio) {
    return NextResponse.json({ sowId: sow.id, identCode: sow.identCode, esPrimeriza: partosCount === 0, alertas: [] });
  }

  const esPrimeriza = partosCount === 0;
  const paridadCerda: "NULIPARA" | "MULTIPARA" = esPrimeriza ? "NULIPARA" : "MULTIPARA";
  const serviceDate = new Date(ultimoServicio.serviceDate);
  const today = new Date();today.setHours(0, 0, 0, 0);

  const aplicadosPorConfigId = new Set(
    vaccinationEvents
      .map(e => (e.metadata as Record<string, unknown> | null)?.configVacunaId)
      .filter((id): id is string => typeof id === "string"),
  );

  const esquemasAplicables = esquemas.filter(v => v.paridad === "AMBAS" || v.paridad === paridadCerda);

  const alertas = esquemasAplicables.map(v => {
    const fechaAlerta = new Date(serviceDate);
    fechaAlerta.setDate(fechaAlerta.getDate() + (v.diaGestacion as number));

    const aplicado = aplicadosPorConfigId.has(v.id);
    let estado: "APLICADA" | "PENDIENTE" | "ATRASADA" = "PENDIENTE";
    if (aplicado) estado = "APLICADA";
    else if (fechaAlerta < today) estado = "ATRASADA";

    return {
      configVacunaId:     v.id,
      enfermedadObjetivo: v.enfermedadObjetivo,
      nombreVacuna:       v.nombreVacuna,
      marcaComercial:     v.marcaComercial,
      diaGestacion:       v.diaGestacion,
      ordenDosis:         v.ordenDosis,
      paridad:            v.paridad,
      obligatoria:        v.obligatoria,
      fechaAlerta:        fechaAlerta.toISOString(),
      estado,
    };
  }).sort((a, b) => (a.diaGestacion ?? 0) - (b.diaGestacion ?? 0));

  return NextResponse.json({
    sowId: sow.id,
    identCode: sow.identCode,
    esPrimeriza,
    fechaServicio: serviceDate.toISOString(),
    alertas,
  });
}
