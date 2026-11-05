import OpenAI from "openai";

let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// Descarga el audio desde Meta y lo transcribe con Whisper
export async function transcribeAudio(mediaId: string): Promise<string> {
  // 1. Obtener URL del archivo de Meta
  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
  const { url } = await metaRes.json() as { url: string };

  // 2. Descargar el audio
  const audioRes = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  const audioBuffer = await audioRes.arrayBuffer();
  const audioFile   = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });

  // 3. Transcribir con Whisper (español)
  const transcription = await getOpenAI().audio.transcriptions.create({
    file:     audioFile,
    model:    "whisper-1",
    language: "es",
    prompt:   "Transcripción de operario de granja porcina en Paraguay. Puede mencionar números de cerda, cantidades de lechones, pesos en kilogramos.",
  });

  return transcription.text.trim();
}
