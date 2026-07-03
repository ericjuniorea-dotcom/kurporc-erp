import prisma from "@/lib/db/prisma";
import { sendText } from "./sender";
import { WaSession, saveSession, clearFlow } from "./session";
import { startPartoFlow, handlePartoStep }   from "./flows/parto";
import { startMuerteFlow, handleMuerteStep } from "./flows/muerte";
import { startPesajeFlow, handlePesajeStep } from "./flows/pesaje";

const MENU = [
  "👋 *Menú principal KurPorc*",
  "",
  "¿Qué querés registrar?",
  "1️⃣  Parto",
  "2️⃣  Muerte de lechón",
  "3️⃣  Pesaje de lote",
  "",
  "Escribí el número de la opción o *CANCELAR* para interrumpir la operación actual.",
].join("\n");

export async function routeMessage(
  session: WaSession,
  phone:   string,
  text:    string
): Promise<void> {
  const normalized = text.trim().toUpperCase();

  // Comandos globales
  if (normalized === "MENU" || normalized === "MENÚ" || normalized === "INICIO") {
    await clearFlow(session);
    await sendText(phone, MENU);
    return;
  }

  if (normalized === "CANCELAR" || normalized === "CANCEL") {
    if (session.context.flow) {
      await clearFlow(session);
      await sendText(phone, "❌ Operación cancelada.\n\n" + MENU);
    } else {
      await sendText(phone, MENU);
    }
    return;
  }

  // Sin flujo activo → menú o iniciar flujo
  if (!session.context.flow) {
    switch (normalized) {
      case "1": return startPartoFlow(session, phone);
      case "2": return startMuerteFlow(session, phone);
      case "3": return startPesajeFlow(session, phone);
      default:
        await sendText(phone, MENU);
        return;
    }
  }

  // Flujo activo → delegar al handler correspondiente
  switch (session.context.flow) {
    case "PARTO":         return handlePartoStep(session, phone, text);
    case "MUERTE_LECHON": return handleMuerteStep(session, phone, text);
    case "PESAJE":        return handlePesajeStep(session, phone, text);
    default:
      await clearFlow(session);
      await sendText(phone, MENU);
  }
}
