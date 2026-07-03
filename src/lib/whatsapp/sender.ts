// Envío de mensajes vía Meta WhatsApp Business API
const WA_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

export async function sendText(to: string, text: string): Promise<void> {
  await fetch(WA_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to,
      type:              "text",
      text:              { preview_url: false, body: text },
    }),
  });
}

export async function sendList(
  to:       string,
  header:   string,
  body:     string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
): Promise<void> {
  await fetch(WA_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to,
      type:              "interactive",
      interactive: {
        type:   "list",
        header: { type: "text", text: header },
        body:   { text: body },
        action: { button: "Ver opciones", sections },
      },
    }),
  });
}
