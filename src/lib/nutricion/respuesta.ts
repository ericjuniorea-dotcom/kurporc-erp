// Rutas GET de Nutrición: convierten los errores de permisos/datos en JSON con mensaje en castellano.
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ErrorPermiso } from "@/lib/permisos/servidor";

export async function responder<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ErrorPermiso) return NextResponse.json({ error: "No tenés permiso para ver Nutrición." }, { status: 403 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    const msg = e instanceof Error ? e.message : "";
    if (msg && !/prisma|database|connect/i.test(msg) && msg.length < 200) return NextResponse.json({ error: msg }, { status: 400 });
    console.error("[nutricion/api]", e);
    return NextResponse.json({ error: "No se pudo cargar. Probá de nuevo." }, { status: 500 });
  }
}
