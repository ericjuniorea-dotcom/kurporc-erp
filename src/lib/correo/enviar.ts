// Fase 15.2 · Aviso por correo (Resend). Solo avisa: el dato ya está guardado en la base.
// Sin RESEND_API_KEY no hace nada y no falla. Nunca incluir texto escrito por clientes.
import "server-only";

export const SITIO = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.kurporc.com").replace(/\/$/, "");

export async function enviarAviso(datos: { para: string; asunto: string; texto: string }): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "KurPorc <no-responder@kurporc.com>", to: [datos.para], subject: datos.asunto, text: datos.texto }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) { console.error("[correo] Resend respondió", r.status); return false; }
    return true;
  } catch (e) {
    console.error("[correo] no se pudo enviar", e);
    return false;
  }
}
