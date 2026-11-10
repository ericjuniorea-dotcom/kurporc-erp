"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { responderCotizacion } from "@/app/acciones/vendedor-pedidos";
import { unidadesParaCubrir, type ItemRespuesta } from "@/lib/pedidos/reglas";

type Item = { id: string; nombre: string; unidadBase: string; cantidadBase: number; nota: string | null; productoId: string };
type Pub = { id: string; titulo: string; productoId: string; precioGs: number; unidadVenta: string; contenidoBase: number; pedidoMinimo: number; plazo: number };
type Fila = { cotiza: boolean; publicacionId: string; descripcion: string; precio: string; unidadVenta: string; contenido: string; cantidad: string };

const en = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);

export function FormRespuesta({ solicitudId, items, publicaciones, previa, abierta }: {
  solicitudId: string; items: Item[]; publicaciones: Pub[]; abierta: boolean;
  previa: { items: ItemRespuesta[]; costoEnvioGs: number; plazoDias: number; validaHasta: string; nota: string } | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const desdePub = (it: Item, p: Pub | undefined): Fila => p
    ? { cotiza: true, publicacionId: p.id, descripcion: `${p.titulo} · ${p.unidadVenta}`, precio: String(p.precioGs), unidadVenta: p.unidadVenta, contenido: String(p.contenidoBase), cantidad: String(unidadesParaCubrir(it.cantidadBase, p.contenidoBase, p.pedidoMinimo)) }
    : { cotiza: false, publicacionId: "", descripcion: it.nombre, precio: "", unidadVenta: "", contenido: "", cantidad: "" };
  const [filas, setFilas] = useState<Fila[]>(items.map(it => {
    const prev = previa?.items.find(x => x.itemId === it.id);
    if (prev) return { cotiza: true, publicacionId: prev.publicacionId ?? "", descripcion: prev.descripcion, precio: String(prev.precioUnitarioGs), unidadVenta: prev.unidadVenta, contenido: String(prev.contenidoBase), cantidad: String(prev.cantidad) };
    return desdePub(it, publicaciones.find(p => p.productoId === it.productoId));
  }));
  const [envio, setEnvio] = useState(String(previa?.costoEnvioGs ?? 0));
  const [plazo, setPlazo] = useState(String(previa?.plazoDias ?? Math.max(1, ...publicaciones.map(p => p.plazo), 0)));
  const [valida, setValida] = useState(previa?.validaHasta ?? en(7));
  const [nota, setNota] = useState(previa?.nota ?? "");
  const set = (i: number, cambio: Partial<Fila>) => setFilas(fs => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const total = filas.reduce((s, f) => s + (f.cotiza ? (Number(f.precio) || 0) * (Number(f.cantidad) || 0) : 0), 0) + (Number(envio) || 0);
  const cel: React.CSSProperties = { width: 100 };

  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => {
      const r = await responderCotizacion({
        solicitudId, costoEnvioGs: Number(envio) || 0, plazoDias: Number(plazo) || 0, validaHasta: valida, nota,
        items: filas.map((f, i) => ({ f, it: items[i] })).filter(x => x.f.cotiza).map(({ f, it }) => ({
          itemId: it.id, publicacionId: f.publicacionId || null, descripcion: f.descripcion, precioUnitarioGs: Number(f.precio), unidadVenta: f.unidadVenta, contenidoBase: Number(f.contenido.replace(",", ".")), cantidad: Number(f.cantidad),
        })),
      });
      setMsg(r.ok ? { ok: true, t: "Cotización enviada. El cliente recibe un aviso." } : { ok: false, t: r.error });
      if (r.ok) router.refresh();
    }); }} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <fieldset disabled={!abierta} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="kp-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Pide</th><th>Cotizo</th><th>Con</th><th>Precio (Gs)</th><th>Presentación</th><th>Contiene</th><th>Cantidad</th><th style={{ textAlign: "right" }}>Subtotal</th></tr></thead>
            <tbody>{items.map((it, i) => {
              const f = filas[i];
              const mias = publicaciones.filter(p => p.productoId === it.productoId);
              return (
                <tr key={it.id}>
                  <td style={{ fontSize: 12.5 }}>{it.nombre}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.cantidadBase.toLocaleString("es-PY")} {it.unidadBase.toLowerCase()}{it.nota ? ` · ${it.nota}` : ""}</div></td>
                  <td><input type="checkbox" checked={f.cotiza} onChange={e => set(i, { cotiza: e.target.checked })} aria-label={`Cotizar ${it.nombre}`} /></td>
                  <td>
                    <select className="kp-input" value={f.publicacionId} disabled={!f.cotiza} onChange={e => set(i, desdePub(it, mias.find(p => p.id === e.target.value)))} style={{ minWidth: 160 }}>
                      <option value="">Sin publicación</option>
                      {mias.map(p => <option key={p.id} value={p.id}>{p.titulo} · {p.unidadVenta}</option>)}
                    </select>
                  </td>
                  <td><input className="kp-input" inputMode="numeric" value={f.precio} disabled={!f.cotiza} required={f.cotiza} onChange={e => set(i, { precio: e.target.value.replace(/\D/g, "") })} style={cel} /></td>
                  <td><input className="kp-input" value={f.unidadVenta} disabled={!f.cotiza} required={f.cotiza} onChange={e => set(i, { unidadVenta: e.target.value, descripcion: f.publicacionId ? f.descripcion : `${it.nombre} · ${e.target.value}` })} placeholder="Bolsa 40 kg" style={{ width: 120 }} /></td>
                  <td><span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><input className="kp-input" inputMode="decimal" value={f.contenido} disabled={!f.cotiza} required={f.cotiza} onChange={e => set(i, { contenido: e.target.value, cantidad: String(unidadesParaCubrir(it.cantidadBase, Number(e.target.value.replace(",", ".")) || 0)) })} style={{ width: 70 }} /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.unidadBase.toLowerCase()}</span></span></td>
                  <td><input className="kp-input" type="number" min={0} step="any" value={f.cantidad} disabled={!f.cotiza} required={f.cotiza} onChange={e => set(i, { cantidad: e.target.value })} style={{ width: 80 }} /></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.cotiza ? `Gs ${((Number(f.precio) || 0) * (Number(f.cantidad) || 0)).toLocaleString("es-PY")}` : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {([["Envío (Gs)", envio, setEnvio, "numeric"], ["Plazo de entrega (días)", plazo, setPlazo, "numeric"]] as const).map(([l, v, s]) => (
            <label key={l} style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>{l}<input className="kp-input" inputMode="numeric" value={v} onChange={e => s(e.target.value.replace(/\D/g, ""))} /></label>
          ))}
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Válida hasta<input className="kp-input" type="date" value={valida} onChange={e => setValida(e.target.value)} required /></label>
        </div>
        <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Nota para el cliente<textarea className="kp-input" rows={2} value={nota} maxLength={1000} onChange={e => setNota(e.target.value)} style={{ height: "auto", padding: 8 }} placeholder="Formas de pago, marcas alternativas, condiciones…" /></label>
      </fieldset>
      <div style={{ fontSize: 14 }}>Total: <strong>Gs {Math.round(total).toLocaleString("es-PY")}</strong></div>
      {msg && <div role="status" style={{ fontSize: 13, color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</div>}
      {abierta && <button type="submit" className="btn btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={pendiente || !filas.some(f => f.cotiza)}>
        {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} {previa ? "Actualizar cotización" : "Enviar cotización"}
      </button>}
    </form>
  );
}
