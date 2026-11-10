// Fase 12 · Cálculos puros del Mercado (se prueban en scripts/pruebas/mercado.ts).

export type UnidadBase = "KG" | "DOSIS" | "ML" | "UNIDAD" | "LITRO";
export const UNIDAD_CORTA: Record<UnidadBase, string> = { KG: "kg", DOSIS: "dosis", ML: "ml", UNIDAD: "unidad", LITRO: "litro" };
export const UNIDADES: UnidadBase[] = ["KG", "DOSIS", "ML", "UNIDAD", "LITRO"];

/** Precio por unidad base = precio ÷ contenido base (Gs por kg, por dosis, …). */
export function precioPorUnidadBase(precioGs: number | bigint, contenidoBase: number): number | null {
  const p = Number(precioGs);
  if (!(contenidoBase > 0) || !(p > 0)) return null;
  return p / contenidoBase;
}

/** "Gs 2.350/kg" (redondeo a guaraní; con decimales si es menos de 100). */
export function textoPrecioBase(precioGs: number | bigint, contenidoBase: number, unidad: UnidadBase): string | null {
  const v = precioPorUnidadBase(precioGs, contenidoBase);
  if (v === null) return null;
  const n = v < 100 ? v.toLocaleString("es-PY", { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString("es-PY");
  return `Gs ${n}/${UNIDAD_CORTA[unidad]}`;
}

/** Texto a slug de URL: minúsculas, sin acentos, guiones. */
export function slugificar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ñ/g, "n").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "publicacion";
}

/** Palabras de búsqueda normalizadas (sin acentos, minúsculas, sin palabras vacías). */
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "para", "con", "y", "en", "x"]);
export function palabrasBusqueda(q: string): string[] {
  return Array.from(new Set(q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z0-9ñ]+/).filter(w => w.length >= 2 && !VACIAS.has(w)))).slice(0, 8);
}

/** ¿El texto contiene todas las palabras buscadas? (misma regla que la consulta SQL). */
export function coincide(texto: string, q: string): boolean {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return palabrasBusqueda(q).every(w => t.includes(w));
}

/** Reglas de publicación (12.4 / 12.5). Devuelve el motivo por el que no puede quedar ACTIVA, o null. */
export function motivoNoPublicable(d: { tiendaVerificada: boolean; categoriaRequiereVerificacion: boolean; declaracionSanitaria: boolean; fotos: number }): string | null {
  if (!d.tiendaVerificada) return "Tu tienda todavía no está verificada: la publicación queda en borrador hasta que lo esté.";
  if (d.categoriaRequiereVerificacion && !d.declaracionSanitaria) return "Para vender animales tenés que declarar que entregás la documentación sanitaria de traslado exigida por SENACSA.";
  return null;
}
