// Fase 11 · Explorador de datos de solo lectura (/admin/datos).
// Solo tablas de public con columna de organización; nombres de tabla y columna validados contra
// information_schema (nunca texto libre en el SQL); valores siempre como parámetros.
import "server-only";
import prisma from "@/lib/db/prisma";

export type TablaOrg = { tabla: string; columnaOrg: string };
export type Columna = { nombre: string; tipo: string };

const COLS_ORG = ["organizacion_id", "tenantId", "tenant_id"];
// Datos personales: se muestran enmascarados; "Mostrar" registra un acceso propio
const SENSIBLE = /cedula|documento|ci_|cuenta_banc|cuentaBanc|banco|domicilio|direccion|telefono|celular|salario|sueldo/i;
// Nunca se muestran
const OCULTA = /password|contrasena|token|secret|hash|codigo_verificacion|otp/i;
export const LIMITE = 100;
export const LIMITE_CSV = 50_000;

export async function tablasConOrganizacion(): Promise<TablaOrg[]> {
  const filas = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    select c.table_name, c.column_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = any(${COLS_ORG})
    order by c.table_name`;
  const vistas = new Map<string, string>();
  for (const f of filas) if (!vistas.has(f.table_name)) vistas.set(f.table_name, f.column_name);
  return Array.from(vistas, ([tabla, columnaOrg]) => ({ tabla, columnaOrg })).filter(t => !t.tabla.startsWith("_"));
}

export async function columnasDe(tabla: string): Promise<Columna[]> {
  const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    select column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name = ${tabla} order by ordinal_position`;
  return cols.map(c => ({ nombre: c.column_name, tipo: c.data_type })).filter(c => !OCULTA.test(c.nombre));
}

export const esSensible = (col: string) => SENSIBLE.test(col);
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export type Consulta = { tabla: string; organizacionId: string; columna?: string; valor?: string; desde?: string; hasta?: string; pagina?: number };

/** Valida la consulta contra el catálogo y arma el SQL parametrizado. */
export async function prepararConsulta(c: Consulta) {
  const tablas = await tablasConOrganizacion();
  const t = tablas.find(x => x.tabla === c.tabla);
  if (!t) throw new Error("Tabla no permitida");
  const cols = await columnasDe(t.tabla);
  const nombres = new Set(cols.map(x => x.nombre));
  const params: unknown[] = [c.organizacionId];
  const where = [`${q(t.columnaOrg)}::text = $1`];
  if (c.columna && c.valor && nombres.has(c.columna)) {
    params.push(`%${c.valor}%`);
    where.push(`${q(c.columna)}::text ilike $${params.length}`);
  }
  // Columna de fecha para filtrar y ordenar: la primera de creación o la primera fecha
  const fechaCol = ["fecha", "created_at", "createdAt", "creado_en"].find(n => nombres.has(n))
    ?? cols.find(x => x.tipo.startsWith("timestamp") || x.tipo === "date")?.nombre;
  if (fechaCol && c.desde) { params.push(c.desde); where.push(`${q(fechaCol)} >= $${params.length}::date`); }
  if (fechaCol && c.hasta) { params.push(c.hasta); where.push(`${q(fechaCol)} < ($${params.length}::date + 1)`); }
  const sel = cols.map(x => `${q(x.nombre)}::text as ${q(x.nombre)}`).join(", ");
  const base = `from public.${q(t.tabla)} where ${where.join(" and ")}`;
  const orden = fechaCol ? `order by ${q(fechaCol)} desc nulls last` : "";
  return { t, cols, fechaCol, params, sel, base, orden };
}

export async function consultar(c: Consulta) {
  const p = await prepararConsulta(c);
  const pagina = Math.max(0, c.pagina ?? 0);
  const [filas, total] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, string | null>[]>(`select ${p.sel} ${p.base} ${p.orden} limit ${LIMITE} offset ${pagina * LIMITE}`, ...p.params),
    prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n ${p.base}`, ...p.params).then(r => Number(r[0]?.n ?? 0)),
  ]);
  return { columnas: p.cols, fechaCol: p.fechaCol ?? null, filas, total, pagina };
}

export async function consultarTodo(c: Consulta) {
  const p = await prepararConsulta(c);
  const filas = await prisma.$queryRawUnsafe<Record<string, string | null>[]>(`select ${p.sel} ${p.base} ${p.orden} limit ${LIMITE_CSV}`, ...p.params);
  return { columnas: p.cols, filas };
}

export function enmascarar(v: string | null): string {
  if (!v) return "";
  return v.length <= 3 ? "•••" : `${"•".repeat(Math.min(8, v.length - 2))}${v.slice(-2)}`;
}

export function aCsv(columnas: Columna[], filas: Record<string, string | null>[], mostrar: Set<string>): string {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cab = columnas.map(c => esc(c.nombre)).join(",");
  const cuerpo = filas.map(f => columnas.map(c => {
    const v = f[c.nombre] ?? "";
    return esc(esSensible(c.nombre) && !mostrar.has(c.nombre) ? enmascarar(v) : v);
  }).join(","));
  return "﻿" + [cab, ...cuerpo].join("\n");
}
