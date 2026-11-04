"use client";
import { useState, useEffect, useCallback } from "react";
import {
  IconCalendar, IconCheck, IconClock, IconWeight, IconPackage,
  IconLoader2, IconRefresh, IconDeviceFloppy,
} from "@tabler/icons-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DiaItem {
  id:             string;
  tipo:           string;
  label:          string;
  fase:           string;
  faseKey:        string;
  feedTypeId:     string | null;
  feedTypeName:   string;
  animalesCount:  number;
  kgRecomendados: number;
  kgEntregados:   number | null;
  recordId:       string | null;
  empleadoId:     string | null;
}
interface Summary {
  total: number; registrados: number; pendientes: number; totalKgHoy: number; totalKgEstimado: number;
}

// ─── Colores por fase ──────────────────────────────────────────────────────────
const FASE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  "Lactancia":  { bg: "var(--warning-subtle)", color: "var(--warning-text)",  border: "var(--warning-border)"  },
  "Iniciación F1": { bg: "var(--info-subtle)",    color: "var(--info-text)",     border: "var(--info-border)"     },
  "Iniciación F2": { bg: "var(--info-subtle)",    color: "var(--info-text)",     border: "var(--info-border)"     },
  "Engorde":    { bg: "var(--success-subtle)", color: "var(--success-text)",  border: "var(--success-border)"  },
  "Gestación":  { bg: "var(--accent-subtle)",  color: "var(--accent-text)",   border: "var(--accent-border)"   },
};

// ─── Diferencia ────────────────────────────────────────────────────────────────
function diffColor(diff: number) {
  return Math.abs(diff) <= 2 ? "var(--success)" : Math.abs(diff) <= 5 ? "var(--warning)" : "var(--danger)";
}

