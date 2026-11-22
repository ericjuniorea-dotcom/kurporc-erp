"use client";
// Alta de un artículo del inventario. Se carga una sola vez; después lo mueven las compras (Finanzas) y los usos.
import { useState, useTransition } from "react";
import { IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { crearProducto } from "@/app/acciones/inventario";
import { InputNumero } from "@/components/ui/input-numero";

const CATEGORIAS = [
  { id: "VACUNA", label: "Vacuna", unidad: "ML" },
  { id: "MEDICAMENTO", label: "Medicamento", unidad: "ML" },
  { id: "SUPLEMENTO", label: "Suplemento", unidad: "ML" },
  { id: "BALANCEADO", label: "Balanceado", unidad: "KG" },
  { id: "EQUIPAMIENTO", label: "Equipamiento e insumos", unidad: "UNIDAD" },
] as const;
const UNIDADES = [{ id: "ML", label: "ml" }, { id: "KG", label: "kg" }, { id: "DOSIS", label: "dosis" }, { id: "UNIDAD", label: "unidades" }, { id: "SACO", label: "sacos" }] as const;

export function NuevoProducto({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]["id"]>("BALANCEADO");
  const [unidad, setUnidad] = useState<(typeof UNIDADES)[number]["id"]>("KG");
  const [minimo, setMinimo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) return (
    <button type="button" className="btn" onClick={() => setAbierto(true)} style={{ height: 32, fontSize: 12, gap: 5, alignSelf: "flex-start" }}>
      <IconPlus size={13} aria-hidden /> Nuevo producto
    </button>
  );
  return (
    <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => {
      const r = await crearProducto({ nombre, categoria, unidadMedida: unidad, stockMinimo: minimo ? Number(minimo) : null, detalle: detalle || undefined })
        .catch(() => ({ ok: false as const, error: "No se pudo. Recargá la página." }));
      if (r.ok) { setNombre(""); setMinimo(""); setDetalle(""); setAbierto(false); onCreado(); } else setError(r.error);
    }); }} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Nuevo producto <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-muted)" }}>· se carga una sola vez</span></div>
        <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={15} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", flex: "2 1 220px" }}>
          Nombre
          <input className="kp-input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} placeholder="Ej: Vilo Baby, Rhiniseng, Jeringas 5 ml" style={{ height: 32 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", flex: "1 1 160px" }}>
          Categoría
          <select className="kp-input" value={categoria} onChange={e => { const c = CATEGORIAS.find(x => x.id === e.target.value)!; setCategoria(c.id); setUnidad(c.unidad); }} style={{ height: 32 }}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", flex: "0 1 120px" }}>
          Se mide en
          <select className="kp-input" value={unidad} onChange={e => setUnidad(e.target.value as typeof unidad)} style={{ height: 32 }}>
            {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", flex: "0 1 130px" }}>
          Stock mínimo
          <InputNumero className="kp-input" inputMode="numeric" value={minimo} onChange={e => setMinimo(e.target.value.replace(/\D/g, ""))} placeholder="opcional" style={{ height: 32 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", flex: "1 1 180px" }}>
          Para qué es
          <input className="kp-input" value={detalle} onChange={e => setDetalle(e.target.value)} maxLength={120} placeholder="Ej: Parvovirus / Leptospirosis" style={{ height: 32 }} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ height: 32, fontSize: 12 }}>
          {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Crear
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
    </form>
  );
}
