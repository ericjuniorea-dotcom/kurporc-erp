import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { serviceEventSchema } from "@/lib/validations/gestacion";
import { createServiceEventForSow, FORCE_OVERRIDE_ROLES } from "@/lib/gestacion/create-service-event";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sowId   = searchParams.get("sowId");
  const batchId = searchParams.get("batchId");

  const events = await prisma.serviceEvent.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(sowId   ? { sowId }                     : {}),
      ...(batchId ? { serviceBatchId: batchId }   : {}),
    },
    include: {
      sow:          { select: { identCode: true } },
      serviceBatch: { select: { weekLabel: true } },
      semenDose:    { select: { doseCode: true, expiryDate: true } },
      farrowing:    { select: { id: true, startDatetime: true, bornAlive: true } },
      pregnancyChecks: {
        orderBy: { checkDate: "desc" },
        take: 1,
      },
    },
    orderBy: { serviceDate: "desc" },
    take: 200,
  });

  // Enriquecer con nombre del usuario que inseminó
  const userIds = Array.from(new Set(events.map(e => e.employeeId).filter(Boolean))) as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const result = events.map(e => ({
    ...e,
    employeeName:    e.employeeId ? (userMap.get(e.employeeId) ?? null) : null,
    durationMinutes: e.durationMinutes ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 3, 4, 5, 11, 13];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = serviceEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // El flag "force" solo se respeta si el usuario tiene un rol autorizado —
  // nunca se confía en el valor enviado por el cliente sin verificarlo acá.
  const canForce = session.user.roles.some((r) => FORCE_OVERRIDE_ROLES.includes(r));
  const forceOverride = canForce && body.force === true;

  // Si viene de "Crear lote", el cliente pasa el batchId para que este
  // servicio individual quede asociado al lote en vez de al auto-agrupado semanal.
  let serviceBatchId: string | undefined;
  if (body.serviceBatchId) {
    const batch = await prisma.serviceBatch.findFirst({
      where: { id: body.serviceBatchId, tenantId: session.user.tenantId },
    });
    if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    serviceBatchId = batch.id;
  }

  const result = await createServiceEventForSow(session.user.tenantId, session.user.id, parsed.data, { forceOverride, serviceBatchId });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const { ok, ...payload } = result;
  return NextResponse.json(payload, { status: 201 });
}
