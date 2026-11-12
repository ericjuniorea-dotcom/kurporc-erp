import prisma from "@/lib/db/prisma";
import { sendText } from "../sender";
import { WaSession, saveSession, clearFlow } from "../session";

import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
const STEP = {
  ASK_SOW:      "MUERTE_ASK_SOW",
  ASK_QUANTITY: "MUERTE_ASK_QUANTITY",
  ASK_CAUSE:    "MUERTE_ASK_CAUSE",
  CONFIRM:      "MUERTE_CONFIRM",
} as const;

const CAUSES: Record<string, { code: string; label: string }> = {
  "1":  { code: "WEAKNESS",    label: "Debilidad" },
  "2":  { code: "CRUSHING",    label: "Aplastamiento" },
  "3":  { code: "DIARRHEA",    label: "Diarrea" },
  "4":  { code: "DEFICIENT",   label: "Deficiencia nutricional" },
  "5":  { code: "DISEASE",     label: "Enfermedad" },
  "6":  { code: "SHELTER",     label: "Sin abrigo/Hipotermia" },
  "7":  { code: "HYPOTHERMIA", label: "Hipotermia" },
  "8":  { code: "ACCIDENT",    label: "Accidente" },
  "9":  { code: "CONGENITAL",  label: "Defecto congénito" },
  "10": { code: "ELIMINATED",  label: "Eliminado (baja viabilidad)" },
  "11": { code: "OTHER",       label: "Otra causa" },
};

const CAUSES_MENU = Object.entries(CAUSES)
  .map(([k, v]) => `${k} - ${v.label}`)
  .join("\n");

export async function startMuerteFlow(session: WaSession, phone: string): Promise<void> {
  session.context = { flow: "MUERTE_LECHON", step: STEP.ASK_SOW, data: {} };
  await saveSession(session);
  await sendText(phone, "💀 *Registro de muerte de lechón*\n\nIngresá el código de la cerda:");
}

export async function handleMuerteStep(
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
      await sendText(phone, `❌ No encontré la cerda *${text.trim()}*. Verificá el código:`);
      return;
    }
    // Buscar parto activo (sin destete)
    const farrowing = await prisma.farrowingEvent.findFirst({
      where:   { tenantId: session.tenantId, sowId: sow.id, id: { in: await idsCamadasAbiertas(session.tenantId) } },
      orderBy: { startDatetime: "desc" },
    });
    if (!farrowing) {
      await sendText(phone, `❌ La cerda *${sow.identCode}* no tiene un parto activo actualmente.`);
      return;
    }
    data.sowCode    = sow.identCode;
    data.farrowingId = farrowing.id;
    session.context = { ...session.context, step: STEP.ASK_QUANTITY, data };
    await saveSession(session);
    await sendText(phone, `✅ Cerda *${sow.identCode}* — parto activo encontrado.\n\n¿Cuántos lechones murieron?`);
    return;
  }

  if (step === STEP.ASK_QUANTITY) {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n <= 0) { await sendText(phone, "⚠️ Ingresá un número mayor a 0:"); return; }
    data.quantity = n;
    session.context = { ...session.context, step: STEP.ASK_CAUSE, data };
    await saveSession(session);
    await sendText(phone, `¿Cuál fue la causa?\n\n${CAUSES_MENU}`);
    return;
  }

  if (step === STEP.ASK_CAUSE) {
    const choice = text.trim();
    const cause  = CAUSES[choice];
    if (!cause) {
      await sendText(phone, `⚠️ Elegí un número del 1 al 11:\n\n${CAUSES_MENU}`);
      return;
    }
    data.causeCode  = cause.code;
    data.causeLabel = cause.label;

    const summary = [
      `📋 *RESUMEN — MUERTE DE LECHÓN*`,
      `──────────────────`,
      `Cerda: *${data.sowCode}*`,
      `Cantidad: *${data.quantity}*`,
      `Causa: *${data.causeLabel}*`,
      `──────────────────`,
      `¿Confirmás? Respondé *SI* o *NO*`,
    ].join("\n");

    session.context = {
      flow: "MUERTE_LECHON",
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
      await sendText(phone, "❌ Registro cancelado. Escribí *MENU* para volver al menú.");
      return;
    }

    const conf = session.context.pendingConfirmation as Record<string, unknown>;
    try {
      await prisma.pigletDeath.create({
        data: {
          tenantId:     session.tenantId,
          farrowingId:  conf.farrowingId as string,
          deathDatetime: new Date(),
          quantity:     conf.quantity as number,
          cause:        conf.causeCode as any,
          employeeId:   session.userId,
        },
      });
      await clearFlow(session);
      await sendText(phone,
        `✅ *Muerte registrada*\n${conf.quantity} lechón(es) — Causa: ${conf.causeLabel}\n\nEscribí *MENU* para continuar.`
      );
    } catch {
      await sendText(phone, "❌ Error al guardar. Contactá al administrador.");
    }
    return;
  }
}
