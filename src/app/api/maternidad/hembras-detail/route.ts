export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["maternidad.partos.ver", "maternidad.lechones.ver", "maternidad.destetes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const today = new Date();

  const farrowings = await prisma.farrowingEvent.findMany({
    where:   { tenantId, id: { in: await idsCamadasAbiertas(tenantId) } },
    include: {
      sow: {
        select: {
          id: true, identCode: true, caravanaCode: true,
          galponAssigned: true, corralAssigned: true,
        },
      },
    },
    orderBy: { startDatetime: "asc" },
  });

  const hembras = farrowings.map(f => {
    const ingreso       = new Date(f.startDatetime);
    const diasEnMat     = Math.floor((today.getTime() - ingreso.getTime()) / 86400000);
    const desteteEst    = new Date(ingreso.getTime() + 21 * 86400000);

    const galpon    = f.sow.galponAssigned ?? "";
    const corral    = f.sow.corralAssigned ?? "";
    const ubicacion = [galpon, corral].filter(Boolean).join(" – ") || (f.penId ?? "—");

    let estado: string;
    if (diasEnMat <= 3)       estado = "Recién parida";
    else if (diasEnMat <= 14) estado = "Lactando";
    else if (diasEnMat <= 21) estado = "Pre-destete";
    else                      estado = "Destete pendiente";

    return {
      farrowingId:       f.id,
      sowId:             f.sow.id,
      caravana:          f.sow.caravanaCode ?? f.sow.identCode,
      ubicacion,
      fechaIngreso:      ingreso.toISOString().slice(0, 10),
      diasEnMaternidad:  diasEnMat,
      fechaDestesteEst:  desteteEst.toISOString().slice(0, 10),
      estado,
      lechonesVivos:     f.bornAlive,
    };
  });

  return NextResponse.json(hembras);
}
