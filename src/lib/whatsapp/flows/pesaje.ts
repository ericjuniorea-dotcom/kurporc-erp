import prisma from "@/lib/db/prisma";
import { sendText } from "../sender";
import { WaSession, saveSession, clearFlow } from "../session";

const STEP = {
  ASK_BATCH:        "PESAJE_ASK_BATCH",
  ASK_COUNT:        "PESAJE_ASK_COUNT",
  ASK_TOTAL_WEIGHT: "PESAJE_ASK_TOTAL_WEIGHT",
  CONFIRM:          "PESAJE_CONFIRM",
} as const;

export async function startPesajeFlow(session: WaSession, phone: string): Promise<void> {
  session.context = { flow: "PESAJE", step: STEP.ASK_BATCH, data: {} };
  await saveSession(session);
  await sendText(phone, "⚖️ *Registro de pesaje*\n\nIngresá el código del lote (ej: R-2026-W25-001):");
}

export async function handlePesajeStep(
  session: WaSession,
  phone:   string,
  text:    string
): Promise<void> {
  const step = session.context.step!;
  const data = (session.context.data ?? {}) as Record<string, unknown>;

  if (step === STEP.ASK_BATCH) {
    const batch = await prisma.nurseryBatch.findFirst({
      where:   { tenantId: session.tenantId, batchCode: text.trim().toUpperCase(), isActive: true },
      include: { weightRecords: { orderBy: { recordDate: "desc" }, take: 1, select: { avgWeightKg: true } } },
    });
    if (!batch) {
      await sendText(phone, `❌ No encontré el lote *${text.trim()}*. Verificá el código:`);
      return;
    }
    data.batchId   = batch.id;
    data.batchCode = batch.batchCode;
    data.lastAvg   = batch.weightRecords[0]?.avgWeightKg ?? null;
    session.context = { ...session.context, step: STEP.ASK_COUNT, data };
    await saveSession(session);
    const lastInfo = data.lastAvg ? `\nÚltimo peso medio: *${Number(data.lastAvg).toFixed(2)} kg*` : "";
    await sendText(phone, `✅ Lote *${batch.batchCode}* — Fase ${batch.phase === "PHASE_1" ? "1" : "2"} — ${batch.currentCount} animales.${lastInfo}\n\n¿Cuántos animales se pesaron hoy?`);
    return;
  }

  if (step === STEP.ASK_COUNT) {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n <= 0) { await sendText(phone, "⚠️ Ingresá un número válido:"); return; }
    data.animalCount = n;
    session.context  = { ...session.context, step: STEP.ASK_TOTAL_WEIGHT, data };
    await saveSession(session);
    await sendText(phone, `¿Cuántos kg pesaron *en total* los ${n} animales? (sumá todos y decime el total)`);
    return;
  }

  if (step === STEP.ASK_TOTAL_WEIGHT) {
    const w = parseFloat(text.trim().replace(",", "."));
    if (isNaN(w) || w <= 0) { await sendText(phone, "⚠️ Ingresá el peso en kg (ejemplo: 85.5):"); return; }
    data.totalWeightKg = w;
    const avg = (w / (data.animalCount as number)).toFixed(2);
    data.avgWeightKg   = parseFloat(avg);

    // Calcular GDP si hay pesaje anterior
    let gdpInfo = "";
    if (data.lastAvg) {
      const gdp = parseFloat(avg) - Number(data.lastAvg);
      gdpInfo = `\nVariación vs anterior: *${gdp > 0 ? "+" : ""}${(gdp * 1000).toFixed(0)} g/día* (aprox.)`;
    }

    const summary = [
      `📋 *RESUMEN DEL PESAJE*`,
      `──────────────────`,
      `Lote: *${data.batchCode}*`,
      `Animales pesados: *${data.animalCount}*`,
      `Peso total: *${w} kg*`,
      `Peso medio: *${avg} kg/animal*${gdpInfo}`,
      `──────────────────`,
      `¿Confirmás? Respondé *SI* o *NO*`,
    ].join("\n");

    session.context = {
      flow: "PESAJE",
      step: STEP.CONFIRM,
      data,
      pendingConfirmation: { ...data },
    };
    await saveSession(session);
    await sendText(phone, summary);
    return;
  }

  if (step === STEP.CONFIRM) {
    const answer = text.trim().toUpperCase();
    if (answer !== "SI" && answer !== "SÍ" && answer !== "NO") {
      await sendText(phone, "Respondé *SI* o *NO*:");
      return;
    }
    if (answer === "NO") {
      await clearFlow(session);
      await sendText(phone, "❌ Pesaje cancelado. Escribí *MENU* para volver al menú.");
      return;
    }

    const conf = session.context.pendingConfirmation as Record<string, unknown>;
    try {
      const batchId    = conf.batchId as string;
      const totalW     = conf.totalWeightKg as number;
      const count      = conf.animalCount as number;
      const avgW       = conf.avgWeightKg as number;

      // Buscar pesaje anterior para GDP
      const prev = await prisma.weightRecord.findFirst({
        where:   { nurseryBatchId: batchId },
        orderBy: { recordDate: "desc" },
        select:  { recordDate: true, avgWeightKg: true },
      });

      let dailyGainKg: number | null = null;
      if (prev) {
        const days = (Date.now() - new Date(prev.recordDate).getTime()) / 86400000;
        if (days > 0) dailyGainKg = (avgW - Number(prev.avgWeightKg)) / days;
      }

      await prisma.$transaction(async (tx) => {
        await tx.weightRecord.create({
          data: {
            tenantId:      session.tenantId,
            nurseryBatchId: batchId,
            recordDate:    new Date(),
            totalWeightKg: totalW,
            animalCount:   count,
            avgWeightKg:   avgW,
            dailyGainKg:   dailyGainKg ?? undefined,
            employeeId:    session.userId,
          },
        });
        await tx.nurseryBatch.update({
          where: { id: batchId },
          data:  { avgWeightKg: avgW, currentWeightKg: totalW },
        });
      });

      await clearFlow(session);
      await sendText(phone,
        `✅ *Pesaje registrado* — Lote ${conf.batchCode}\nPeso medio: *${avgW.toFixed(2)} kg/animal*\n\nEscribí *MENU* para continuar.`
      );
    } catch {
      await sendText(phone, "❌ Error al guardar. Contactá al administrador.");
    }
    return;
  }
}
