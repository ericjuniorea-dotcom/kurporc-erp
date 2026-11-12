"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconBuildingWarehouse, IconLoader2, IconScale } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export function EncabezadoFicha() {
  return <Topbar title="Iniciación" icon={IconBuildingWarehouse} iconColor="var(--info)" actions={<a href="/recria" className="btn">Volver a Iniciación</a>} configHref="/configuracion?modulo=RECRIA&tab=Metas" />;
}

const hoyISO = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

/** Cargar el peso promedio del lote: con la cantidad de animales pesados se guarda el total (pesaje por muestreo). */
export function CargarPesaje({ loteId, animales }: { loteId: string; animales: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [promedio, setPromedio] = useState("");
  const [pesados, setPesados] = useState(String(animales));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (!abierto) return <button className="btn btn-primary" style={{ height: 34 }} onClick={() => setAbierto(true)}><IconScale size={15} aria-hidden /> Cargar peso promedio</button>;
  const prom = Number(promedio.replace(",", ".")), n = Math.floor(Number(pesados));
  return (
    <form onSubmit={e => {
      e.preventDefault(); setError(null);
      if (!(prom > 0) || !(n > 0)) { setError("Indicá el peso promedio y cuántos animales pesaste."); return; }
      iniciar(async () => {
        const r = await fetch(`/api/nursery-batches/${loteId}/weight-records`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordDate: fecha, totalWeightKg: Math.round(prom * n * 1000) / 1000, animalCount: n }) });
        if (r.ok) { setAbierto(false); setPromedio(""); router.refresh(); }
        else { const j = await r.json().catch(() => ({})); setError(typeof j.error === "string" ? j.error : "No se pudo guardar el pesaje."); }
      });
    }} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 12 }}>
      <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Fecha<input className="kp-input" type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} required /></label>
      <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Peso promedio (kg)<input className="kp-input" inputMode="decimal" value={promedio} onChange={e => setPromedio(e.target.value)} placeholder="12,5" style={{ width: 110 }} required autoFocus /></label>
      <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Animales pesados<input className="kp-input" type="number" min={1} value={pesados} onChange={e => setPesados(e.target.value)} style={{ width: 110 }} required /></label>
      <button type="submit" className="btn btn-primary" style={{ height: 34 }} disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar</button>
      <button type="button" className="btn" style={{ height: 34 }} onClick={() => setAbierto(false)}>Cancelar</button>
      {prom > 0 && n > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total: {(prom * n).toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg</span>}
      {error && <div role="alert" style={{ width: "100%", fontSize: 12.5, color: "var(--danger-text)" }}>{error}</div>}
    </form>
  );
}
