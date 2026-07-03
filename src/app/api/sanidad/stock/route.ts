export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7   = new Date(today); in7.setDate(in7.getDate() + 7);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);

  const [vacunas, lotes, eventosPendientes] = await Promise.all([
    prisma.vacuna.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, nombre: true, enfermedad: true, categoria: true, criticidad: true, bloqueoServicio: true },
    }),
    prisma.loteVacuna.findMany({
      where: { tenantId },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.eventoVacunacion.findMany({
      where: { tenantId, estado: { in: ["pendiente", "retrasado"] }, fecha: { lte: in7 } },
      select: { vacunaId: true, dosisNecesarias: true, fecha: true },
    }),
  ]);

  const result = vacunas.map(v => {
    const vLotes = lotes.filter(l => l.vacunaId === v.id);
    const stockTotal    = vLotes.reduce((s, l) => s + l.cantidadActual, 0);
    const stockNoVencido = vLotes
      .filter(l => l.fechaVencimiento >= today)
      .reduce((s, l) => s + l.cantidadActual, 0);
    const dosisNecesariasProx7d = eventosPendientes
      .filter(e => e.vacunaId === v.id)
      .reduce((s, e) => s + e.dosisNecesarias, 0);
    const vencenEn30 = vLotes.filter(l => l.fechaVencimiento >= today && l.fechaVencimiento <= in30);
    const vencidos   = vLotes.filter(l => l.fechaVencimiento < today && l.cantidadActual > 0);

    return {
      vacunaId:         v.id,
      nombre:           v.nombre,
      enfermedad:       v.enfermedad,
      categoria:        v.categoria,
      criticidad:       v.criticidad,
      bloqueoServicio:  v.bloqueoServicio,
      stockTotal,
      stockNoVencido,
      dosisNecesariasProx7d,
      suficiente:       stockNoVencido >= dosisNecesariasProx7d,
      alertaStock:      dosisNecesariasProx7d > 0 && stockNoVencido < dosisNecesariasProx7d,
      alertaVencimiento: vencenEn30.length > 0,
      alertaVencidos:    vencidos.length > 0,
      lotes: vLotes.map(l => ({
        id: l.id, numeroLote: l.numeroLote, cantidadActual: l.cantidadActual,
        fechaVencimiento: l.fechaVencimiento.toISOString(),
        diasParaVencer: Math.floor((l.fechaVencimiento.getTime() - today.getTime()) / 86400000),
        abierto: l.abierto, vencido: l.fechaVencimiento < today,
      })),
    };
  });

  const alertasCriticas = result.filter(r => r.alertaStock && r.criticidad === "alta").length;
  const stockCritico    = result.filter(r => r.alertaVencidos).length;

  return NextResponse.json({ vacunas: result, alertasCriticas, stockCritico });
}