// ─── Fila individual ───────────────────────────────────────────────────────────
function FilaAlimento({
  item, onSave, saving,
}: {
  item: DiaItem;
  onSave: (id: string, feedTypeId: string, kg: number, tipo: string) => Promise<void>;
  saving: string | null;
}) {
  const [kg, setKg] = useState<string>(item.kgEntregados !== null ? String(item.kgEntregados) : "");
  const done    = item.kgEntregados !== null;
  const savingMe = saving === item.id;

  const kgNum = parseFloat(kg) || 0;
  const diff  = kgNum - item.kgRecomendados;

  const faseStyle = FASE_STYLE[item.fase] ?? { bg: "var(--bg-overlay)", color: "var(--text-muted)", border: "var(--border-default)" };

  const inputBorder = kg === "" ? "var(--warning)" : kgNum === 0 ? "var(--danger)" : "var(--border-default)";

  return (
    <tr style={{ opacity: done ? 1 : 0.85, transition: "opacity 0.2s" }}>
      {/* Estado */}
      <td style={{ width: 42, textAlign: "center" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 5, margin: "0 auto",
          border: `0.5px solid ${done ? "var(--success-border)" : "var(--border-default)"}`,
          background: done ? "var(--success-subtle)" : "var(--bg-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {done
            ? <IconCheck size={14} style={{ color: "var(--success)" }} />
            : <IconClock size={14} style={{ color: "var(--text-muted)" }} />}
        </div>
      </td>

      {/* Animal / Lote */}
      <td>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>{item.feedTypeName}</span>
      </td>

      {/* Fase */}
      <td>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 500,
          background: faseStyle.bg, color: faseStyle.color, border: `0.5px solid ${faseStyle.border}`,
        }}>
          {item.fase}
        </span>
      </td>

      {/* Animales */}
      <td style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
        {item.animalesCount}
      </td>

      {/* Kg recomendados */}
      <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {item.kgRecomendados}
      </td>

      {/* Kg entregados (editable) */}
      <td>
        <input
          type="number" min={0} step={0.5}
          value={kg}
          onChange={e => setKg(e.target.value)}
          placeholder="0"
          style={{
            background: "var(--bg-overlay)",
            border: `0.5px solid ${inputBorder}`,
            borderRadius: 5, padding: "4px 7px", fontSize: 11,
            color: "var(--text-primary)", width: 72, textAlign: "right",
          }}
        />
      </td>

      {/* Diferencia */}
      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
        {kg !== "" && kgNum > 0 && (
          <span style={{ color: diffColor(diff), fontWeight: 500 }}>
            {diff === 0 ? "±0" : diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
          </span>
        )}
      </td>

      {/* Guardar fila */}
      <td style={{ textAlign: "center" }}>
        <button
          className="btn"
          disabled={savingMe || kg === ""}
          onClick={() => item.feedTypeId && onSave(item.id, item.feedTypeId, kgNum, item.tipo)}
          style={{ fontSize: 10, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
        >
          {savingMe
            ? <IconLoader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
            : <IconDeviceFloppy size={11} />}
          {done ? "Actualizar" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

// ─── KPI Strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ summary, fecha }: { summary: Summary; fecha: string }) {
  const d = new Date(fecha + "T00:00:00");
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const label = `${dayNames[d.getDay()]} ${d.toLocaleDateString("es-PY")}`;

  const CARDS = [
    { icon: IconCalendar, label: "Hoy",          value: label,                         color: "var(--text-primary)" },
    { icon: IconCheck,    label: "Registrados",  value: `${summary.registrados} de ${summary.total}`, color: "var(--success)" },
    { icon: IconClock,    label: "Pendientes",   value: summary.pendientes,             color: summary.pendientes > 0 ? "var(--warning)" : "var(--success)" },
    { icon: IconWeight,   label: "Total kg hoy", value: `${summary.totalKgHoy.toFixed(1)} kg`,        color: "var(--text-primary)" },
    { icon: IconPackage,  label: "Estimado día", value: `${summary.totalKgEstimado.toFixed(1)} kg`,   color: "var(--text-muted)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
      {CARDS.map(({ icon: Icon, label, value, color }) => (
        <div key={label} style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)", padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <Icon size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color, lineHeight: 1.2 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Resumen Strip por tipo ────────────────────────────────────────────────────
function ResumenStrip({ items }: { items: DiaItem[] }) {
  const byFeed = new Map<string, { name: string; kg: number; total: number; done: number }>();
  for (const i of items) {
    const cur = byFeed.get(i.feedTypeName) ?? { name: i.feedTypeName, kg: 0, total: 0, done: 0 };
    cur.total++;
    if (i.kgEntregados !== null) { cur.kg += i.kgEntregados; cur.done++; }
    byFeed.set(i.feedTypeName, cur);
  }
  const tipos = Array.from(byFeed.values());
  if (tipos.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {tipos.map(t => {
        const allDone = t.done === t.total;
        return (
          <div key={t.name} style={{
            background: allDone ? "var(--success-subtle)" : "var(--warning-subtle)",
            border: `0.5px solid ${allDone ? "var(--success-border)" : "var(--warning-border)"}`,
            borderRadius: "var(--radius-md)", padding: "8px 12px", minWidth: 130,
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{t.name}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: allDone ? "var(--success)" : "var(--warning)", lineHeight: 1 }}>
              {allDone ? `${t.kg.toFixed(1)} kg` : "Pendiente"}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              {t.done}/{t.total} registros
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Panel de stock ────────────────────────────────────────────────────────────
function StockPanel() {
  const [stock, setStock] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/alimentacion/stock")
      .then(r => r.ok ? r.json() : [])
      .then(d => setStock(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  if (stock.length === 0) return null;

  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", overflow: "hidden",
    }}>
      <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-overlay)" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Stock de producto terminado
        </span>
      </div>
      <table className="kp-table">
        <thead>
          <tr>
            <th>Tipo de alimento</th>
            <th style={{ textAlign: "right" }}>Stock (kg)</th>
            <th style={{ textAlign: "right" }}>Días restantes</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {stock.map(s => {
            const diasColor = s.diasRestantes >= 7 ? "var(--success)" : s.diasRestantes >= 5 ? "var(--warning)" : "var(--danger)";
            const estadoBg  = s.estado === "OK" ? "var(--success-subtle)" : s.estado === "Bajo" ? "var(--warning-subtle)" : "var(--danger-subtle)";
            const estadoColor = s.estado === "OK" ? "var(--success)" : s.estado === "Bajo" ? "var(--warning)" : "var(--danger)";
            return (
              <tr key={s.feedTypeId}>
                <td style={{ fontWeight: 500 }}>{s.feedTypeName}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.stockKg.toLocaleString("es-PY")}</td>
                <td style={{ textAlign: "right", color: diasColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {s.diasRestantes >= 999 ? "—" : s.diasRestantes}
                </td>
                <td>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                    background: estadoBg, color: estadoColor,
                  }}>
                    {s.estado}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function RegistroDia() {
  const [items,    setItems]    = useState<DiaItem[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [fecha,    setFecha]    = useState(() => new Date().toISOString().slice(0, 10));
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [faseFilter, setFaseFilter] = useState("Todas");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/alimentacion/dia?fecha=${fecha}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setSummary(d.summary ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fecha]);

  useEffect(() => { load(); }, [load]);

  const filtros = ["Todas", "Gestación", "Lactancia", "Iniciación F1", "Iniciación F2", "Engorde"];

  const filtered = faseFilter === "Todas" ? items : items.filter(i => i.fase === faseFilter);

  async function handleSave(id: string, feedTypeId: string, kg: number, tipo: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSaving(id);
    try {
      await fetch("/api/alimentacion/registros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedTypeId,
          recordDate:     fecha,
          quantityKg:     kg,
          farrowingId:    tipo === "FARROWING_SOW"   ? id : null,
          nurseryBatchId: tipo === "NURSERY"         ? id : null,
          growingBatchId: tipo === "GROWING"         ? id : null,
          // GESTATION_GROUP: no entity FK — grouped record for all gestating sows
        }),
      });
      await load();
    } catch {}
    setSaving(null);
  }

  async function handleSaveAll() {
    const pending = filtered.filter(i => i.kgEntregados === null && i.feedTypeId);
    if (pending.length === 0) return;
    setSaving("__ronda__");
    try {
      await fetch("/api/alimentacion/registros/confirmar-ronda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordDate: fecha,
          filas: pending.map(item => ({
            feedTypeId:     item.feedTypeId,
            quantityKg:     item.kgRecomendados,
            farrowingId:    item.tipo === "FARROWING_SOW" ? item.id : null,
            nurseryBatchId: item.tipo === "NURSERY"       ? item.id : null,
            growingBatchId: item.tipo === "GROWING"       ? item.id : null,
          })),
        }),
      });
      await load();
    } catch {}
    setSaving(null);
  }

  const totalEstimado   = filtered.reduce((s, i) => s + i.kgRecomendados, 0);
  const totalRegistrado = filtered.reduce((s, i) => s + (i.kgEntregados ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {summary && <KpiStrip summary={summary} fecha={fecha} />}
      <ResumenStrip items={items} />

      {/* Tabla */}
      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)",
          background: "var(--bg-overlay)", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="kp-input" style={{ fontSize: 11, height: 28, width: 140 }}
            />
            <button className="btn" onClick={load} title="Actualizar" style={{ padding: "4px 8px" }}>
              <IconRefresh size={13} />
            </button>
          </div>

          {/* Pills de fase */}
          <div style={{
            display: "flex", background: "var(--bg-surface)", borderRadius: "var(--radius-md)",
            padding: 2, border: "0.5px solid var(--border-default)", gap: 2,
          }}>
            {filtros.map(f => (
              <button key={f} onClick={() => setFaseFilter(f)} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                background: faseFilter === f ? "var(--warning)" : "transparent",
                color:      faseFilter === f ? "#fff"           : "var(--text-muted)",
                fontWeight: faseFilter === f ? 600 : 400,
              }}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
            <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            Sin animales/lotes activos para alimentar
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="kp-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 42 }}></th>
                  <th>Animal / Lote</th>
                  <th>Fase</th>
                  <th style={{ textAlign: "center" }}>Animales</th>
                  <th style={{ textAlign: "right" }}>Kg rec.</th>
                  <th style={{ textAlign: "right" }}>Kg entregados *</th>
                  <th style={{ textAlign: "right" }}>Diferencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <FilaAlimento key={item.id} item={item} onSave={handleSave} saving={saving} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: "10px 14px", borderTop: "0.5px solid var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Estimado: <strong>{totalEstimado.toFixed(1)} kg</strong> ·{" "}
              Registrado: <span style={{ color: "var(--success)", fontWeight: 600 }}>{totalRegistrado.toFixed(1)} kg</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveAll}
                disabled={!!saving}
                style={{ fontSize: 11, padding: "5px 14px", background: "var(--warning)", border: "none" }}
              >
                <IconCheck size={12} /> Guardar todos
              </button>
            </div>
          </div>
        )}
      </div>

      <StockPanel />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
