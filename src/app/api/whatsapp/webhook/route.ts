import { NextRequest, NextResponse } from "next/server";
import { resolveSession, logMessage } from "@/lib/whatsapp/session";
import { transcribeAudio }            from "@/lib/whatsapp/whisper";
import { routeMessage }               from "@/lib/whatsapp/router";
import { sendText }                   from "@/lib/whatsapp/sender";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "kurporc_verify";

// Meta verifica el webhook con un GET challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Webhook principal — recibe mensajes entrantes
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Meta espera 200 inmediatamente; procesar de forma asíncrona
  processWebhook(body).catch(console.error);
  return NextResponse.json({ ok: true });
}

async function processWebhook(body: Record<string, unknown>) {
  const entry   = (body?.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
  const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
  const value   = changes?.value as Record<string, unknown> | undefined;
  const messages = value?.messages as unknown[] | undefined;

  if (!messages?.length) return;

  const rawMsg = messages[0] as Record<string, unknown>;
  const phone  = (rawMsg.from as string | undefined)?.replace(/\D/g, "") ?? "";
  if (!phone) return;

  const waMessageId = rawMsg.id as string | undefined;

  // Resolver sesión (identifica tenant + user por número de teléfono)
  const session = await resolveSession(phone);
  if (!session) {
    // Número no registrado en el sistema
    await sendText(phone, "⚠️ Tu número no está registrado en KurPorc. Contactá al administrador de tu granja.");
    return;
  }

  let textContent = "";
  let transcript: string | undefined;

  if (rawMsg.type === "text") {
    textContent = ((rawMsg.text as Record<string, unknown>)?.body as string) ?? "";
  } else if (rawMsg.type === "audio") {
    // Transcribir con Whisper
    const mediaId = ((rawMsg.audio as Record<string, unknown>)?.id as string) ?? "";
    try {
      transcript  = await transcribeAudio(mediaId);
      textContent = transcript;
      await sendText(phone, `🎙️ _Escuché: "${transcript}"_`);
    } catch {
      await sendText(phone, "⚠️ No pude transcribir el audio. Por favor escribí el mensaje.");
      return;
    }
  } else if (rawMsg.type === "interactive") {
    // Lista interactiva — extraer el ID de la fila seleccionada
    const interactive = rawMsg.interactive as Record<string, unknown>;
    const listReply   = interactive?.list_reply as Record<string, unknown> | undefined;
    textContent       = (listReply?.id as string) ?? (listReply?.title as string) ?? "";
  } else {
    await sendText(phone, "⚠️ Solo acepto texto o audio. Escribí *MENU* para ver las opciones.");
    return;
  }

  if (!textContent.trim()) return;

  // Loguear mensaje entrante
  await logMessage(session.id, "IN", textContent, waMessageId, transcript);

  // Enrutar al flujo correspondiente
  await routeMessage(session, phone, textContent);
}
