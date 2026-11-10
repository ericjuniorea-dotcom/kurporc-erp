// Piezas de vista compartidas entre comprador y tienda (Fase 13).
import { NOMBRE_ESTADO, COLOR_ESTADO, type Estado } from "@/lib/pedidos/reglas";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const gs = (v: bigint | number) => `Gs ${Number(v).toLocaleString("es-PY")}`;
const fh = (d: Date) => d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Asuncion" });

type Item = { id: string; descripcion: string; cantidad: unknown; contenidoBase: unknown; unidadBase: string; precioUnitarioGs: bigint; subtotalGs: bigint; cantidadRecibida: unknown };

export function TablaItems({ items, subtotal, envio, total }: { items: Item[]; subtotal: bigint; envio: bigint; total: bigint }) {
  const recibido = items.some(i => i.cantidadRecibida !== null);
  return (
    <div style={{ ...tarjeta, overflowX: "auto" }}>
      <table className="kp-table" style={{ minWidth: 640 }}>
        <thead><tr><th>Producto</th><th style={{ textAlign: "right" }}>Cantidad</th>{recibido && <th style={{ textAlign: "right" }}>Recibido</th>}<th style={{ textAlign: "right" }}>Precio</th><th style={{ textAlign: "right" }}>Por unidad</th><th style={{ textAlign: "right" }}>Subtotal</th></tr></thead>
        <tbody>
          {items.map(i => {
            const porBase = Number(i.precioUnitarioGs) / Number(i.contenidoBase);
            return (
              <tr key={i.id}>
                <td>{i.descripcion}</td>
                <td style={{ textAlign: "right" }}>{Number(i.cantidad).toLocaleString("es-PY")}</td>
                {recibido && <td style={{ textAlign: "right", color: Number(i.cantidadRecibida) < Number(i.cantidad) ? "var(--warning-text)" : undefined }}>{i.cantidadRecibida === null ? "—" : Number(i.cantidadRecibida).toLocaleString("es-PY")}</td>}
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(i.precioUnitarioGs)}</td>
                <td style={{ textAlign: "right", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>Gs {Math.round(porBase).toLocaleString("es-PY")}/{i.unidadBase.toLowerCase()}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(i.subtotalGs)}</td>
              </tr>
            );
          })}
          <tr><td colSpan={recibido ? 5 : 4} style={{ textAlign: "right", color: "var(--text-secondary)" }}>Subtotal</td><td style={{ textAlign: "right" }}>{gs(subtotal)}</td></tr>
          <tr><td colSpan={recibido ? 5 : 4} style={{ textAlign: "right", color: "var(--text-secondary)" }}>Envío</td><td style={{ textAlign: "right" }}>{envio > 0n ? gs(envio) : "—"}</td></tr>
          <tr style={{ fontWeight: 600 }}><td colSpan={recibido ? 5 : 4} style={{ textAlign: "right" }}>Total</td><td style={{ textAlign: "right" }}>{gs(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function HistoriaPedido({ eventos, actores }: { eventos: { id: string; estado: string; actorId: string; nota: string | null; createdAt: Date }[]; actores: { id: string; name: string }[] }) {
  const nombre = new Map(actores.map(a => [a.id, a.name]));
  return (
    <div style={{ ...tarjeta, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Historia</div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {eventos.map(e => (
          <li key={e.id} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: COLOR_ESTADO[e.estado as Estado], marginTop: 5, flexShrink: 0 }} />
            <div>
              <div><strong>{NOMBRE_ESTADO[e.estado as Estado] ?? e.estado}</strong> <span style={{ color: "var(--text-muted)" }}>· {fh(e.createdAt)} · {nombre.get(e.actorId) ?? "—"}</span></div>
              {e.nota && <div style={{ color: "var(--text-secondary)" }}>{e.nota}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
