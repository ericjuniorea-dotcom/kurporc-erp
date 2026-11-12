"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  weightRecordSchema, phaseChangeSchema,
  type WeightRecordInput, type PhaseChangeInput,
} from "@/lib/validations/recria";
import {
  IconScale, IconArrowRight, IconTrendingUp, IconTrendingDown, IconMinus,
  IconLoader2, IconAlertTriangle, IconCircleCheck, IconChevronDown, IconChevronRight, IconX,
  IconSkull,
} from "@tabler/icons-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface WeightRecord {
  id:          string;
  recordDate:  string;
  avgWeightKg: number;
  dailyGainKg: number | null;
  animalCount: number;
}

interface Batch {
  id:            string;
  batchCode:     string;
  phase:         "PHASE_1" | "PHASE_2";
  currentCount:  number;
  entryDate:     string;
  avgWeightKg:   number | null;
  pen:           { number: string; location: { name: string } } | null;
  weightRecords: WeightRecord[];
  phaseChanges:  Array<{ toPhase: string; changeDate: string }>;
  _count:        { weanings: number };
}

interface Props {
  batch:     Batch;
  canEdit:   boolean;
  onRefresh: () => void;
}

const PHASE_LABEL = { PHASE_1: "Fase 1", PHASE_2: "Fase 2" };

const CAUSES_RECRIA = [
  { value: "WEAKNESS",    label: "Flaqueza"         },
  { value: "CRUSHING",    label: "Aplastamiento"     },
  { value: "DIARRHEA",    label: "Diarrea"           },
  { value: "DEFICIENT",   label: "Deficiente"        },
  { value: "DISEASE",     label: "Enfermedad"        },
  { value: "SHELTER",     label: "Refugio"           },
  { value: "HYPOTHERMIA", label: "Hipotermia"        },
  { value: "ACCIDENT",    label: "Accidente"         },
  { value: "CONGENITAL",  label: "Defecto congénito" },
  { value: "ELIMINATED",  label: "Eliminado"         },
  { value: "OTHER",       label: "Otra"              },
];

