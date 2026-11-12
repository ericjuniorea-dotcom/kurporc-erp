import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { diffDays, addDays } from "@/lib/utils";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["maternidad.partos.ver", "maternidad.lechones.ver", "maternidad.destetes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });

  const tenantId = session.user.tenantId;
  const today    = new Date();

  const farrowings = await prisma.farrowingEvent.findMany({
    where: { tenantId, id: { in: await idsCamadasAbiertas(tenantId) } },
    include: {
      sow:                    { select: { identCode: true } },
      pen:                    { select: { number: true, location: { select: { name: true } } } },
      deaths:                 { select: { quantity: true } },
      movementsAsDestination: { select: { quantity: true } },
      movementsAsOrigin:      { select: { quantity: true } },
      fosterAsReceiver:       { include: { donations: { select: { quantity: true } } } },
    },
  });

  let totalLechones  = 0;
  let totalBornAlive = 0;

  const ageBuckets = { "0-7": 0, "8-14": 0, "15-21": 0, "22+": 0 };

  const inconsistencias: Array<{
    farrowingId:         string;
    sowId:               string;
    sowCode:             string;
    location:            string | null;
    pen:                 string | null;
    dias:                number;
    expectedWeaningDate: string;
  }> = [];

  for (const f of farrowings) {
    const received =
      f.movementsAsDestination.reduce((s, m) => s + m.quantity, 0) +
      f.fosterAsReceiver.reduce(
        (s, fe) => s + fe.donations.reduce((ds, d) => ds + d.quantity, 0), 0,
      );
    const donated = f.movementsAsOrigin.reduce((s, m) => s + m.quantity, 0);
    const deaths  = f.deaths.reduce((s, d) => s + d.quantity, 0);
    const stock   = Math.max(0, f.bornAlive + received - donated - deaths);
    const dias    = diffDays(new Date(f.startDatetime), today);

    totalLechones  += stock;
    totalBornAlive += f.bornAlive;

    if (dias <= 7)        ageBuckets["0-7"]   += stock;
    else if (dias <= 14)  ageBuckets["8-14"]  += stock;
    else if (dias <= 21)  ageBuckets["15-21"] += stock;
    else                  ageBuckets["22+"]   += stock;

    if (dias > 21) {
      inconsistencias.push({
        farrowingId:         f.id,
        sowId:               f.sowId,
        sowCode:             f.sow.identCode,
        location:            f.pen?.location?.name ?? null,
        pen:                 f.pen?.number ?? null,
        dias,
        expectedWeaningDate: addDays(new Date(f.startDatetime), 21).toISOString(),
      });
    }
  }

  const mortalidad = totalBornAlive > 0
    ? Math.round(((totalBornAlive - totalLechones) / totalBornAlive) * 100 * 10) / 10
    : 0;

  return NextResponse.json({
    hembras:  farrowings.length,
    lechones: totalLechones,
    mortalidad,
    ageDistribution: [
      { label: "0-7 días",   count: ageBuckets["0-7"]   },
      { label: "8-14 días",  count: ageBuckets["8-14"]  },
      { label: "15-21 días", count: ageBuckets["15-21"] },
      { label: "22+ días",   count: ageBuckets["22+"]   },
    ],
    inconsistencias: inconsistencias.sort((a, b) => b.dias - a.dias),
  });
}
