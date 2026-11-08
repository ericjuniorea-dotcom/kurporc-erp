// Lector mínimo de .xlsx sin dependencias (Fase 8.29): un .xlsx es un ZIP con XML.
// Lee valores ya calculados (no evalúa fórmulas): números, textos compartidos, textos en línea y booleanos.
import { inflateRawSync } from "zlib";

export type Celda = string | number | boolean | null;
export type Hoja = { nombre: string; celdas: Map<string, Celda>; maxFila: number };

/** Todos los archivos de un ZIP (deflate o sin comprimir). */
export function leerZip(buf: Buffer): Map<string, Buffer> {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error("El archivo no es un .xlsx válido");
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Directorio del .xlsx dañado");
    const metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20);
    const lnom = buf.readUInt16LE(p + 28), lext = buf.readUInt16LE(p + 30), lcom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.subarray(p + 46, p + 46 + lnom).toString("utf8");
    const datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const cuerpo = buf.subarray(datos, datos + comp);
    if (comp > 50 * 1024 * 1024) throw new Error("El .xlsx es demasiado grande");
    out.set(nombre, metodo === 8 ? inflateRawSync(cuerpo) : cuerpo);
    p += 46 + lnom + lext + lcom;
  }
  return out;
}

const ent = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const textoDe = (xml: string) => ent(Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), m => m[1]).join(""));

/** Libro completo: hojas por nombre, en el orden del archivo. */
export function leerLibro(buf: Buffer): Map<string, Hoja> {
  const z = leerZip(buf);
  const txt = (n: string) => z.get(n)?.toString("utf8") ?? "";
  const compartidos = Array.from(txt("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g), m => textoDe(m[1]));
  const rels = new Map(Array.from(txt("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g), m => [m[1], m[2]]));
  const hojas = new Map<string, Hoja>();
  for (const m of txt("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const nombre = ent(m[1]);
    const destino = (rels.get(m[2]) ?? "").replace(/^\/?xl\//, "");
    const xml = txt(`xl/${destino}`);
    const celdas = new Map<string, Celda>();
    let maxFila = 0;
    for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, fila, attrs, cuerpo = ""] = c;
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
      let valor: Celda = null;
      if (tipo === "s" && v !== undefined) valor = compartidos[Number(v)] ?? null;
      else if (tipo === "inlineStr") valor = textoDe(cuerpo);
      else if (tipo === "str") valor = v === undefined ? null : ent(v);
      else if (tipo === "b") valor = v === "1";
      else if (tipo === "e") valor = null;
      else if (v !== undefined) valor = Number(v);
      if (valor === null || valor === "") continue;
      celdas.set(`${col}${fila}`, valor);
      if (Number(fila) > maxFila) maxFila = Number(fila);
    }
    hojas.set(nombre, { nombre, celdas, maxFila });
  }
  return hojas;
}

// ── Ayudas de lectura ─────────────────────────────────────────────
export const celda = (h: Hoja, ref: string): Celda => h.celdas.get(ref) ?? null;
export const texto = (h: Hoja, ref: string): string => { const v = celda(h, ref); return v === null ? "" : String(v).trim(); };
export function numero(h: Hoja, ref: string): number | null {
  const v = celda(h, ref);
  if (v === null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
/** Fecha: número de serie de Excel o texto dd/mm/aaaa. Devuelve 'AAAA-MM-DD'. */
export function fecha(h: Hoja, ref: string): string | null {
  const v = celda(h, ref);
  if (v === null) return null;
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86_400_000));
    return d.toISOString().slice(0, 10);
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v).trim());
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  return iso ? iso[0] : null;
}
export function columna(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}
export function indiceColumna(col: string): number {
  return col.split("").reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);
}
