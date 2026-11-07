"use server";
// Cambiar la organización activa (D4): se valida contra `miembro` antes de escribir la cookie.
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { COOKIE_ORG, getUsuario } from "@/lib/auth/config";

const esquema = z.string().min(1).max(64);

export async function cambiarOrganizacion(organizacionId: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = esquema.safeParse(organizacionId);
  if (!parsed.success) return { ok: false, error: "Organización inválida" };

  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Sesión vencida" };

  const miembro = await prisma.miembro.findFirst({
    where: { userId: usuario.id, organizacionId: parsed.data, estado: "ACTIVO", organizacion: { estado: "ACTIVA" } },
    select: { id: true },
  });
  if (!miembro) return { ok: false, error: "No pertenecés a esa organización" };

  (await cookies()).set(COOKIE_ORG, parsed.data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
