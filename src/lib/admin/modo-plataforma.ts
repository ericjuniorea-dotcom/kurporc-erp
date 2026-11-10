// Fase 11 · "Ver todo": un Super Administrador TOTAL o SOPORTE abre el ERP de una organización en
// MODO PLATAFORMA: solo lectura (permisos *.ver), banner visible y cada request registrado en
// acceso_plataforma. La cookie va firmada (HMAC) y dura lo mismo que el motivo: 2 horas.
// Las escrituras las corta el middleware (cualquier POST/PUT/PATCH/DELETE fuera de /admin y /auth).
// Sin dependencias de auth/config para evitar ciclos: lo usa getSession.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/db/prisma";
import { ipDe } from "@/lib/seguridad/auditoria";

export const COOKIE_PLATAFORMA = "kp_plataforma";
export const DURACION_MS = 2 * 60 * 60 * 1000;

export type ModoPlataforma = { org: string; motivo: string; detalle: string; hasta: number; admin: string };

function clave() {
  const k = process.env.CAMPOS_HMAC_KEY;
  if (!k && process.env.NODE_ENV === "production") throw new Error("Falta CAMPOS_HMAC_KEY");
  return `modo-plataforma:${k ?? "desarrollo"}`;
}
const firmar = (s: string) => createHmac("sha256", clave()).update(s).digest("base64url");

export function codificar(m: ModoPlataforma): string {
  const cuerpo = Buffer.from(JSON.stringify(m)).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function decodificar(v: string | undefined): ModoPlataforma | null {
  if (!v) return null;
  const [cuerpo, firma] = v.split(".");
  if (!cuerpo || !firma) return null;
  const esperada = Buffer.from(firmar(cuerpo)), dada = Buffer.from(firma);
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
  try {
    const m = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as ModoPlataforma;
    return m.hasta > Date.now() ? m : null;
  } catch { return null; }
}

/** Modo plataforma vigente para este administrador (ya verificado como TOTAL/SOPORTE con aal2 por quien llama). */
export async function leerModoPlataforma(userId: string): Promise<ModoPlataforma | null> {
  const m = decodificar((await cookies()).get(COOKIE_PLATAFORMA)?.value);
  return m && m.admin === userId ? m : null;
}

/** Una fila por request del ERP visto en modo plataforma (páginas y lecturas de la API). */
export async function registrarVistaPlataforma(m: ModoPlataforma) {
  const h = await headers();
  const ruta = h.get("x-ruta") ?? "ERP";
  await prisma.accesoPlataforma.create({
    data: { adminId: m.admin, organizacionId: m.org, seccion: `ERP ${ruta}`.slice(0, 200), motivo: m.motivo, detalleMotivo: m.detalle || null, exportacion: false, ip: ipDe(h) },
  }).catch(e => console.error("[acceso_plataforma]", e));
}
