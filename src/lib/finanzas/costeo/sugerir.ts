// Finanzas · costeo por etapa: sugerencia de subcategoría y etapa a partir de la categoría del libro.
// Funciones puras (sin base): las usan la migración (Fase 2), el servidor al guardar y el formulario al precargar.

export type SubSugerible = { id: string; codigo: string; modo: string; etapaCodigo: string | null; nombresAnteriores: string[] };

export const normalizar = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Subcategoría sugerida para un movimiento. `null` = no es un gasto (ingreso, préstamo, cuota, aporte): no se clasifica.
 * `undefined` = es gasto pero su categoría no tiene equivalente (va a «Otros gastos» para revisar).
 */
export function sugerirSubcategoria<S extends SubSugerible>(subs: S[], tipo: string, categoriaNombre: string, esVacuna = false): S | null | undefined {
  const nombre = normalizar(categoriaNombre);
  const porCodigo = (c: string) => subs.find(s => s.codigo === c);
  const porNombre = subs.find(s => s.nombresAnteriores.some(n => normalizar(n) === nombre));
  if (tipo === "INGRESO") return null;
  if (tipo === "FINANCIAMIENTO") return porNombre && porNombre.modo !== "INVERSION" ? porNombre : null; // solo intereses
  if (nombre === "sanidad") return porCodigo(esVacuna ? "SAN-01" : "SAN-02");
  if (tipo === "INVERSION") {
    if (porNombre?.modo === "INVERSION") return porNombre;
    return porCodigo(nombre.includes("matri") || nombre.includes("reproduc") ? "INV-03" : "INV-02");
  }
  return porNombre;
}

/** Etapa y revisión que corresponden a una subcategoría según su modo de registro. */
export function etapaPorModo(sub: { modo: string; etapaCodigo: string | null }): { etapaCodigo: string | null; revision: string | null } {
  if (sub.modo === "INVENTARIO") return { etapaCodigo: sub.etapaCodigo ?? null, revision: null }; // el costo lo da la etapa que consume
  if (sub.modo === "INVERSION") return { etapaCodigo: "INV", revision: null };
  if (sub.modo === "REPARTO") return { etapaCodigo: sub.etapaCodigo ?? "CMP", revision: null };
  return sub.etapaCodigo ? { etapaCodigo: sub.etapaCodigo, revision: null } : { etapaCodigo: null, revision: "Indicá a qué etapa corresponde" };
}

/** Reparte un monto por porcentajes (la última parte absorbe el redondeo, así la suma da exacto). */
export function repartirMonto(monto: bigint, porcentajes: number[]): bigint[] {
  let resto = monto;
  return porcentajes.map((p, i) => {
    if (i === porcentajes.length - 1) return resto;
    const parte = (monto * BigInt(Math.round(p * 100))) / 10_000n;
    resto -= parte;
    return parte;
  });
}
