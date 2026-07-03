import prisma from "@/lib/db/prisma";
import { sendText } from "../sender";
import { WaSession, saveSession, clearFlow } from "../session";
import { diffDays, isoWeekLabel } from "@/lib/utils";

const STEP = {
  ASK_SOW:          "PARTO_ASK_SOW",
  ASK_BORN_ALIVE:   "PARTO_ASK_BORN_ALIVE",
  ASK_BORN_DEAD:    "PARTO_ASK_BORN_DEAD",
  ASK_MUMMIFIED:    "PARTO_ASK_MUMMIFIED",
  ASK_TOTAL_WEIGHT: "PARTO_ASK_TOTAL_WEIGHT",
  ASK_TYPE:         "PARTO_ASK_TYPE",
  CONFIRM:          "PARTO_CONFIRM",
} as const;

const FARROWING_TYPES: Record<string, string> = {
  "1": "NORMAL", "2": "ASSISTED", "3": "CESAREAN", "4": "DYSTOCIA",
};

export async function startPartoFlow(session: WaSession, phone: string): Promise<void> {
  session.context = { flow: "PARTO", step: STEP.ASK_SOW, data: {} };
  await saveSession(session);
  await sendText(phone, "🐷 *Registro de parto*\n\nIngresá el código de la cerda (tatuaje o número):");
}

