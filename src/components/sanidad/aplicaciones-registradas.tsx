"use client";
// Sanidad · vacunas aplicadas en los últimos días. Quien tiene el permiso «anular» (lo da el Administrador General)
// puede anular una aplicación con motivo: vuelve el stock al lote, la vacuna queda pendiente de nuevo y se ve
// quién la anuló, cuándo y por qué.
import { useCallback, useEffect, useState } from "react";
import { IconChevronDown, IconChevronUp, IconLoader2, IconX } from "@tabler/icons-react";

type Fila = { id: string; fecha: string; vacuna: string; unidad: string; dosis: number; a: string; responsable: string; lote: string | null;
  observaciones: string | null; anulada: { quien: string | null; cuando: string; motivo: string | null } | null };

const fecha = (iso: string) => new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const UNIDAD: Record<string, string> = { ML: "ml", DOSIS: "dosis", KG: "kg", UNIDAD: "u.", SACO: "sacos" };

export function AplicacionesRegistradas() {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<{ filas: Fila[]; puedeAnular: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetch("/api/sanidad/aplicaciones?dias=30", { cache: "no-store" }).then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? "No se pudo cargar.");
      setDatos(j);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar."));
  }, []);
  useEffect(() => { if (abierto && !datos) cargar(); }, [abierto, datos, cargar]);

  const anular = async (f: Fila) => {
    const motivo = window.prompt(`Anular la aplicación de ${f.vacuna} a ${f.a} (${fecha(f.fecha)}).\nVuelve el stock al lote, la vacuna queda pendiente otra vez y queda registrado quién la anuló.\n\n¿Por qué la anulás?`);
    if (motivo === null) return;
    if (motivo.trim().length < 3) { setError("Escribí el motivo para anular."); return; }
    setAnulando(f.id); setError(null);
    try {
      const r = await fetch(`/api/sanidad/aplicaciones/${f.id}/anular`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim() }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) setError(j?.error ?? "No se pudo anular."); else cargar();
    } catch { setError("No se pudo anular. Probá de nuevo."); }
    setAnulando(null);
  };

  return (
    <section style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }} aria-label="Aplicaciones registradas">
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: "var(--bg-elevated)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
        Aplicaciones registradas (últimos 30 días)
        {abierto ? <IconChevronUp size={14} aria-hidden /> : <IconChevronDown size={14} aria-hidden />}
      </button>
      {abierto && (
        <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {error && <div role="alert" style={{ fontSize: 12.5, color: "var(--danger-text)" }}>{error}</div>}
          {!datos ? <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}><IconLoader2 size={14} className="animate-spin" aria-hidden /> Cargando…</div>
            : datos.filas.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No hay aplicaciones en los últimos 30 días.</div>
            : datos.filas.map(f => (
              <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", padding: "8px 10px", borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--border-default)", background: f.anulada ? "var(--bg-overlay)" : "var(--bg-surface)" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 13, color: f.anulada ? "var(--text-muted)" : "var(--text-primary)" }}>
                  <div style={{ textDecoration: f.anulada ? "line-through" : "none" }}>
                    <strong style={{ fontWeight: 600 }}>{f.vacuna}</strong> · {f.a} · {f.dosis.toLocaleString("es-PY")} {UNIDAD[f.unidad] ?? ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fecha(f.fecha)} · aplicó {f.responsable}{f.lote ? ` · lote ${f.lote}` : ""}</div>
                  {f.anulada && <div style={{ fontSize: 12, color: "var(--danger-text)" }}>Anulada{f.anulada.quien ? ` por ${f.anulada.quien}` : ""} el {fecha(f.anulada.cuando)}{f.anulada.motivo ? ` · «${f.anulada.motivo}»` : ""}</div>}
                </div>
                {datos.puedeAnular && !f.anulada && (
                  <button type="button" className="btn" disabled={anulando === f.id} onClick={() => anular(f)} style={{ color: "var(--danger-text)", fontSize: 12 }}>
                    {anulando === f.id ? <IconLoader2 size={13} className="animate-spin" aria-hidden /> : <IconX size={13} aria-hidden />} Anular
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
