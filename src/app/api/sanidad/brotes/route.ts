export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

// Regla de negocio: ≥3 casos de la misma causa en el mismo galpón en 7 días = brote.
const VENTANA_DIAS = 7;
const UMBRAL_BROTE = 3;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const cutoff = new Date(Date.now() - VENTANA_DIAS * 86400000);

  const [necropsias, tratamientos] = await Promise.all([
    prisma.necropsia.findMany({
      where:  { tenantId, fecha: { gte: cutoff } },
      select: { galpon: true, causaSanitariaPresunta: true, fecha: true },
    }),
    prisma.curativeTreatment.findMany({
      where:  { tenantId, startDate: { gte: cutoff }, sowId: { not: null } },
      select: {
        motivoClinico: true, diagnosisType: true, startDate: true,
        sow: { select: { galponAssigned: true } },
      },
    }),
  ]);

  interface Caso { tipo: "NECROPSIA" | "TRATAMIENTO"; fecha: string }
  const grupos = new Map<string, { galpon: string; causa: string; casos: Caso[] }>();

  function agregar(galpon: string | null, causa: string, tipo: Caso["tipo"], fecha: Date) {
    const g = galpon ?? "Sin galpón asignado";
    const key = `${g}::${causa}`;
    if (!grupos.has(key)) grupos.set(key, { galpon: g, causa, casos: [] });
    grupos.get(key)!.casos.push({ tipo, fecha: fecha.toISOString() });
  }

  for (const n of necropsias) {
    agregar(n.galpon, n.causaSanitariaPresunta, "NECROPSIA", n.fecha);
  }
  for (const t of tratamientos) {
    agregar(t.sow?.galponAssigned ?? null, t.motivoClinico ?? t.diagnosisType, "TRATAMIENTO", t.startDate);
  }

  const result = Array.from(grupos.values())
    .map(g => ({
      galpon:  g.galpon,
      causa:   g.causa,
      cantidadCasos: g.casos.length,
      esBrote: g.casos.length >= UMBRAL_BROTE,
      casos:   g.casos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }))
    .sort((a, b) => b.cantidadCasos - a.cantidadCasos);

  const estadoGeneral = result.some(r => r.esBrote) ? "rojo" : result.length > 0 ? "amarillo" : "verde";

  return NextResponse.json({ ventanaDias: VENTANA_DIAS, umbralBrote: UMBRAL_BROTE, estadoGeneral, grupos: result });
}
