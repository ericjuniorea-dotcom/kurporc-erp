export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { tipo, sector, titulo, descripcion, fechaVencimiento, targetLabel, instrucciones } = body;

  if (!sector || !titulo || !fechaVencimiento) {
    return NextResponse.json({ error: "sector, titulo y fechaVencimiento son requeridos" }, { status: 400 });
  }

  const due   = new Date(fechaVencimiento);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due.getTime() - today.getTime()) / 86400000);
  const prioridad = diff < 0 ? "urgente" : diff === 0 ? "hoy" : "programada";

  const task = await prisma.task.create({
    data: {
      tenantId,
      tipo:             tipo ?? "tratamiento-curativo",
      sector,
      alcance:          "granja",
      titulo,
      descripcion:      descripcion ?? titulo,
      instrucciones:    instrucciones ?? undefined,
      prioridad,
      fechaVencimiento: due,
      targetLabel:      targetLabel ?? undefined,
      generadaPor:      "manual",
    },
  });

  return NextResponse.json({ ok: true, task });
}
