// Documentos legales versionados y aceptaciones (Fase 4).
// Los textos viven en la tabla documento_legal; acá solo se leen, se completan
// con los datos del operador y se registra quién aceptó qué versión.
import { createHash } from "crypto";
import prisma from "@/lib/db/prisma";

/** Documentos que toda persona debe aceptar para usar KurPorc. */
export const CODIGOS_OBLIGATORIOS_PERSONA = ["TERMINOS", "PRIVACIDAD"] as const;

/** La frase exacta de la casilla (decisión 18: una sola casilla). Se guarda con cada aceptación. */
export const TEXTO_CASILLA =
  "Soy mayor de 18 años y acepto los Términos y Condiciones y la Política de Privacidad de KurPorc.";

export const RUTA_DOCUMENTO: Record<string, string> = {
  TERMINOS: "/terminos",
  PRIVACIDAD: "/privacidad",
};

export function hashTexto(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

const A_COMPLETAR = "[a completar]";

export async function datosOperador() {
  const c = await prisma.configuracionPlataforma.findUnique({ where: { id: 1 } });
  return {
    razon_social: c?.razonSocial || A_COMPLETAR,
    ruc: c?.ruc || A_COMPLETAR,
    domicilio: c?.domicilio || A_COMPLETAR,
    correo_contacto: c?.correoContacto || A_COMPLETAR,
    correo_privacidad: c?.correoPrivacidad || c?.correoContacto || A_COMPLETAR,
    ciudad_jurisdiccion: c?.ciudadJurisdiccion || "Asunción",
    whatsapp_soporte: c?.whatsappSoporte ?? "",
  };
}

/** Reemplaza {{campo}} por los datos del operador. Es el texto que ve y acepta la persona. */
export function completar(texto: string, datos: Record<string, string>): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, campo) => datos[campo] ?? m);
}

export type DocumentoVisible = {
  id: string; codigo: string; version: string; titulo: string;
  resumen: string; contenido: string; hashMostrado: string;
  vigenteDesde: Date | null; aprobadoPorAsesor: boolean; requiereReaceptacion: boolean;
};

/** Versión publicada más reciente de un documento, con los datos del operador ya completados. */
export async function documentoVigente(codigo: string): Promise<DocumentoVisible | null> {
  const d = await prisma.documentoLegal.findFirst({
    where: { codigo, estado: "PUBLICADO" },
    orderBy: [{ vigenteDesde: "desc" }, { createdAt: "desc" }],
  });
  if (!d) return null;
  const datos = await datosOperador();
  const contenido = completar(d.contenidoMd, datos);
  return {
    id: d.id, codigo: d.codigo, version: d.version, titulo: d.titulo,
    resumen: completar(d.resumen, datos), contenido,
    hashMostrado: hashTexto(contenido),
    vigenteDesde: d.vigenteDesde, aprobadoPorAsesor: d.aprobadoPorAsesor,
    requiereReaceptacion: d.requiereReaceptacion,
  };
}

/**
 * Documentos obligatorios que la persona todavía no aceptó en su versión vigente.
 * Si la versión nueva no exige reaceptación, alcanza con haber aceptado una anterior.
 */
export async function pendientesPersona(userId: string): Promise<DocumentoVisible[]> {
  const pendientes: DocumentoVisible[] = [];
  const aceptaciones = await prisma.aceptacionDocumento.findMany({
    where: { userId, codigo: { in: [...CODIGOS_OBLIGATORIOS_PERSONA] }, aceptado: true },
    select: { codigo: true, documentoId: true },
  });
  for (const codigo of CODIGOS_OBLIGATORIOS_PERSONA) {
    const vigente = await documentoVigente(codigo);
    if (!vigente) continue; // sin documento publicado no se puede exigir
    const delCodigo = aceptaciones.filter(a => a.codigo === codigo);
    const aceptoEsta = delCodigo.some(a => a.documentoId === vigente.id);
    const aceptoAlguna = delCodigo.length > 0;
    if (!aceptoEsta && (vigente.requiereReaceptacion || !aceptoAlguna)) pendientes.push(vigente);
  }
  return pendientes;
}

/** ¿Le falta aceptar algo? Versión liviana para cada request. */
export async function tienePendientes(userId: string): Promise<boolean> {
  const vigentes = await prisma.documentoLegal.findMany({
    where: { codigo: { in: [...CODIGOS_OBLIGATORIOS_PERSONA] }, estado: "PUBLICADO" },
    orderBy: [{ vigenteDesde: "desc" }, { createdAt: "desc" }],
    select: { id: true, codigo: true, requiereReaceptacion: true },
  });
  const ultimo = new Map<string, (typeof vigentes)[number]>();
  for (const v of vigentes) if (!ultimo.has(v.codigo)) ultimo.set(v.codigo, v);
  if (ultimo.size === 0) return false;

  const aceptaciones = await prisma.aceptacionDocumento.findMany({
    where: { userId, codigo: { in: Array.from(ultimo.keys()) }, aceptado: true },
    select: { codigo: true, documentoId: true },
  });
  return Array.from(ultimo.values()).some(v => {
    const delCodigo = aceptaciones.filter(a => a.codigo === v.codigo);
    return !delCodigo.some(a => a.documentoId === v.id) && (v.requiereReaceptacion || delCodigo.length === 0);
  });
}

export interface ContextoAceptacion { ip: string | null; userAgent: string | null; metodo: string }

/** Guarda la aceptación de las versiones vigentes indicadas. La tabla es de solo agregar. */
export async function registrarAceptaciones(userId: string, docs: DocumentoVisible[], ctx: ContextoAceptacion) {
  if (docs.length === 0) return;
  await prisma.$transaction([
    prisma.aceptacionDocumento.createMany({
      data: docs.map(d => ({
        userId, documentoId: d.id, codigo: d.codigo, version: d.version,
        hashSha256: d.hashMostrado, aceptado: true, textoCasilla: TEXTO_CASILLA,
        ip: ctx.ip, userAgent: ctx.userAgent, metodo: ctx.metodo,
      })),
    }),
    prisma.user.update({ where: { id: userId }, data: { declaraMayorEdad: true } }),
  ]);
}