export function BatchCard({ batch, canEdit, onRefresh }: Props) {
  const [expanded,     setExpanded]     = useState(false);
  const [weightDialog, setWeightDialog] = useState(false);
  const [phaseDialog,  setPhaseDialog]  = useState(false);
  const [deathDialog,  setDeathDialog]  = useState(false);
  const [chartData,    setChartData]    = useState<(WeightRecord & { date: string })[] | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);

  // Death form state
  const [deathDate,   setDeathDate]   = useState(new Date().toISOString().slice(0, 10));
  const [deathQty,    setDeathQty]    = useState(1);
  const [deathCause,  setDeathCause]  = useState("");
  const [deathNotes,  setDeathNotes]  = useState("");
  const [deathSaving, setDeathSaving] = useState(false);
  const [deathError,  setDeathError]  = useState<string | null>(null);

  async function submitDeath() {
    if (!deathCause) { setDeathError("Seleccioná la causa"); return; }
    if (deathQty < 1 || deathQty > batch.currentCount) {
      setDeathError(`Cantidad debe ser entre 1 y ${batch.currentCount}`); return;
    }
    setDeathSaving(true); setDeathError(null);
    const res = await fetch(`/api/nursery-batches/${batch.id}/deaths`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ deathDate, quantity: deathQty, cause: deathCause, notes: deathNotes }),
    });
    if (res.ok) {
      setDeathDialog(false);
      setDeathDate(new Date().toISOString().slice(0, 10));
      setDeathQty(1); setDeathCause(""); setDeathNotes("");
      setSuccessMsg("Muerte registrada"); setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } else {
      const err = await res.json();
      setDeathError(err.error ?? "Error al guardar");
    }
    setDeathSaving(false);
  }

  const latestRecord = batch.weightRecords[0];
  const gdp = latestRecord?.dailyGainKg ? Number(latestRecord.dailyGainKg) : null;
  const GdpIcon  = gdp == null ? IconMinus : gdp >= 0.3 ? IconTrendingUp : gdp >= 0.2 ? IconMinus : IconTrendingDown;
  const gdpColor = gdp == null ? "var(--text-muted)" : gdp >= 0.3 ? "var(--success)" : gdp >= 0.2 ? "var(--warning)" : "var(--danger)";

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !chartData) {
      setLoadingChart(true);
      const res = await fetch(`/api/nursery-batches/${batch.id}/weight-records`);
      const data: WeightRecord[] = await res.json();
      setChartData(data.map((r) => ({
        ...r,
        avgWeightKg: Number(r.avgWeightKg),
        dailyGainKg: r.dailyGainKg != null ? Number(r.dailyGainKg) : null,
        date: new Date(r.recordDate).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" }),
      })));
      setLoadingChart(false);
    }
  }

  // Weight form
  const { register: regW, handleSubmit: hsW, reset: resetW, formState: { errors: errW, isSubmitting: submW } } =
    useForm<WeightRecordInput>({
      resolver: zodResolver(weightRecordSchema),
      defaultValues: {
        batchId: batch.id, batchType: "NURSERY",
        animalCount: batch.currentCount,
        recordDate: new Date().toISOString().split("T")[0],
      },
    });

  async function submitWeight(data: WeightRecordInput) {
    const res = await fetch(`/api/nursery-batches/${batch.id}/weight-records`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.ok) {
      setWeightDialog(false); resetW(); setChartData(null);
      setSuccessMsg("Pesaje registrado"); setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    }
  }

  // Phase form
  const { register: regP, handleSubmit: hsP, setValue: svP, reset: resetP, formState: { errors: errP, isSubmitting: submP } } =
    useForm<PhaseChangeInput>({
      resolver: zodResolver(phaseChangeSchema),
      defaultValues: {
        nurseryBatchId: batch.id,
        changeDate: new Date().toISOString().split("T")[0],
      },
    });

  async function submitPhase(data: PhaseChangeInput) {
    const res = await fetch(`/api/nursery-batches/${batch.id}/phase-change`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.ok) {
      setPhaseDialog(false); resetP();
      setSuccessMsg(`Cambio a ${PHASE_LABEL[data.toPhase as keyof typeof PHASE_LABEL]} registrado`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    }
  }

  const nextPhase = batch.phase === "PHASE_1" ? "PHASE_2" : null;

  return (
    <>
      <div style={{
        background:   "var(--bg-surface)",
        border:       "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
      }}>
        {/* Header del lote */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "11px 14px",
            cursor:         "pointer",
          }}
          onClick={toggleExpand}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-overlay)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {expanded
              ? <IconChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />
              : <IconChevronRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <a href={`/recria/lotes/${batch.id}`} title="Ver la ficha del lote" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text, var(--accent))" }}>{batch.batchCode}</a>
                <span className={`badge ${batch.phase === "PHASE_1" ? "badge-info" : "badge-ok"}`}>
                  {PHASE_LABEL[batch.phase]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {batch.currentCount} animales
                {batch.pen && ` · Corral ${batch.pen.number} — ${batch.pen.location.name}`}
                {" · "}Ingreso: {new Date(batch.entryDate).toLocaleDateString("es-PY")}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Último pesaje */}
            <div style={{ textAlign: "right" }}>
              {batch.avgWeightKg ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {Number(batch.avgWeightKg).toFixed(2)} kg
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, fontSize: 11, color: gdpColor }}>
                    <GdpIcon size={11} aria-hidden />
                    {gdp != null ? `${(gdp * 1000).toFixed(0)} g/día` : "sin GDP"}
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin pesajes</span>
              )}
            </div>

            {/* Acciones */}
            {canEdit && (
              <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <button className="btn" style={{ height: 28, fontSize: 11, padding: "0 8px" }} onClick={() => setWeightDialog(true)}>
                  <IconScale size={12} aria-hidden /> Pesar
                </button>
                <button
                  className="btn"
                  style={{ height: 28, fontSize: 11, padding: "0 8px" }}
                  onClick={() => { setDeathDialog(true); setDeathError(null); }}
                >
                  <IconSkull size={12} aria-hidden /> Muerte
                </button>
                {nextPhase && (
                  <button
                    className="btn"
                    style={{ height: 28, fontSize: 11, padding: "0 8px" }}
                    onClick={() => { svP("toPhase", nextPhase); setPhaseDialog(true); }}
                  >
                    <IconArrowRight size={12} aria-hidden /> Fase 2
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="kp-alert kp-alert-ok" style={{ margin: "0 14px 10px", borderRadius: "var(--radius-md)" }}>
            <IconCircleCheck size={13} aria-hidden /> {successMsg}
          </div>
        )}

        {/* Detalle expandible */}
        {expanded && (
          <div style={{ borderTop: "0.5px solid var(--border-default)", padding: "12px 14px" }}>
            {loadingChart ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <IconLoader2 size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} aria-hidden />
              </div>
            ) : chartData && chartData.length > 0 ? (
              <>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Evolución de peso promedio (kg)</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-surface)",
                        border: "0.5px solid var(--border-strong)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [`${v.toFixed(2)} kg`, "Peso medio"]}
                    />
                    <Line type="monotone" dataKey="avgWeightKg" stroke="var(--accent)" strokeWidth={1.5} dot={{ r: 2, fill: "var(--accent)" }} />
                  </LineChart>
                </ResponsiveContainer>

                <table className="kp-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign: "right" }}>Animales</th>
                      <th style={{ textAlign: "right" }}>Peso medio</th>
                      <th style={{ textAlign: "right" }}>GDP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartData].reverse().map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.recordDate).toLocaleDateString("es-PY")}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.animalCount}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{Number(r.avgWeightKg).toFixed(2)} kg</td>
                        <td style={{
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: r.dailyGainKg != null && Number(r.dailyGainKg) < 0.2 ? "var(--danger)" : "var(--text-primary)",
                          fontWeight: r.dailyGainKg != null && Number(r.dailyGainKg) < 0.2 ? 500 : 400,
                        }}>
                          {r.dailyGainKg != null ? `${(Number(r.dailyGainKg) * 1000).toFixed(0)} g/d` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: "24px 0" }}>
                Sin pesajes registrados.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal: registrar pesaje */}
      {weightDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
          <div className="kp-modal" style={{ width: 440 }}>
            <div className="kp-modal-title">
              <IconScale size={14} style={{ color: "var(--accent)" }} aria-hidden />
              Registrar pesaje — {batch.batchCode}
              <button onClick={() => { setWeightDialog(false); resetW(); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <IconX size={15} aria-hidden />
              </button>
            </div>
            <form onSubmit={hsW(submitWeight)}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="kp-label">Fecha *</label>
                  <input type="date" className="kp-input" {...regW("recordDate")} />
                  {errW.recordDate && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errW.recordDate.message}</p>}
                </div>
                <div>
                  <label className="kp-label">Cantidad de animales *</label>
                  <input type="number" className="kp-input" {...regW("animalCount")} />
                  {errW.animalCount && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errW.animalCount.message}</p>}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="kp-label">Peso TOTAL del lote (kg) *</label>
                <input type="number" step="0.1" className="kp-input" placeholder="Suma de todos los animales pesados" {...regW("totalWeightKg")} />
                {errW.totalWeightKg && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errW.totalWeightKg.message}</p>}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setWeightDialog(false); resetW(); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submW} style={{ minWidth: 120 }}>
                  {submW ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Guardar pesaje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: cambio de fase */}
      {phaseDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
          <div className="kp-modal" style={{ width: 440 }}>
            <div className="kp-modal-title">
              <IconArrowRight size={14} style={{ color: "var(--info)" }} aria-hidden />
              Pasar a Fase 2 — {batch.batchCode}
              <button onClick={() => { setPhaseDialog(false); resetP(); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <IconX size={15} aria-hidden />
              </button>
            </div>
            <form onSubmit={hsP(submitPhase)}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="kp-label">Fecha del cambio *</label>
                  <input type="date" className="kp-input" {...regP("changeDate")} />
                  {errP.changeDate && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errP.changeDate.message}</p>}
                </div>
                <div>
                  <label className="kp-label">Razón *</label>
                  <select className="kp-input" style={{ appearance: "auto" }} defaultValue="WEIGHT" onChange={(e) => svP("reason", e.target.value as PhaseChangeInput["reason"])}>
                    <option value="WEIGHT">Peso alcanzado</option>
                    <option value="SPACE">Espacio disponible</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="kp-label">Peso de disparo (kg)</label>
                <input type="number" step="0.1" className="kp-input" placeholder="Peso medio que disparó el cambio" {...regP("triggerWeightKg")} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="kp-label">Observaciones</label>
                <input className="kp-input" {...regP("notes")} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setPhaseDialog(false); resetP(); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submP} style={{ minWidth: 140 }}>
                  {submP ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Confirmar cambio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: registrar muerte */}
      {deathDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
          <div className="kp-modal" style={{ width: 460 }}>
            <div className="kp-modal-title">
              <IconSkull size={14} style={{ color: "var(--danger)" }} aria-hidden />
              Muerte de animales — {batch.batchCode}
              <button onClick={() => setDeathDialog(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <IconX size={15} aria-hidden />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              Stock actual: <strong style={{ color: "var(--text-primary)" }}>{batch.currentCount} animales</strong>
            </p>

            {deathError && (
              <div className="kp-alert kp-alert-danger" style={{ marginBottom: 12 }}>
                <IconAlertTriangle size={13} aria-hidden /> {deathError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label className="kp-label">Fecha *</label>
                <input type="date" className="kp-input" value={deathDate} onChange={e => setDeathDate(e.target.value)} />
              </div>
              <div>
                <label className="kp-label">Cantidad *</label>
                <input
                  type="number" className="kp-input" min={1} max={batch.currentCount}
                  value={deathQty}
                  onChange={e => setDeathQty(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="kp-label">Causa *</label>
              <select
                className="kp-input" style={{ appearance: "auto" }}
                value={deathCause}
                onChange={e => setDeathCause(e.target.value)}
              >
                <option value="" disabled>Seleccioná la causa</option>
                {CAUSES_RECRIA.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="kp-label">Observaciones</label>
              <input className="kp-input" placeholder="Opcional" value={deathNotes} onChange={e => setDeathNotes(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setDeathDialog(false)} disabled={deathSaving}>Cancelar</button>
              <button type="button" className="btn btn-danger" disabled={deathSaving} onClick={submitDeath} style={{ minWidth: 140 }}>
                {deathSaving ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Registrar muerte"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
