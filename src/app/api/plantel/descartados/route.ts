export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const sows = await prisma.sow.findMany({
    where: {
      tenantId,
      plantelState: { in: ["CULLED", "DEAD"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      erpCode: true,
      caravanaCode: true,
      identCode: true,
      plantelState: true,
      geneticLine: true,
      breed: true,
      birthDate: true,
      currentParityCount: true,
      updatedAt: true,
      discards: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          discardDate: true,
          categoria: true,
          motivosEspecificos: true,
          motivoPrincipal: true,
          tipoDescarte: true,
          destination: true,
          pesoKg: true,
          condicionCorporal: true,
          estadoSanitario: true,
          estadoReproductivo: true,
          estadoProductivo: true,
          numeroParto: true,
          diasUltimoParto: true,
          diasUltimoServicio: true,
          numeroServicios: true,
          lechonesDestetados: true,
          diagnostico: true,
          veterinario: true,
          observacionesClinicas: true,
          observaciones: true,
          responsableAutoriza: true,
          employeeId: true,
          reason: true,
        },
      },
      animalEvents: {
        where: { eventType: { in: ["DISCARD", "DEATH"] } },
        orderBy: { eventDate: "desc" },
        take: 1,
        select: { eventType: true, eventDate: true, description: true },
      },
    },
  });

  // Enriquecer con nombre del operario si employeeId está presente
  const empIds = Array.from(
    new Set(sows.flatMap(s => s.discards.map(d => d.employeeId).filter(Boolean))),
  ) as string[];
  const users = empIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const result = sows.map(s => ({
    ...s,
    lastDiscard: s.discards[0]
      ? { ...s.discards[0], employeeName: userMap.get(s.discards[0].employeeId ?? "") ?? null }
      : null,
    lastEvent: s.animalEvents[0] ?? null,
    discards: undefined,
    animalEvents: undefined,
  }));

  return NextResponse.json(result);
}
