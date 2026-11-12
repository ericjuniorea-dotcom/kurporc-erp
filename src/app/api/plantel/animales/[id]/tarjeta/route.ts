// Resumen corto de una cerda para la tarjeta que aparece al pasar el cursor por su caravana.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["plantel.animales.ver", "gestacion.servicios.ver", "maternidad.partos.ver", "sanidad.aplicaciones.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const org = session.user.tenantId;
  const sow = await prisma.sow.findFirst({
    where: { id, tenantId: org },
    select: { id: true, identCode: true, tattooCode: true, breed: true, birthDate: true, entryDate: true, isActive: true, plantelState: true, currentParityCount: true, plantelNotes: true },
  });
  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const [servicio, parto, baja, destetados] = await Promise.all([
    prisma.serviceEvent.findFirst({ where: { tenantId: org, sowId: id }, orderBy: { serviceDate: "desc" }, select: { codigo: true, serviceDate: true, pregnancyChecks: { orderBy: { checkDate: "desc" }, take: 1, select: { result: true, checkDate: true } } } }),
    prisma.farrowingEvent.findFirst({ where: { tenantId: org, sowId: id }, orderBy: { startDatetime: "desc" }, select: { codigo: true, startDatetime: true, bornAlive: true, bornDead: true, weaning: { select: { weaningDate: true, pigletsWeaned: true } } } }),
    prisma.sowDiscard.findFirst({ where: { tenantId: org, sowId: id }, orderBy: { discardDate: "desc" }, select: { discardDate: true, motivoPrincipal: true, tipoDescarte: true } }),
    prisma.weaningEvent.aggregate({ where: { tenantId: org, farrowing: { sowId: id } }, _sum: { pigletsWeaned: true } }),
  ]);
  return NextResponse.json({ sow, servicio, parto, baja, destetadosTotal: destetados._sum.pigletsWeaned ?? 0 });
}
