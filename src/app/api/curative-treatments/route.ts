import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { curativeTreatmentSchema } from "@/lib/validations/sanidad";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "sanidad.tratamientos.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "sanidad.tratamientos.ver" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const farrowingId = searchParams.get("farrowingId");

  const treatments = await prisma.curativeTreatment.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(farrowingId ? { farrowingId } : {}),
    },
    include: {
      medicine:  { select: { name: true, withdrawalDays: true } },
      farrowing: { select: { sow: { select: { identCode: true } } } },
      withdrawalPeriods: {
        where:  { isActive: true, endDate: { gte: new Date() } },
        select: { endDate: true },
      },
    },
    orderBy: { startDate: "desc" },
    take:    100,
  });

  return NextResponse.json(treatments);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "sanidad.tratamientos.crear")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = curativeTreatmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d        = parsed.data;
  const tenantId = session.user.tenantId;

  // Obtener días de retiro del medicamento si no se especificaron
  const medicine = await prisma.medicine.findFirst({
    where:  { id: d.medicineId, tenantId },
    select: { withdrawalDays: true },
  });
  if (!medicine) return NextResponse.json({ error: "Medicamento no encontrado" }, { status: 404 });

  const withdrawalDays = d.withdrawalDays || medicine.withdrawalDays;

  const treatment = await prisma.$transaction(async (tx) => {
    const t = await tx.curativeTreatment.create({
      data: {
        tenantId,
        farrowingId:     d.farrowingId    ?? undefined,
        pigletId:        d.pigletId       ?? undefined,
        diagnosisType:   d.diagnosisType,
        diagnosisNotes:  d.diagnosisNotes ?? undefined,
        medicineId:      d.medicineId,
        doseMl:          d.doseMl,
        animalsAffected: d.animalsAffected,
        treatmentDays:   d.treatmentDays,
        startDate:       new Date(d.startDate),
        endDate:         d.endDate ? new Date(d.endDate) : undefined,
        withdrawalDays,
        employeeId:      session.user.id,
      },
    });

    // Crear período de retiro automáticamente si aplica
    if (withdrawalDays > 0) {
      const start = new Date(d.startDate);
      const end   = new Date(start);
      end.setDate(end.getDate() + (d.treatmentDays - 1) + withdrawalDays);
      await tx.withdrawalPeriod.create({
        data: {
          tenantId,
          farrowingId:   d.farrowingId    ?? undefined,
          pigletId:      d.pigletId       ?? undefined,
          medicineId:    d.medicineId,
          treatmentId:   t.id,
          withdrawalDays,
          startDate:     start,
          endDate:       end,
          isActive:      true,
        },
      });
    }

    return t;
  });

  // Crear alerta si hay período de retiro activo cerca de fecha de destete
  if (withdrawalDays > 0 && d.farrowingId) {
    const farrowing = await prisma.farrowingEvent.findUnique({
      where:  { id: d.farrowingId },
      select: { startDatetime: true },
    });
    if (farrowing) {
      const expectedWeaning = new Date(farrowing.startDatetime);
      expectedWeaning.setDate(expectedWeaning.getDate() + 21);
      const retiroEnd = new Date(d.startDate);
      retiroEnd.setDate(retiroEnd.getDate() + withdrawalDays);
      if (retiroEnd > expectedWeaning) {
        await prisma.alert.create({
          data: {
            tenantId,
            alertType:  "WITHDRAWAL_PERIOD_NEAR_WEANING",
            severity:   "WARNING",
            title:      "Período de retiro supera fecha proyectada de destete",
            body:       `Retiro activo hasta: ${retiroEnd.toLocaleDateString("es-PY")} — destete proyectado: ${expectedWeaning.toLocaleDateString("es-PY")}`,
            entityId:   d.farrowingId,
            entityType: "FARROWING",
          },
        });
      }
    }
  }

  return NextResponse.json(treatment, { status: 201 });
}
