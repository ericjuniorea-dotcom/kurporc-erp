import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyPending = searchParams.get("pending") !== "false";
  const farrowingId = searchParams.get("farrowingId");
  const overdueOnly = searchParams.get("overdue") === "true";

  const today = new Date();

  const tasks = await prisma.healthTask.findMany({
    where: {
      tenantId:    session.user.tenantId,
      ...(onlyPending ? { isCompleted: false } : {}),
      ...(farrowingId ? { farrowingId } : {}),
      ...(overdueOnly ? { dueDate: { lt: today } } : {}),
    },
    include: {
      protocolTask: {
        select: {
          taskName: true,
          taskType: true,
          doseMl:   true,
          route:    true,
          medicine: { select: { name: true, withdrawalDays: true } },
        },
      },
      farrowing: {
        select: {
          id:    true,
          startDatetime: true,
          sow:   { select: { identCode: true } },
          pen:   { select: { number: true } },
        },
      },
      completion: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: [{ isCompleted: "asc" }, { dueDate: "asc" }],
    take:    300,
  });

  const enriched = tasks.map((t) => ({
    ...t,
    isOverdue:    !t.isCompleted && t.dueDate < today,
    daysUntilDue: Math.ceil((t.dueDate.getTime() - today.getTime()) / 86400000),
  }));

  return NextResponse.json(enriched);
}
