"use client";
import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

const GENETIC_LINES = ["TN Rexne", "TN Duroc", "PIC", "Genesus", "NAIMA CG36", "Otra"];

interface SemenLot {
  id: string;
  lotCode: string;
  geneticLine: string;
  donorBoarCode: string;
  originFarm: string;
  productionDate: string;
  expiryDate: string;
  totalDoses: number;
  availableDoses: number;
  pricePerDoseGs: string;
  isActive: boolean;
}

function lotStatus(lot: SemenLot): { label: string; cls: string } {
  const now   = Date.now();
  const exp   = new Date(lot.expiryDate).getTime();
  const days  = Math.ceil((exp - now) / 86400000);
  if (!lot.isActive || lot.availableDoses <= 0) return { label: "Agotado", cls: "badge badge-danger" };
  if (days <= 0)   return { label: "Vencido",         cls: "badge badge-danger" };
  if (days <= 15)  return { label: `Por vencer (${days}d)`, cls: "badge badge-warn" };
  return { label: "Disponible", cls: "badge badge-ok" };
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtGs(v: string | null): string {
  if (!v) return "—";
  return `₲ ${Number(v).toLocaleString("es-PY")}`;
}

export function SemenTab() {
  const [lots, setLots]     = useState<SemenLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    geneticLine: "", donorBoarCode: "", originFarm: "",
    productionDate: "", expiryDate: "", totalDoses: "",
    pricePerDoseGs: "", observations: "",
  });

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plantel/semen");
      if (res.ok) setLots(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLots(); }, [loadLots]);

  const filtered = search
    ? lots.filter(l =>
        l.lotCode.toLowerCase().includes(search.toLowerCase()) ||
        l.geneticLine.toLowerCase().includes(search.toLowerCase()) ||
        l.donorBoarCode.toLowerCase().includes(search.toLowerCase()) ||
        l.originFarm.toLowerCase().includes(search.toLowerCase())
      )
    : lots;

  async function handleSubmit() {
    const { geneticLine, donorBoarCode, originFarm, productionDate, expiryDate, totalDoses, pricePerDoseGs } = form;
    if (!geneticLine || !donorBoarCode || !originFarm || !productionDate || !expiryDate || !totalDoses || !pricePerDoseGs) {
      alert("Completá todos los campos obligatorios.");
      return;
    }
    if (new Date(expiryDate) <= new Date(productionDate)) {
      alert("La fecha de vencimiento debe ser posterior a la fecha de producción.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plantel/semen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ geneticLine: "", donorBoarCode: "", originFarm: "", productionDate: "", expiryDate: "", totalDoses: "", pricePerDoseGs: "", observations: "" });
        loadLots();
      }
    } finally {
      setSaving(false);
    }
  }

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="kp-input"
            placeholder="Buscar por código, línea genética, verraco u origen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} aria-hidden /> Registrar lote
        </button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No hay lotes de semen registrados aún.
          </div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Código lote</th>
                <th>Línea genética</th>
                <th>Verraco donante</th>
                <th>Granja origen</th>
                <th>Producción</th>
                <th>Vencimiento</th>
                <th>Disponibles / Total</th>
                <th>Estado</th>
                <th>Precio / dosis</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lot => {
                const status = lotStatus(lot);
                const pctUsed = lot.totalDoses > 0 ? Math.round((1 - lot.availableDoses / lot.totalDoses) * 100) : 0;
                return (
                  <tr key={lot.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>{lot.lotCode}</td>
                    <td style={{ fontWeight: 500 }}>{lot.geneticLine}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{lot.donorBoarCode}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>{lot.originFarm}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtDate(lot.productionDate)}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtDate(lot.expiryDate)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{lot.availableDoses}</span>
                        <span style={{ color: "var(--text-muted)" }}>/ {lot.totalDoses}</span>
                        <div style={{ flex: 1, minWidth: 48, height: 4, background: "var(--border-default)", borderRadius: 2 }}>
                          <div style={{ width: `${pctUsed}%`, height: "100%", background: pctUsed > 80 ? "var(--danger)" : "var(--success)", borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                    <td><span className={status.cls}>{status.label}</span></td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>{fmtGs(lot.pricePerDoseGs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Register lot modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Registrar lote de semen externo</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Línea genética *</label>
                  <select className="kp-input" value={form.geneticLine} onChange={e => F("geneticLine", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {GENETIC_LINES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Código verraco donante *</label>
                  <input className="kp-input" value={form.donorBoarCode} onChange={e => F("donorBoarCode", e.target.value)} placeholder="Código en establecimiento de origen" />
                </div>
              </div>

              <div>
                <label className="kp-label">Granja / Laboratorio de origen *</label>
                <input className="kp-input" value={form.originFarm} onChange={e => F("originFarm", e.target.value)} placeholder="Nombre del establecimiento proveedor" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Fecha de producción *</label>
                  <input className="kp-input" type="date" value={form.productionDate} onChange={e => F("productionDate", e.target.value)} />
                </div>
                <div>
                  <label className="kp-label">Fecha de vencimiento *</label>
                  <input className="kp-input" type="date" value={form.expiryDate} onChange={e => F("expiryDate", e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Cantidad de dosis (pajuelas) *</label>
                  <input className="kp-input" type="number" min="1" value={form.totalDoses} onChange={e => F("totalDoses", e.target.value)} placeholder="Ej: 50" />
                </div>
                <div>
                  <label className="kp-label">Precio por dosis (₲) *</label>
                  <input className="kp-input" type="number" value={form.pricePerDoseGs} onChange={e => F("pricePerDoseGs", e.target.value)} placeholder="Ej: 75000" />
                </div>
              </div>

              <div>
                <label className="kp-label">Observaciones</label>
                <textarea className="kp-input" rows={2} value={form.observations} onChange={e => F("observations", e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} />
              </div>

              <div className="kp-alert kp-alert-info" style={{ fontSize: 11 }}>
                <IconAlertCircle size={12} />
                Al registrar el lote se creará automáticamente el stock en Logística. Los descuentos se realizan al registrar IA en Gestación.
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar lote"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
