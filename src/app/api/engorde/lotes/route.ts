import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { addDays, diffDays } from "@/lib/utils";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";
import { sitioEnVacio } from "@/lib/engorde/vacio";
import { conActor } from "@/lib/db/actor";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.lotes.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "engorde.lotes.ver" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const soloActivos = req.nextUrl.searchParams.get("estado") === "activo";

  const lotes = await prisma.growingBatch.findMany({
    where: {
      tenantId,
      ...(soloActivos ? { status: "ACTIVE" } : {}),
    },
    include: {
      weightRecords: {
        orderBy: { recordDate: "desc" },
        take: 2,
      },
      deaths: { select: { count: true } },
      otherExits: { select: { exitType: true, count: true } },
      sales: { select: { animalCount: true } },
    },
    orderBy: { entryDate: "desc" },
  });

  const today = new Date();

  const result = lotes.map((l) => {
    const diasAlojamiento = diffDays(new Date(l.entryDate), today);
    const lastPesaje = l.weightRecords[0] ?? null;
    const prevPesaje = l.weightRecords[1] ?? null;

    const totalDeaths = l.deaths.reduce((s, d) => s + d.count, 0);
    const hospitalCount = l.otherExits
      .filter((e) => e.exitType === "HOSPITAL")
      .reduce((s, e) => s + e.count, 0);
    const discardedCount = l.otherExits
      .filter((e) => e.exitType === "DISCARD")
      .reduce((s, e) => s + e.count, 0);

    const avgWeightKg = lastPesaje ? Number(lastPesaje.avgWeightKg) : Number(l.entryWeightKg) / l.currentCount;
    const targetWeightKg = l.targetWeightKg ? Number(l.targetWeightKg) : 120;

    let gdpGramsDia: number | null = null;
    let estimatedExitDate: string | null = null;
    let gdpStatus: "ok" | "warn" | "bad" | null = null;
    let progressPct: number | null = null;

    if (lastPesaje?.dailyGainKg) {
      gdpGramsDia = Math.round(Number(lastPesaje.dailyGainKg) * 1000);
      gdpStatus = gdpGramsDia >= 800 ? "ok" : gdpGramsDia >= 700 ? "warn" : "bad";

      if (gdpGramsDia > 0) {
        const diasRestantes = Math.ceil(((targetWeightKg - avgWeightKg) * 1000) / gdpGramsDia);
        const exitDate = addDays(today, Math.max(0, diasRestantes));
        estimatedExitDate = exitDate.toISOString().split("T")[0];

        const diasTotalesEstimados = diasAlojamiento + Math.max(0, diasRestantes);
        progressPct = diasTotalesEstimados > 0
          ? Math.min(100, Math.round((diasAlojamiento / diasTotalesEstimados) * 100))
          : 0;
      }
    } else if (prevPesaje && lastPesaje) {
      // Calcular GDP manualmente si dailyGainKg no está guardado
      const dias = diffDays(new Date(prevPesaje.recordDate), new Date(lastPesaje.recordDate));
      if (dias > 0) {
        const diff = Number(lastPesaje.avgWeightKg) - Number(prevPesaje.avgWeightKg);
        gdpGramsDia = Math.round((diff / dias) * 1000);
        gdpStatus = gdpGramsDia >= 800 ? "ok" : gdpGramsDia >= 700 ? "warn" : "bad";
      }
    }

    return {
      id: l.id,
      batchCode: l.batchCode,
      sitio: l.sitio,
      procedencia: l.procedencia,
      status: l.status,
      entryDate: l.entryDate.toISOString().split("T")[0],
      currentCount: l.currentCount,
      avgAgeAtEntryDays: l.avgAgeAtEntryDays,
      targetWeightKg,
      employeeId: l.employeeId,
      observations: l.observations,
      closedAt: l.closedAt?.toISOString().split("T")[0] ?? null,
      closedReason: l.closedReason,
      diasAlojamiento,
      avgWeightKg: Math.round(avgWeightKg * 10) / 10,
      lastPesajeFecha: lastPesaje ? lastPesaje.recordDate.toISOString().split("T")[0] : null,
      gdpGramsDia,
      gdpStatus,
      estimatedExitDate,
      progressPct,
      totalDeaths,
      hospitalCount,
      discardedCount,
    };
  });

  return jsonConMontos(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.lotes.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "engorde.lotes.crear" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const {
    batchCode, sitio, procedencia, entryDate, nurseryBatchId,
    currentCount, entryWeightKg, avgAgeAtEntryDays,
    targetWeightKg, employeeId, observations, costoIngresoGs, proveedor,
  } = body;
  const costoCompra = typeof costoIngresoGs === "string" || typeof costoIngresoGs === "number" ? String(costoIngresoGs).replace(/\D/g, "") : "";

  if (!batchCode || !currentCount || !entryWeightKg || !entryDate) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const existe = await prisma.growingBatch.findUnique({
    where: { tenantId_batchCode: { tenantId, batchCode } },
  });
  if (existe) return NextResponse.json({ error: "Ya existe un lote con ese código" }, { status: 409 });

  // Vacío sanitario (Fase 9): el sitio de un lote cerrado no recibe otro hasta cumplir los días configurados
  const vacio = await sitioEnVacio(tenantId, sitio, new Date(entryDate));
  if (vacio) {
    const h = vacio.hasta.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Asuncion" });
    return NextResponse.json({ error: `El sitio «${sitio}» está en vacío sanitario hasta el ${h} (lote ${vacio.lote} cerrado, ${vacio.dias} días). Elegí otro sitio o esperá; el plazo se cambia en Configuración → Engorde.` }, { status: 409 });
  }

  const lote = await prisma.growingBatch.create({
    data: {
      costoIngresoGs: costoCompra ? BigInt(costoCompra) : null,
      tenantId,
      batchCode,
      sitio: sitio || null,
      procedencia: procedencia || "RECRIA_PROPIA",
      entryDate: new Date(entryDate),
      nurseryBatchId: nurseryBatchId || null,
      currentCount: Number(currentCount),
      entryWeightKg: Number(entryWeightKg),
      avgAgeAtEntryDays: avgAgeAtEntryDays ? Number(avgAgeAtEntryDays) : null,
      targetWeightKg: targetWeightKg ? Number(targetWeightKg) : 120,
      employeeId: employeeId || null,
      observations: observations || null,
      status: "ACTIVE",
    },
  });

  // Fase 9: animales comprados a terceros = gasto "Compra de lechones para engorde" (pendiente de pago)
  if ((procedencia === "COMPRA_EXTERNA") && costoCompra && BigInt(costoCompra) > 0n) {
    const [cat, unidad] = await Promise.all([
      prisma.categoriaFinanciera.findFirst({ where: { nombre: "Compra de lechones para engorde", organizacionId: null } }),
      prisma.unidadNegocio.findFirst({ where: { organizacionId: tenantId, tipo: "GRANJA", activa: true }, orderBy: { codigo: "asc" } }),
    ]);
    if (cat && unidad) {
      const prov = proveedor ? String(proveedor).trim().slice(0, 120) : "";
      const cp = prov ? await prisma.contraparte.upsert({ where: { organizacionId_nombre: { organizacionId: tenantId, nombre: prov } }, create: { organizacionId: tenantId, nombre: prov, tipo: "PROVEEDOR" }, update: {} }) : null;
      await conActor(session.user.id, tx => tx.movimiento.create({ data: {
        organizacionId: tenantId, unidadId: unidad.id, granjaId: unidad.granjaId, fecha: new Date(`${String(entryDate).slice(0, 10)}T00:00:00Z`), tipo: "GASTO",
        concepto: `Compra de ${Number(currentCount)} animales · lote ${batchCode}`, categoriaId: cat.id, cantidad: Number(currentCount), unidadMedida: "cabezas",
        contraparteId: cp?.id ?? null, montoGs: BigInt(costoCompra), estado: "PENDIENTE", origenId: lote.id, creadoPor: session.user.id,
      } }));
    }
  }

  return NextResponse.json(lote, { status: 201 });
}
