export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    select: { currentParityCount: true },
  });
  if (!sow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();

  const [ultimoServicio, ultimoParto, totalServicios] = await Promise.all([
    prisma.serviceEvent.findFirst({
      where: { sowId: params.id, tenantId },
      orderBy: { serviceDate: "desc" },
      select: { serviceDate: true },
    }),
    prisma.farrowingEvent.findFirst({
      where: { sowId: params.id, tenantId },
      orderBy: { startDatetime: "desc" },
      select: {
        startDatetime: true,
        weaning: { select: { pigletsWeaned: true } },
      },
    }),
    prisma.serviceEvent.count({ where: { sowId: params.id, tenantId } }),
  ]);

  const diasDesdeUltimoServicio = ultimoServicio
    ? Math.floor((today.getTime() - new Date(ultimoServicio.serviceDate).getTime()) / 86400000)
    : null;

  const diasDesdeUltimoParto = ultimoParto
    ? Math.floor((today.getTime() - new Date(ultimoParto.startDatetime).getTime()) / 86400000)
    : null;

  const lechonesDestetados = ultimoParto?.weaning?.pigletsWeaned ?? null;

  return NextResponse.json({
    numeroParto:           sow.currentParityCount,
    diasUltimoParto:       diasDesdeUltimoParto,
    diasUltimoServicio:    diasDesdeUltimoServicio,
    numeroServicios:       totalServicios,
    lechonesDestetados,
  });
}
