"use server";
// Consultas, problemas y sugerencias desde cualquier pantalla (soporte@kurporc.com).
// Cualquier persona con sesión puede mandar; solo el equipo de plataforma las lee y responde.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { getAdmin } from "@/lib/admin/acceso";
import { consumirIntento } from "@/lib/seguridad/limites";

type R = { ok: true } | { ok: false; error: string };

const esquema = z.object({
  tipo: z.enum(["CONSULTA", "SUGERENCIA", "PROBLEMA"]),
  mensaje: z.string().trim().min(3, "Contanos un poco más.").max(4000, "Máximo 4.000 caracteres."),
  pagina: z.string().max(300).optional(),
});

export async function enviarSugerencia(datos: { tipo: string; mensaje: string; pagina?: string }): Promise<R> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Iniciá sesión para enviarla." };
  const p = esquema.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  if (!(await consumirIntento("sugerencias", usuario.id))) return { ok: false, error: "Ya mandaste muchas hoy. Escribinos a soporte@kurporc.com." };
  const session = await getSession().catch(() => null);
  await prisma.sugerencia.create({ data: {
    usuarioId: usuario.id, organizacionId: session?.user.tenantId ?? null,
    tipo: p.data.tipo, mensaje: p.data.mensaje, pagina: p.data.pagina?.slice(0, 300) || null,
  } });
  return { ok: true };
}

const cambio = z.object({
  id: z.string().uuid(),
  estado: z.enum(["NUEVA", "EN_REVISION", "HECHA", "DESCARTADA"]),
  respuesta: z.string().trim().max(4000).optional(),
});

export async function actualizarSugerencia(datos: { id: string; estado: string; respuesta?: string }): Promise<R> {
  const a = await getAdmin();
  if (!a || !a.verificado || !["TOTAL", "SOPORTE"].includes(a.nivel)) return { ok: false, error: "Sin permiso." };
  const p = cambio.safeParse(datos);
  if (!p.success) return { ok: false, error: "Datos inválidos" };
  await prisma.sugerencia.update({ where: { id: p.data.id }, data: { estado: p.data.estado, respuesta: p.data.respuesta || null } });
  revalidatePath("/admin/sugerencias");
  return { ok: true };
}

/** Lo que mandó la persona y lo que le respondimos (para que vea que se tuvo en cuenta). */
export async function misSugerencias() {
  const usuario = await getUsuario();
  if (!usuario) return [];
  const filas = await prisma.sugerencia.findMany({
    where: { usuarioId: usuario.id }, orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, tipo: true, mensaje: true, estado: true, respuesta: true, createdAt: true },
  });
  return filas.map(f => ({ ...f, createdAt: f.createdAt.toISOString() }));
}
