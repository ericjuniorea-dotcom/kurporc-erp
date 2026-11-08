export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

// Super Admin (1), Admin de granja (2) — únicos roles que pueden confirmar
// manualmente que una baja corresponde a un brote (marcado administrativo,
// separado del disparador automático del heatmap).

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const necropsias = await prisma.necropsia.findMany({
    where: { tenantId },
    orderBy: { fecha: "desc" },
    take: 100,
    include: {
      sow:       { select: { identCode: true, caravanaCode: true } },
      boar:      { select: { identCode: true, caravanaCode: true } },
      piglet:    { select: { identCode: true } },
      farrowing: { select: { sow: { select: { identCode: true, caravanaCode: true } } } },
    },
  });

  const result = necropsias.map(n => ({
    id: n.id,
    caravana: n.sow
      ? (n.sow.caravanaCode ?? n.sow.identCode)
      : n.boar
      ? (n.boar.caravanaCode ?? n.boar.identCode)
      : n.piglet?.identCode
      ?? (n.farrowing ? `Camada de ${n.farrowing.sow.caravanaCode ?? n.farrowing.sow.identCode}` : "—"),
    causaSanitariaPresunta: n.causaSanitariaPresunta,
    seRealizoNecropsia:     n.seRealizoNecropsia,
    hallazgos:              n.hallazgos,
    galpon:                 n.galpon,
    bajaConfirmaBrote:      n.bajaConfirmaBrote,
    bajaConfirmaBroteFecha: n.bajaConfirmaBroteFecha?.toISOString() ?? null,
    fecha:                  n.fecha.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, id: userId } = session.user;

  const body = await req.json();
  const {
    sowId, boarId, farrowingId, pigletId,
    causaSanitariaPresunta, seRealizoNecropsia, hallazgos, galpon, fecha,
    bajaConfirmaBrote,
  } = body;

  if (!sowId && !boarId && !farrowingId && !pigletId) {
    return NextResponse.json({ error: "Se requiere sowId, boarId, farrowingId o pigletId" }, { status: 400 });
  }
  if (!causaSanitariaPresunta) {
    return NextResponse.json({ error: "causaSanitariaPresunta es requerida" }, { status: 400 });
  }

  // El marcado manual de "confirma brote" queda restringido a roles autorizados,
  // aunque el disparo automático del heatmap sigue siendo independiente de esto.
  const canConfirmarBrote = puede(await getPermisos(), "sanidad.protocolos.editar");
  if (bajaConfirmaBrote === true && !canConfirmarBrote) {
    return NextResponse.json({ error: "Solo un Administrador puede confirmar manualmente un brote" }, { status: 403 });
  }

  const fechaNecropsia = fecha ? new Date(fecha) : new Date();

  const necropsia = await prisma.necropsia.create({
    data: {
      tenantId, sowId, boarId, farrowingId, pigletId,
      causaSanitariaPresunta,
      seRealizoNecropsia: !!seRealizoNecropsia,
      hallazgos, galpon,
      fecha: fechaNecropsia,
      responsableId: userId,
      ...(bajaConfirmaBrote === true
        ? { bajaConfirmaBrote: true, bajaConfirmaBrotePor: userId, bajaConfirmaBroteFecha: new Date() }
        : {}),
    },
  });

  let sowCaravana: string | null = null;
  if (sowId) {
    const sow = await prisma.sow.findFirst({ where: { id: sowId }, select: { identCode: true, caravanaCode: true } });
    sowCaravana = sow ? (sow.caravanaCode ?? sow.identCode) : null;
  }

  if (sowId) {
    await prisma.animalEvent.create({
      data: {
        tenantId, sowId,
        eventType:    "NECROPSIA",
        eventDate:    fechaNecropsia,
        description:  `Necropsia — causa presunta: ${causaSanitariaPresunta}${sowCaravana ? ` (cerda ${sowCaravana})` : ""}`,
        moduleSource: "SANIDAD",
        userId,
        metadata:     { necropsiaId: necropsia.id, causaSanitariaPresunta },
      },
    }).catch(() => {});
  } else if (boarId) {
    await prisma.animalEvent.create({
      data: {
        tenantId, boarId,
        eventType:    "NECROPSIA",
        eventDate:    fechaNecropsia,
        description:  `Necropsia — causa presunta: ${causaSanitariaPresunta}`,
        moduleSource: "SANIDAD",
        userId,
        metadata:     { necropsiaId: necropsia.id, causaSanitariaPresunta },
      },
    }).catch(() => {});
  }

  return NextResponse.json(necropsia, { status: 201 });
}
