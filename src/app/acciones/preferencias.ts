"use server";
// Configuración → Generales: preferencias de cada persona (no de la granja). Solo cambia su propio usuario.
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";

export async function guardarAyudaIndicadores(activa: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Tu sesión se cerró. Ingresá de nuevo." };
  try {
    await prisma.user.update({ where: { id: u.id }, data: { ayudaIndicadores: activa === true } });
    return { ok: true };
  } catch (e) {
    console.error("[preferencias]", e);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
}
