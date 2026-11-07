"use server";
// Aceptación de los documentos obligatorios (Fase 4, decisión 18: una sola casilla).
import { headers } from "next/headers";
import { z } from "zod";
import { getUsuario } from "@/lib/auth/config";
import { pendientesPersona, registrarAceptaciones } from "@/lib/legal/documentos";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

const esquema = z.object({
  acepta: z.literal(true, { errorMap: () => ({ message: "Tenés que tildar la casilla para continuar" }) }),
  documentos: z.array(z.object({ id: z.string().uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(5),
}).strict();

export async function aceptarContrato(datos: { acepta: boolean; documentos: { id: string; hash: string }[] }):
  Promise<{ ok: true } | { ok: false; error: string; recargar?: boolean }> {
  const p = esquema.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };

  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  // Se vuelve a leer lo vigente: lo aceptado tiene que ser exactamente lo que se mostró
  const pendientes = await pendientesPersona(usuario.id);
  const mostrados = new Map(p.data.documentos.map(d => [d.id, d.hash]));
  const coincide = pendientes.every(d => mostrados.get(d.id) === d.hashMostrado);
  if (!coincide) {
    return { ok: false, error: "Los documentos se actualizaron mientras estabas en esta pantalla. Recargá para ver la versión nueva.", recargar: true };
  }

  const h = await headers();
  const ctx = { ip: ipDe(h), userAgent: userAgentDe(h) };
  await registrarAceptaciones(usuario.id, pendientes, { ...ctx, metodo: "CASILLA" });
  await registrarAuditoria("CONTRATO_ACEPTADO", "documento_legal", null,
    { documentos: pendientes.map(d => `${d.codigo} ${d.version}`) }, { ...ctx, actorId: usuario.id });
  return { ok: true };
}
