// Fase 13 · Reglas puras de pedidos y cotizaciones (se prueban en scripts/pruebas/pedidos.ts).

export type Estado = "BORRADOR" | "PENDIENTE_APROBACION" | "ENVIADO" | "CONFIRMADO" | "RECHAZADO" | "EN_CAMINO" | "ENTREGADO" | "RECIBIDO" | "CANCELADO";
export type Rol = "COMPRADOR" | "APROBADOR" | "VENDEDOR";

export const NOMBRE_ESTADO: Record<Estado, string> = {
  BORRADOR: "Borrador", PENDIENTE_APROBACION: "Esperando aprobación", ENVIADO: "Enviado a la tienda", CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado por la tienda", EN_CAMINO: "En camino", ENTREGADO: "Entregado", RECIBIDO: "Recibido", CANCELADO: "Cancelado",
};
export const COLOR_ESTADO: Record<Estado, string> = {
  BORRADOR: "var(--text-muted)", PENDIENTE_APROBACION: "var(--warning-text)", ENVIADO: "var(--accent)", CONFIRMADO: "var(--accent)",
  RECHAZADO: "var(--danger-text)", EN_CAMINO: "var(--accent)", ENTREGADO: "var(--success-text)", RECIBIDO: "var(--success-text)", CANCELADO: "var(--text-muted)",
};

/** Transiciones permitidas: [desde, hacia, quién, ¿nota obligatoria?] (13.3). */
const TRANSICIONES: [Estado, Estado, Rol, boolean][] = [
  ["BORRADOR", "ENVIADO", "COMPRADOR", false],
  ["BORRADOR", "PENDIENTE_APROBACION", "COMPRADOR", false],
  ["PENDIENTE_APROBACION", "ENVIADO", "APROBADOR", false],
  ["PENDIENTE_APROBACION", "BORRADOR", "APROBADOR", true], // rechazo de la aprobación, con nota
  ["ENVIADO", "CONFIRMADO", "VENDEDOR", false],
  ["ENVIADO", "RECHAZADO", "VENDEDOR", true],
  ["CONFIRMADO", "EN_CAMINO", "VENDEDOR", false],
  ["EN_CAMINO", "ENTREGADO", "VENDEDOR", false],
  ["CONFIRMADO", "RECIBIDO", "COMPRADOR", false], // retiro en el local o entrega sin aviso
  ["EN_CAMINO", "RECIBIDO", "COMPRADOR", false],
  ["ENTREGADO", "RECIBIDO", "COMPRADOR", false],
  ["BORRADOR", "CANCELADO", "COMPRADOR", true],
  ["PENDIENTE_APROBACION", "CANCELADO", "COMPRADOR", true],
  ["ENVIADO", "CANCELADO", "COMPRADOR", true],
  ["CONFIRMADO", "CANCELADO", "COMPRADOR", true],
  ["CONFIRMADO", "CANCELADO", "VENDEDOR", true],
];

/** null si se puede; si no, el motivo. */
export function validarTransicion(desde: Estado, hacia: Estado, rol: Rol, nota: string | null | undefined): string | null {
  const t = TRANSICIONES.find(([d, h, r]) => d === desde && h === hacia && r === rol);
  if (!t) return `No se puede pasar de «${NOMBRE_ESTADO[desde]}» a «${NOMBRE_ESTADO[hacia]}».`;
  if (t[3] && (nota ?? "").trim().length < 3) return "Escribí el motivo.";
  return null;
}

export function accionesPosibles(desde: Estado, rol: Rol): Estado[] {
  return TRANSICIONES.filter(([d, , r]) => d === desde && r === rol).map(([, h]) => h);
}

/**
 * ¿El pedido necesita aprobación? El propietario nunca; un miembro con límite null (sin límite) tampoco;
 * con límite, si el total lo supera (límite 0 = toda compra se aprueba).
 */
export function requiereAprobacion(totalGs: bigint, limiteGs: bigint | null, esPropietario: boolean): boolean {
  if (esPropietario || limiteGs === null) return false;
  return totalGs > limiteGs;
}

/** Subtotal de una línea: cantidad (en unidades de venta) × precio unitario, redondeado a guaraní. */
export function subtotalLinea(cantidad: number, precioUnitarioGs: bigint | number): bigint {
  return BigInt(Math.round(cantidad * Number(precioUnitarioGs)));
}

/** Unidades de venta necesarias para cubrir una cantidad en unidad base (ej. 1.000 kg en bolsas de 40 → 25). */
export function unidadesParaCubrir(cantidadBase: number, contenidoBase: number, pedidoMinimo = 1): number {
  if (!(contenidoBase > 0)) return pedidoMinimo;
  return Math.max(pedidoMinimo, Math.ceil(cantidadBase / contenidoBase - 1e-9));
}

// ── Comparativa de cotizaciones (13.2.4) ──────────────────────────────────
export type ItemRespuesta = { itemId: string; publicacionId?: string | null; descripcion: string; precioUnitarioGs: number; unidadVenta: string; contenidoBase: number; cantidad: number };
export type Respuesta = { id: string; tiendaId: string; tienda: string; items: ItemRespuesta[]; costoEnvioGs: number; plazoDias: number; validaHasta: Date };
export type Celda = { precioBase: number; subtotal: number; item: ItemRespuesta } | null;

export function compararRespuestas(itemIds: string[], respuestas: Respuesta[], hoy: Date) {
  const columnas = respuestas.map(r => {
    const celdas: Record<string, Celda> = {};
    for (const id of itemIds) {
      const it = r.items.find(x => x.itemId === id);
      celdas[id] = it ? { precioBase: it.precioUnitarioGs / it.contenidoBase, subtotal: Math.round(it.cantidad * it.precioUnitarioGs), item: it } : null;
    }
    const cotizados = itemIds.filter(id => celdas[id]).length;
    const subtotal = Object.values(celdas).reduce((s, c) => s + (c?.subtotal ?? 0), 0);
    return { r, celdas, cotizados, completa: cotizados === itemIds.length, subtotal, total: subtotal + r.costoEnvioGs, vencida: r.validaHasta.getTime() < hoy.getTime() };
  });
  // Mejor total entre las completas y vigentes (si ninguna es completa, entre las vigentes con más ítems)
  const vigentes = columnas.filter(c => !c.vencida);
  const maxItems = Math.max(0, ...vigentes.map(c => c.cotizados));
  const candidatas = vigentes.filter(c => c.cotizados === maxItems && maxItems > 0);
  const menorTotal = candidatas.length ? candidatas.reduce((a, b) => (b.total < a.total ? b : a)).r.id : null;
  const menorPlazo = candidatas.length ? candidatas.reduce((a, b) => (b.r.plazoDias < a.r.plazoDias ? b : a)).r.id : null;
  // Menor precio por unidad base en cada ítem
  const mejorPorItem: Record<string, string | null> = {};
  for (const id of itemIds) {
    const con = vigentes.filter(c => c.celdas[id]);
    mejorPorItem[id] = con.length ? con.reduce((a, b) => (b.celdas[id]!.precioBase < a.celdas[id]!.precioBase ? b : a)).r.id : null;
  }
  return { columnas, menorTotal, menorPlazo, mejorPorItem };
}