export async function handlePartoStep(
  session: WaSession,
  phone:   string,
  text:    string
): Promise<void> {
  const step = session.context.step!;
  const data = (session.context.data ?? {}) as Record<string, unknown>;

  if (step === STEP.ASK_SOW) {
    const sow = await prisma.sow.findFirst({
      where: { tenantId: session.tenantId, identCode: text.trim().toUpperCase(), isActive: true },
    });
    if (!sow) {
      await sendText(phone, `❌ No encontré la cerda *${text.trim()}*. Verificá el código y volvé a intentar:`);
      return;
    }
    data.sowId     = sow.id;
    data.sowCode   = sow.identCode;
    data.parityNum = sow.currentParityCount + 1;
    session.context = { ...session.context, step: STEP.ASK_BORN_ALIVE, data };
    await saveSession(session);
    await sendText(phone, `✅ Cerda *${sow.identCode}* — Parto #${data.parityNum}\n\n¿Cuántos lechones nacieron *vivos*?`);
    return;
  }

  if (step === STEP.ASK_BORN_ALIVE) {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n < 0) { await sendText(phone, "⚠️ Ingresá un número válido (0 o más):"); return; }
    data.bornAlive = n;
    session.context = { ...session.context, step: STEP.ASK_BORN_DEAD, data };
    await saveSession(session);
    await sendText(phone, `¿Cuántos nacieron *muertos*? (escribí 0 si ninguno)`);
    return;
  }

  if (step === STEP.ASK_BORN_DEAD) {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n < 0) { await sendText(phone, "⚠️ Ingresá un número válido:"); return; }
    data.bornDead = n;
    session.context = { ...session.context, step: STEP.ASK_MUMMIFIED, data };
    await saveSession(session);
    await sendText(phone, `¿Cuántos *momificados*? (escribí 0 si ninguno)`);
    return;
  }

  if (step === STEP.ASK_MUMMIFIED) {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n < 0) { await sendText(phone, "⚠️ Ingresá un número válido:"); return; }
    data.mummified = n;
    session.context = { ...session.context, step: STEP.ASK_TOTAL_WEIGHT, data };
    await saveSession(session);
    await sendText(phone,
      `📏 *Regla de peso*: pesá TODOS los lechones vivos juntos en la balanza.\n\n¿Cuántos kg pesa la camada completa? (ejemplo: 14.5)`
    );
    return;
  }

  if (step === STEP.ASK_TOTAL_WEIGHT) {
    const w = parseFloat(text.trim().replace(",", "."));
    if (isNaN(w) || w <= 0) { await sendText(phone, "⚠️ Ingresá el peso en kg (ejemplo: 14.5):"); return; }
    data.totalLitterWeightKg = w;
    const bornAlive = data.bornAlive as number;
    if (bornAlive > 0) {
      const avg = (w / bornAlive).toFixed(2);
      data.avgInfo = avg;
      if (parseFloat(avg) < 1.10) {
        await sendText(phone, `⚠️ Peso medio bajo: *${avg} kg* por lechón (mínimo 1,10 kg). Verificá el peso.\n\n¿Tipo de parto?\n1 - Normal\n2 - Asistido\n3 - Cesárea\n4 - Distocia`);
      } else {
        await sendText(phone, `Peso medio calculado: *${avg} kg/lechón* ✅\n\n¿Tipo de parto?\n1 - Normal\n2 - Asistido\n3 - Cesárea\n4 - Distocia`);
      }
    } else {
      await sendText(phone, `¿Tipo de parto?\n1 - Normal\n2 - Asistido\n3 - Cesárea\n4 - Distocia`);
    }
    session.context = { ...session.context, step: STEP.ASK_TYPE, data };
    await saveSession(session);
    return;
  }

  if (step === STEP.ASK_TYPE) {
    const choice = text.trim();
    const type   = FARROWING_TYPES[choice];
    if (!type) {
      await sendText(phone, "⚠️ Respondé con 1, 2, 3 o 4:");
      return;
    }
    data.farrowingType = type;

    // Mostrar resumen para confirmación — REGLA 6
    const bornAlive = data.bornAlive as number;
    const totalW    = data.totalLitterWeightKg as number;
    const avg       = bornAlive > 0 ? (totalW / bornAlive).toFixed(2) : "—";
    const typeLabel = { NORMAL: "Normal", ASSISTED: "Asistido", CESAREAN: "Cesárea", DYSTOCIA: "Distocia" }[type];
    const totalBorn = (data.bornAlive as number) + (data.bornDead as number) + (data.mummified as number);

    const summary = [
      `📋 *RESUMEN DEL PARTO*`,
      `──────────────────`,
      `Cerda: *${data.sowCode}* (Parto #${data.parityNum})`,
      `Nacidos vivos: *${data.bornAlive}*`,
      `Nacidos muertos: *${data.bornDead}*`,
      `Momificados: *${data.mummified}*`,
      `Total nacidos: *${totalBorn}*`,
      `Peso total camada: *${totalW} kg*`,
      `Peso medio: *${avg} kg/lechón*`,
      `Tipo de parto: *${typeLabel}*`,
      `──────────────────`,
      `¿Confirmás el registro? Respondé *SI* o *NO*`,
    ].join("\n");

    session.context = {
      flow: "PARTO",
      step: STEP.CONFIRM,
      data,
      pendingConfirmation: { ...data, startDatetime: new Date().toISOString() },
    };
    await saveSession(session);
    await sendText(phone, summary);
    return;
  }

  if (step === STEP.CONFIRM) {
    const answer = text.trim().toUpperCase();
    if (answer !== "SI" && answer !== "SÍ" && answer !== "NO") {
      await sendText(phone, "Respondé *SI* para confirmar o *NO* para cancelar:");
      return;
    }
    if (answer === "NO") {
      await clearFlow(session);
      await sendText(phone, "❌ Registro cancelado. Escribí *MENU* para volver al menú.");
      return;
    }

    // Guardar en DB
    const conf = session.context.pendingConfirmation as Record<string, unknown>;
    try {
      const totalBorn = (conf.bornAlive as number) + (conf.bornDead as number) + (conf.mummified as number);
      const bornAlive = conf.bornAlive as number;
      const totalW    = conf.totalLitterWeightKg as number;

      await prisma.$transaction(async (tx) => {
        const farrowing = await tx.farrowingEvent.create({
          data: {
            tenantId:            session.tenantId,
            sowId:               conf.sowId as string,
            farrowingType:       conf.farrowingType as any,
            startDatetime:       new Date(),
            bornAlive,
            bornDead:            conf.bornDead as number,
            mummified:           conf.mummified as number,
            totalBorn,
            totalLitterWeightKg: totalW,
            avgPigletWeightKg:   bornAlive > 0 ? totalW / bornAlive : undefined,
            employeeId:          session.userId,
          },
        });
        await tx.sow.update({
          where: { id: conf.sowId as string },
          data:  { currentParityCount: { increment: 1 } },
        });
        return farrowing;
      });

      await clearFlow(session);
      await sendText(phone,
        `✅ *Parto registrado correctamente*\n\nCerda ${conf.sowCode} — ${bornAlive} nacidos vivos.\nEscribí *MENU* para registrar otra operación.`
      );
    } catch {
      await sendText(phone, "❌ Error al guardar. Intentá de nuevo más tarde o contactá al administrador.");
    }
    return;
  }
}
