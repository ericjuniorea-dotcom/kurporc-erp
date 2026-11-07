// Cifrado de campos sensibles en la aplicación (Fase 2.4).
// AES-256-GCM. Formato guardado: "<versión de clave>:<base64(iv 12 | tag 16 | datos)>".
// Para rotar la clave: agregar CAMPOS_CIFRADOS_KEY_K2, cambiar VERSION_ACTUAL a "k2"
// y re-cifrar en segundo plano; los valores "k1:" se siguen pudiendo leer.
//
// Campos cifrados: cédula de funcionarios (y, cuando existan: cuenta bancaria,
// número de IPS, domicilio particular, documentos de vendedores).
// Los sueldos NO se cifran (Finanzas los suma): los protege el permiso rrhh.sueldos.ver.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const VERSION_ACTUAL = "k1";
const ENV_POR_VERSION: Record<string, string> = { k1: "CAMPOS_CIFRADOS_KEY" };

export class ErrorCifrado extends Error {}

function clave(version: string): Buffer {
  const nombre = ENV_POR_VERSION[version];
  const valor = nombre ? process.env[nombre] : undefined;
  if (!valor) throw new ErrorCifrado(`Falta la variable de entorno ${nombre ?? `de la clave ${version}`}`);
  const buf = Buffer.from(valor, "base64");
  if (buf.length !== 32) throw new ErrorCifrado(`${nombre} debe tener 32 bytes en base64`);
  return buf;
}

export function estaCifrado(valor: string | null | undefined): boolean {
  return !!valor && /^k\d+:/.test(valor);
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(VERSION_ACTUAL), iv);
  const datos = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return `${VERSION_ACTUAL}:${Buffer.concat([iv, cipher.getAuthTag(), datos]).toString("base64")}`;
}

export function descifrar(valor: string): string {
  const sep = valor.indexOf(":");
  if (sep < 0 || !estaCifrado(valor)) return valor; // dato viejo todavía en claro
  const version = valor.slice(0, sep);
  const buf = Buffer.from(valor.slice(sep + 1), "base64");
  const decipher = createDecipheriv("aes-256-gcm", clave(version), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Huella para buscar sin descifrar (ej. funcionario por cédula). Normaliza puntos, guiones y espacios. */
export function huella(texto: string): string {
  const k = process.env.CAMPOS_HMAC_KEY;
  if (!k) throw new ErrorCifrado("Falta la variable de entorno CAMPOS_HMAC_KEY");
  const normal = texto.replace(/[\s.\-]/g, "").toUpperCase();
  return createHmac("sha256", Buffer.from(k, "base64")).update(normal).digest("hex");
}

/** "4.123.456" → "•••••456". Para mostrar sin permiso de datos personales. */
export function enmascarar(texto: string | null | undefined, visibles = 3): string | null {
  if (!texto) return null;
  const limpio = texto.replace(/[\s.\-]/g, "");
  return "•".repeat(Math.max(0, limpio.length - visibles)) + limpio.slice(-visibles);
}
