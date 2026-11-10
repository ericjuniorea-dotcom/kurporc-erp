"use server";
// Acciones del Mercado del lado del comprador (Fase 12): favoritos y denuncias.
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { consumirIntento } from "@/lib/seguridad/limites";

type R = { ok: true; favorito?: boolean } | { ok: false; error: string };
const MOTIVOS = ["ENGANOSA", "PROHIBIDA", "PRECIO", "SIN_DOCUMENTACION", "OTRO"] as const;

export async function alternarFavorito(publicacionId: string): Promise<R> {
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Ingresá para guardar favoritos." };
  const p = await prisma.publicacion.findUnique({ where: { id: publicacionId }, select: { slug: true } });
  if (!p) return { ok: false, error: "La publicación no existe." };
  const clave = { userId_publicacionId: { userId: u.id, publicacionId } };
  const ya = await prisma.favorito.findUnique({ where: clave });
  if (ya) await prisma.favorito.delete({ where: clave });
  else await prisma.favorito.create({ data: { userId: u.id, publicacionId } });
  revalidatePath(`/mercado/p/${p.slug}`);
  return { ok: true, favorito: !ya };
}

export async function denunciarPublicacion(publicacionId: string, motivo: string, detalle: string): Promise<R> {
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Ingresá para denunciar una publicación." };
  if (!MOTIVOS.includes(motivo as typeof MOTIVOS[number])) return { ok: false, error: "Elegí un motivo." };
  if (!(await consumirIntento("sugerencias", `denuncia:${u.id}`))) return { ok: false, error: "Enviaste muchas denuncias hoy. Probá mañana." };
  if (!(await prisma.publicacion.findUnique({ where: { id: publicacionId }, select: { id: true } }))) return { ok: false, error: "La publicación no existe." };
  const abierta = await prisma.denunciaPublicacion.findFirst({ where: { publicacionId, userId: u.id, estado: "ABIERTA" }, select: { id: true } });
  if (abierta) return { ok: true };
  await prisma.denunciaPublicacion.create({ data: { publicacionId, userId: u.id, motivo, detalle: detalle.trim().slice(0, 1000) || null } });
  return { ok: true };
}
