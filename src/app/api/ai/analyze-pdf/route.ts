import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const EXTRACTION_PROMPT = `Eres un nutricionista especializado en nutrición porcina de alta precisión.
Se te proporciona un análisis de laboratorio o certificado de calidad de una materia prima.

Extraé EXACTAMENTE los siguientes valores nutricionales (devolvé null si no aparece en el documento):
- crudProteinPct: Proteína cruda / Proteína bruta (%)
- metabolizableEnergyKcal: Energía Metabolizable (kcal/kg)
- lysinePct: Lisina total (%)
- methioninePct: Metionina total (%)
- calciumPct: Calcio (Ca) (%)
- phosphorusPct: Fósforo total (%)
- moisturePct: Humedad (%)
- mycotoxinPpb: Micotoxinas totales (ppb) — suma DON+ZEA+Aflatoxina si aparece; si solo se reporta una, usá ese valor

Responde SOLO con un objeto JSON válido, sin explicaciones:
{
  "materialName": "nombre de la materia prima",
  "lotCode": "código de lote si aparece",
  "supplier": "proveedor si aparece",
  "crudProteinPct": número o null,
  "metabolizableEnergyKcal": número o null,
  "lysinePct": número o null,
  "methioninePct": número o null,
  "calciumPct": número o null,
  "phosphorusPct": número o null,
  "moisturePct": número o null,
  "mycotoxinPpb": número o null,
  "notes": "observaciones relevantes del documento",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo roles con acceso al módulo de Balanceado
  const allowed = [1, 2, 4, 6];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const formData = await req.formData();
  const file     = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Archivo PDF requerido" }, { status: 400 });
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "El PDF no puede superar 10 MB" }, { status: 400 });
  }

  const buffer  = await file.arrayBuffer();
  const base64  = Buffer.from(buffer).toString("base64");

  const message = await getClient().messages.create({
    model:      "claude-opus-4-8",
    max_tokens: 1024,
    messages:   [
      {
        role:    "user",
        content: [
          {
            type:   "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as any,
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let result: Record<string, unknown>;
  try {
    // Extraer JSON de la respuesta (puede venir envuelto en backticks)
    const match = raw.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : { error: "No se pudo parsear la respuesta", raw };
  } catch {
    result = { error: "Respuesta inválida de la IA", raw };
  }

  return NextResponse.json(result);
}
