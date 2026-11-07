export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const now      = new Date();
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const in7days  = new Date(now); in7days.setDate(in7days.getDate() + 7);

  const [preñadas, serviciosSemana, partosEsta] = await Promise.all([
    prisma.sow.count({ where: { tenantId, plantelState: "PREGNANT", isActive: true } }),
    prisma.serviceEvent.count({ where: { tenantId, serviceDate: { gte: weekAgo, lte: now } } }),
    prisma.serviceEvent.count({
      where: {
        tenantId,
        farrowing: null,
        serviceDate: {
          gte: new Date(now.getTime() - 114 * 86400000 - 7 * 86400000),
          lte: new Date(now.getTime() - 114 * 86400000 + 7 * 86400000),
        },
      },
    }),
  ]);

  return NextResponse.json({ "preñadas": preñadas, serviciosSemana, partosEsta });
}
