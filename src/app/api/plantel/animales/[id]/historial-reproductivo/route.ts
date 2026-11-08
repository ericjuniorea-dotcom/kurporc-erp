import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["plantel.animales.ver", "gestacion.servicios.ver", "maternidad.partos.ver", "sanidad.aplicaciones.ver", "destete.lotes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true },
  });
  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [servicios, partos] = await Promise.all([
    prisma.serviceEvent.findMany({
      where: { sowId: params.id, tenantId },
      orderBy: { serviceDate: "desc" },
      include: {
        boar: { select: { identCode: true, erpCode: true } },
        semenDose: { select: { doseCode: true } },
        pregnancyChecks: {
          orderBy: { checkDate: "desc" },
          take: 1,
          select: { result: true, checkDate: true, method: true },
        },
      },
    }),
    prisma.farrowingEvent.findMany({
      where: { sowId: params.id, tenantId },
      orderBy: { startDatetime: "desc" },
      include: {
        weaning: {
          select: {
            weaningDate: true,
            pigletsWeaned: true,
            avgPigletWeightKg: true,
            lactationDays: true,
          },
        },
      },
    }),
  ]);

  const tasaConcepcion = servicios.length > 0
    ? Math.round((partos.length / servicios.length) * 100)
    : 0;

  const nacidosVivoTotal = partos.reduce((s, p) => s + p.bornAlive, 0);
  const nacidosVivoPromedio = partos.length > 0
    ? Math.round((nacidosVivoTotal / partos.length) * 10) / 10
    : 0;

  return NextResponse.json({
    kpis: {
      totalServicios: servicios.length,
      totalPartos: partos.length,
      tasaConcepcion,
      nacidosVivoPromedio,
    },
    servicios,
    partos,
  });
}
