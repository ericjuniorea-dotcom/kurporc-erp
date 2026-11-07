export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { addDays } from "@/lib/utils";

const DIAGNOSIS_TYPES = ["DIARRHEA", "ARTHRITIS", "PNEUMONIA", "OTHER"];
const ESTADOS = ["ACTIVO", "EN_SEGUIMIENTO", "FINALIZADO", "ABANDONADO"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp     = req.nextUrl.searchParams;
  const estado = sp.get("estado") ?? undefined;

  const tratamientos = await prisma.curativeTreatment.findMany({
    where: { tenantId, ...(estado ? { estado: estado as any } : {}) },
    orderBy: { startDate: "desc" },
    take: 100,
    include: {
      medicine: { select: { name: true } },
      sow:      { select: { identCode: true, caravanaCode: true } },
      piglet:   { select: { identCode: true } },
      farrowing: { select: { sow: { select: { identCode: true, caravanaCode: true } } } },
    },
  });

  const result = tratamientos.map(t => ({
    id:                    t.id,
    caravana: t.sow
      ? (t.sow.caravanaCode ?? t.sow.identCode)
      : t.piglet?.identCode
      ?? (t.farrowing ? `Camada de ${t.farrowing.sow.caravanaCode ?? t.farrowing.sow.identCode}` : "—"),
    medicamento:           t.medicine.name,
    diagnosisType:         t.diagnosisType,
    motivoClinico:         t.motivoClinico,
    dosis:                 Number(t.doseMl),
    animalsAffected:       t.animalsAffected,
    estado:                t.estado,
    startDate:             t.startDate.toISOString(),
    fechaSeguimiento:      t.fechaSeguimiento?.toISOString() ?? null,
    respuestaSeguimiento:  t.respuestaSeguimiento,
    withdrawalDays:        t.withdrawalDays,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, id: userId } = session.user;

  const body = await req.json();
  const {
    sowId, farrowingId, pigletId, diagnosisType, motivoClinico, diagnosisNotes,
    medicineId, doseMl, animalsAffected, treatmentDays, startDate,
    withdrawalDays, fechaSeguimiento,
  } = body;

  if (!sowId && !farrowingId && !pigletId) {
    return NextResponse.json({ error: "Se requiere sowId, farrowingId o pigletId" }, { status: 400 });
  }
  if (!medicineId || doseMl == null || !animalsAffected) {
    return NextResponse.json({ error: "medicineId, doseMl y animalsAffected son requeridos" }, { status: 400 });
  }
  const tipo = DIAGNOSIS_TYPES.includes(diagnosisType) ? diagnosisType : "OTHER";

  let sowCaravana: string | null = null;
  if (sowId) {
    const sow = await prisma.sow.findFirst({ where: { id: sowId, tenantId }, select: { identCode: true, caravanaCode: true } });
    if (!sow) return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });
    sowCaravana = sow.caravanaCode ?? sow.identCode;
  }

  const fechaInicio = startDate ? new Date(startDate) : new Date();

  const treatment = await prisma.curativeTreatment.create({
    data: {
      tenantId, sowId, farrowingId, pigletId,
      diagnosisType: tipo as any,
      diagnosisNotes, motivoClinico,
      medicineId, doseMl,
      animalsAffected, treatmentDays: treatmentDays ?? 1,
      startDate: fechaInicio,
      withdrawalDays: withdrawalDays ?? 0,
      fechaSeguimiento: fechaSeguimiento ? new Date(fechaSeguimiento) : undefined,
      employeeId: userId,
    },
  });

  if (withdrawalDays > 0) {
    await prisma.withdrawalPeriod.create({
      data: {
        tenantId, sowId, farrowingId, pigletId,
        medicineId, treatmentId: treatment.id,
        withdrawalDays,
        startDate: fechaInicio,
        endDate: addDays(fechaInicio, withdrawalDays),
      },
    });
  }

  if (sowId) {
    await prisma.animalEvent.create({
      data: {
        tenantId, sowId,
        eventType:    "TRATAMIENTO_CLINICO",
        eventDate:    fechaInicio,
        description:  `Tratamiento clínico${motivoClinico ? `: ${motivoClinico}` : ""} — cerda ${sowCaravana}`,
        moduleSource: "SANIDAD",
        userId,
        metadata:     { curativeTreatmentId: treatment.id, medicineId, withdrawalDays },
      },
    }).catch(() => {});
  }

  return NextResponse.json(treatment, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { id, estado, respuestaSeguimiento } = body;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (estado && !ESTADOS.includes(estado)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const existing = await prisma.curativeTreatment.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Tratamiento no encontrado" }, { status: 404 });

  const updated = await prisma.curativeTreatment.update({
    where: { id },
    data: {
      ...(estado ? { estado } : {}),
      ...(respuestaSeguimiento !== undefined ? { respuestaSeguimiento } : {}),
    },
  });

  return NextResponse.json(updated);
}
