"use client";
import { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import {
  IconShield, IconCheck, IconAlertTriangle,
  IconLoader2, IconRefresh, IconMedicalCross, IconPackage,
  IconPlus, IconDatabase, IconChevronUp,
  IconClipboardCheck,
} from "@tabler/icons-react";

/* ─── Tipos ──────────────────────────────────────────────────────── */

interface VacunaItem {
  id: string;
  nombre: string;
  enfermedad: string;
  categoria: string;
  criticidad: string;
  bloqueoServicio: boolean;
  dosisMl: number;
  viaAplicacion: string;
  stockTotal: number;
  eventosPendientes: number;
  lotes: Array<{
    id: string; numeroLote: string; cantidadActual: number;
    fechaVencimiento: string; diasParaVencer: number; abierto: boolean;
  }>;
}

interface LoteItem {
  id: string;
  vacunaId: string;
  vacuna: { id: string; nombre: string; enfermedad: string };
  numeroLote: string;
  cantidadInicial: number;
  cantidadActual: number;
  proveedor: string | null;
  fechaVencimiento: string;
  fechaIngreso: string;
  diasParaVencer: number;
  abierto: boolean;
  vencido: boolean;
  alertaVencimiento: boolean;
}

interface EventoItem {
  id: string;
  vacunaId: string;
  vacuna: { nombre: string; enfermedad: string; dosisMl: number; viaAplicacion: string; criticidad: string; bloqueoServicio?: boolean };
  sector: string;
  fecha: string;
  estado: "pendiente" | "aplicado" | "retrasado" | "omitido";
  dosisNecesarias: number;
  targetLabel: string | null;
  diasRestantes: number;
  aplicaciones: Array<{
    id: string; dosisAplicadas: number; responsable: string;
    fechaAplicacion: string; loteVacunaId: string | null;
  }>;
}

interface StockVacuna {
  vacunaId: string;
  nombre: string;
  enfermedad: string;
  criticidad: string;
  bloqueoServicio: boolean;
  stockTotal: number;
  stockNoVencido: number;
  dosisNecesariasProx7d: number;
  suficiente: boolean;
  alertaStock: boolean;
  alertaVencimiento: boolean;
  alertaVencidos: boolean;
  lotes: Array<{
    id: string; numeroLote: string; cantidadActual: number;
    fechaVencimiento: string; diasParaVencer: number; abierto: boolean; vencido: boolean;
  }>;
}

interface CalDay {
  day: number;
  eventos: Array<{ id: string; vacunaNombre: string; sector: string; dosisNecesarias: number; estado: string }>;
  totalDosis: number;
  tieneUrgente: boolean;
  todoAplicado: boolean;
}

interface VacEstado {
  vacunaId: string;
  nombreVacuna: string;
  momentoAplicacion: string;
  viaAplicacion: string;
  dosisMl: number;
  diasEsperaServicio: number;
  aplicada: boolean;
  vencida: boolean;
  ultimaAplicacion: string | null;
  diasRestantesEspera: number;
  bloqueaServicio: boolean;
}

interface CerdaPendiente {
  id: string;
  identCode: string;
  plantelState: string;
  currentParityCount: number;
  vacEstados: VacEstado[];
  pendientes: number;
  bloqueado: boolean;
  motivoBloqueo: string | null;
}

interface VacunaObligatoria {
  id: string;
  nombreVacuna: string;
  momentoAplicacion: string;
  diasEsperaServicio: number;
  viaAplicacion: string;
  dosisMl: number;
}

interface Protocolo {
  id: string;
  nombre: string;
  fase: string;
  tipoAnimal: string;
  descripcion: string | null;
  items: Array<{
    id: string; diaCiclo: number; disparador: string;
    esObligatorio: boolean; bloqueoServicio: boolean;
    vacuna: { id: string; nombre: string; enfermedad: string; viaAplicacion: string; dosisMl: number };
  }>;
}

/* ─── Constantes ─────────────────────────────────────────────────── */

const TABS = [
  { key: "vision",    label: "Visión general"   },
  { key: "cerdas",   label: "Cerdas — Vacunar" },
  { key: "inventario", label: "Inventario"      },
  { key: "catalogo",  label: "Catálogo"         },
];

const MOMENTO_LABELS: Record<string, string> = {
  PRE_SERVICIO_7:  "7d pre-servicio", PRE_SERVICIO_21: "21d pre-servicio",
  PRE_SERVICIO_42: "42d pre-servicio", PRE_PARTO_30: "30d pre-parto",
  PRE_PARTO_14: "14d pre-parto", POST_PARTO_1: "Día 1 post-parto",
  POST_PARTO_7: "Día 7 post-parto", POST_PARTO_14: "Día 14 post-parto",
  LECHON_3D: "Día 3 lechón", LECHON_7D: "Día 7 lechón",
  LECHON_14D: "Día 14 lechón", LECHON_21D: "Día 21 lechón",
  AL_DESTETE: "Al destete", INGRESO_LOTE_7: "7d post-ingreso",
  INGRESO_LOTE_14: "14d post-ingreso", REFUERZO_6M: "Refuerzo 6m",
  REFUERZO_ANUAL: "Refuerzo anual",
};

const INGRESO_TABS = [
  { key: "vacunacion", label: "Registrar vacunación" },
  { key: "lotes",     label: "Ingresar lote"         },
  { key: "vacunas",   label: "Nueva vacuna"           },
];

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "var(--warning)",
  aplicado:  "var(--success)",
  retrasado: "var(--danger)",
  omitido:   "var(--text-muted)",
};

const SECTOR_LABEL: Record<string, string> = {
  maternidad: "Maternidad", gestacion: "Gestación",
  iniciacion: "Iniciación", recria: "Recría",
  engorde: "Engorde", granja: "Granja",
};

function todayStr() { return new Date().toISOString().split("T")[0]; }

/* ─── SeedBanner ─────────────────────────────────────────────────── */

function SeedBanner({ onSeeded }: { onSeeded: () => void }) {
  const [seeding, setSeeding] = useState(false);
  async function seed() {
    setSeeding(true);
    await fetch("/api/sanidad/seed", { method: "POST" });
    setSeeding(false);
    onSeeded();
  }
  return (
    <div style={{ background: "var(--bg-elevated)", border: "0.5px dashed var(--border-strong)", borderRadius: "var(--radius-lg)", padding: 28, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>💉</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
        Sin catálogo de vacunas
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
        Inicializá con vacunas y protocolos de ejemplo para empezar a registrar vacunaciones.
      </div>
      <button className="btn btn-primary" onClick={seed} disabled={seeding} style={{ height: 32, fontSize: 12 }}>
        {seeding ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <IconDatabase size={13} />}
        {seeding ? "Inicializando..." : "Inicializar catálogo"}
      </button>
    </div>
  );
}

/* ─── KpiCard ────────────────────────────────────────────────────── */

function KpiCard({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px", flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 6 }}>
        {emoji} {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

/* ─── CalendarView ───────────────────────────────────────────────── */

function CalendarView({ year, month, days, onPrev, onNext }: {
  year: number; month: number; days: CalDay[];
  onPrev: () => void; onNext: () => void;
}) {
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay = new Map(days.map(d => [d.day, d]));
  const todayObj = new Date();
  const isNow = todayObj.getFullYear() === year && (todayObj.getMonth() + 1) === month;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-elevated)" }}>
        <button onClick={onPrev} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, padding: "0 6px", lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{MONTHS[month - 1]} {year}</span>
        <button onClick={onNext} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, padding: "0 6px", lineHeight: 1 }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: "var(--border-default)", margin: "0 1px 1px" }}>
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => (
          <div key={d} style={{ background: "var(--bg-elevated)", textAlign: "center", fontSize: 10, fontWeight: 500, color: "var(--text-muted)", padding: "4px 0" }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={{ background: "var(--bg-elevated)", minHeight: 38 }} />;
          const info = byDay.get(d);
          const isToday = isNow && d === todayObj.getDate();
          const hasRetrasado = info?.eventos.some(e => e.estado === "retrasado");
          const bg = isToday ? "rgba(14,165,233,.10)"
            : hasRetrasado ? "rgba(239,68,68,.09)"
            : info?.tieneUrgente ? "rgba(234,179,8,.08)"
            : info?.todoAplicado ? "rgba(34,197,94,.08)"
            : "var(--bg-surface)";
          const dotColor = hasRetrasado ? "var(--danger)" : info?.todoAplicado ? "var(--success)" : "var(--warning)";
          return (
            <div key={d} style={{ background: bg, minHeight: 38, padding: "3px 4px" }}>
              <div style={{ fontSize: 10, color: isToday ? "var(--info)" : "var(--text-secondary)", fontWeight: isToday ? 700 : 400, textAlign: "right" }}>{d}</div>
              {info && (
                <div style={{ fontSize: 9, color: dotColor, marginTop: 1, lineHeight: 1.2 }}>
                  {info.eventos.length} vac<br />{info.totalDosis}d
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "5px 10px", borderTop: "0.5px solid var(--border-default)", display: "flex", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
        <span style={{ color: "var(--danger)" }}>■ Retrasado</span>
        <span style={{ color: "var(--warning)" }}>■ Pendiente</span>
        <span style={{ color: "var(--success)" }}>■ Aplicado</span>
        <span style={{ color: "var(--info)" }}>■ Hoy</span>
      </div>
    </div>
  );
}

/* ─── EventoRow ──────────────────────────────────────────────────── */

function EventoRow({ evento, lotesDisp, onApplied }: {
  evento: EventoItem;
  lotesDisp: LoteItem[];
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    loteVacunaId: "",
    dosisAplicadas: evento.dosisNecesarias,
    responsable: "",
    fechaAplicacion: todayStr(),
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lotesFiltrados = lotesDisp.filter(l => l.vacunaId === evento.vacunaId && !l.vencido && l.cantidadActual > 0);
  const yaAplicado = evento.estado === "aplicado";

  async function aplicar() {
    if (!form.responsable.trim()) { setErr("El responsable es requerido"); return; }
    setSaving(true); setErr(null);
    const res = await fetch(`/api/sanidad/eventos/${evento.id}/aplicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, loteVacunaId: form.loteVacunaId || undefined }),
    });
    setSaving(false);
    if (res.ok) { setOpen(false); onApplied(); }
    else { const d = await res.json(); setErr(d.error ?? "Error al registrar"); }
  }

  const estadoColor = ESTADO_COLOR[evento.estado] ?? "var(--text-muted)";
  const dias = evento.diasRestantes;

  return (
    <div style={{ borderBottom: "0.5px solid var(--border-default)", background: yaAplicado ? "rgba(34,197,94,.04)" : "transparent" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: yaAplicado ? "default" : "pointer", gap: 10 }}
        onClick={() => { if (!yaAplicado) setOpen(o => !o); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💉</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              {evento.vacuna.nombre}
              {evento.vacuna.bloqueoServicio && <span style={{ fontSize: 9, background: "var(--danger)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>Bloqueo</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, display: "flex", gap: "2px 8px", flexWrap: "wrap" }}>
              <span>{evento.vacuna.enfermedad}</span>
              {evento.targetLabel && <span>· {evento.targetLabel}</span>}
              <span>· {SECTOR_LABEL[evento.sector] ?? evento.sector}</span>
              <span>· {new Date(evento.fecha).toLocaleDateString("es-PY")}</span>
              <span>· {evento.dosisNecesarias} dosis ({evento.vacuna.dosisMl}ml/d)</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: estadoColor }}>
            {evento.estado === "retrasado" ? `${Math.abs(dias)}d atrasado` : evento.estado === "pendiente" && dias === 0 ? "Hoy" : evento.estado === "pendiente" ? `En ${dias}d` : "Aplicado"}
          </span>
          {!yaAplicado && (
            <button className="btn btn-primary" style={{ height: 26, fontSize: 10, padding: "0 8px" }} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
              {open ? <IconChevronUp size={11} /> : <IconMedicalCross size={11} />}
              {open ? "Cancelar" : "Registrar"}
            </button>
          )}
          {yaAplicado && <IconCheck size={14} style={{ color: "var(--success)" }} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 14px 14px", background: "var(--bg-elevated)", borderTop: "0.5px solid var(--border-default)" }}>
          {err && (
            <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <IconAlertTriangle size={12} /> {err}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label className="kp-label">Responsable *</label>
              <input className="kp-input" placeholder="Nombre del operario"
                value={form.responsable}
                onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
            </div>
            <div>
              <label className="kp-label">Fecha de aplicación</label>
              <input type="date" className="kp-input"
                value={form.fechaAplicacion}
                onChange={e => setForm(f => ({ ...f, fechaAplicacion: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label className="kp-label">Lote de vacuna</label>
              <select className="kp-input" style={{ appearance: "auto" }}
                value={form.loteVacunaId}
                onChange={e => setForm(f => ({ ...f, loteVacunaId: e.target.value }))}>
                <option value="">— Sin especificar —</option>
                {lotesFiltrados.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.numeroLote} ({l.cantidadActual} dosis · Vence {new Date(l.fechaVencimiento).toLocaleDateString("es-PY")}{l.abierto ? " · Abierto" : ""})
                  </option>
                ))}
              </select>
              {lotesFiltrados.length === 0 && (
                <div style={{ fontSize: 10, color: "var(--warning)", marginTop: 3 }}>Sin lotes disponibles — podés registrar igualmente sin lote.</div>
              )}
            </div>
            <div>
              <label className="kp-label">Dosis aplicadas *</label>
              <input type="number" min="1" className="kp-input"
                value={form.dosisAplicadas}
                onChange={e => setForm(f => ({ ...f, dosisAplicadas: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="kp-label">Observaciones</label>
            <input className="kp-input" placeholder="Opcional..."
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={aplicar} disabled={saving} style={{ height: 30, fontSize: 11 }}>
              {saving ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <IconCheck size={12} />}
              {saving ? "Guardando..." : "Confirmar vacunación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CerdaVacunaRow ─────────────────────────────────────────────── */

function CerdaVacunaRow({ cerda, onVacunada }: { cerda: CerdaPendiente; onVacunada: () => void }) {
  const [openVac, setOpenVac] = useState<string | null>(null); // vacunaId abierta
  const [form, setForm] = useState({ responsable: "", fechaAplicacion: todayStr(), lote: "", observaciones: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function registrar(vacunaId: string) {
    if (!form.responsable.trim()) { setErr("El responsable es requerido"); return; }
    setSaving(true); setErr(null);
    const res = await fetch(`/api/plantel/animales/${cerda.id}/vacunas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configVacunaId: vacunaId, ...form }),
    });
    setSaving(false);
    if (res.ok) {
      setOpenVac(null);
      setOk("✅ Registrado");
      setTimeout(() => { setOk(null); onVacunada(); }, 1500);
    } else {
      const d = await res.json();
      setErr(d.error ?? "Error al guardar");
    }
  }

  const pendientes = cerda.vacEstados.filter(v => !v.aplicada || v.vencida);
  const enEspera   = cerda.vacEstados.filter(v => v.aplicada && v.diasRestantesEspera > 0);

  return (
    <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
      {/* Header cerda */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🐷</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{cerda.identCode}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {cerda.currentParityCount === 0 ? "Gilta (Ø partos)" : `${cerda.currentParityCount} parto(s)`}
              {" · "}{cerda.plantelState === "EMPTY" ? "Vacía" : cerda.plantelState === "MATED" ? "Servida" : cerda.plantelState}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {ok && <span style={{ fontSize: 11, color: "var(--success)" }}>{ok}</span>}
          {pendientes.length > 0 && (
            <span style={{ fontSize: 10, background: "var(--danger)", color: "#fff", borderRadius: 4, padding: "2px 7px", fontWeight: 500 }}>
              🔒 {pendientes.length} vacuna(s) faltante(s)
            </span>
          )}
          {enEspera.length > 0 && (
            <span style={{ fontSize: 10, background: "var(--warning)", color: "#000", borderRadius: 4, padding: "2px 7px", fontWeight: 500 }}>
              ⏱ En espera post-vacuna
            </span>
          )}
        </div>
      </div>

      {/* Vacunas */}
      {cerda.vacEstados.map(v => (
        <div key={v.vacunaId}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "0.5px solid var(--border-default)", background: openVac === v.vacunaId ? "var(--bg-elevated)" : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, color: v.aplicada && !v.vencida ? "var(--success)" : "var(--danger)" }}>
                {v.aplicada && !v.vencida ? "✅" : "❌"}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                  {v.nombreVacuna}
                  {v.diasEsperaServicio > 0 && (
                    <span style={{ fontSize: 9, background: "var(--warning)", color: "#000", borderRadius: 3, padding: "1px 5px", marginLeft: 6 }}>
                      Espera {v.diasEsperaServicio}d
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                  {MOMENTO_LABELS[v.momentoAplicacion] ?? v.momentoAplicacion}
                  {" · "}{v.viaAplicacion} {v.dosisMl}ml
                  {v.ultimaAplicacion && <span style={{ marginLeft: 6 }}>· Última: {new Date(v.ultimaAplicacion).toLocaleDateString("es-PY")}</span>}
                  {v.vencida && <span style={{ color: "var(--danger)", marginLeft: 6 }}>VENCIDA — refuerzo requerido</span>}
                  {v.aplicada && v.diasRestantesEspera > 0 && (
                    <span style={{ color: "var(--warning)", marginLeft: 6 }}>En espera: {v.diasRestantesEspera}d más para servicio</span>
                  )}
                </div>
              </div>
            </div>
            {(!v.aplicada || v.vencida) && (
              <button
                className="btn btn-primary"
                style={{ height: 26, fontSize: 10, padding: "0 9px" }}
                onClick={() => setOpenVac(openVac === v.vacunaId ? null : v.vacunaId)}
              >
                💉 {openVac === v.vacunaId ? "Cancelar" : "Vacunar ahora"}
              </button>
            )}
          </div>

          {openVac === v.vacunaId && (
            <div style={{ padding: "12px 14px", background: "rgba(34,197,94,.04)", borderBottom: "0.5px solid var(--border-default)" }}>
              {err && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8, display: "flex", gap: 5 }}><IconAlertTriangle size={11} />{err}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="kp-label">Responsable *</label>
                  <input className="kp-input" placeholder="Nombre operario" value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
                </div>
                <div>
                  <label className="kp-label">Fecha aplicación</label>
                  <input type="date" className="kp-input" value={form.fechaAplicacion} onChange={e => setForm(f => ({ ...f, fechaAplicacion: e.target.value }))} />
                </div>
                <div>
                  <label className="kp-label">N° de lote (opcional)</label>
                  <input className="kp-input" placeholder="LOT-2026-001" value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn" onClick={() => setOpenVac(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => registrar(v.vacunaId)} disabled={saving} style={{ height: 30, fontSize: 11 }}>
                  {saving ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <IconCheck size={12} />}
                  {saving ? "Guardando..." : "Confirmar vacunación"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────────── */

export default function SanidadPage() {
  const [tab,       setTab]       = useState<string>("vision");
  const [ingresoTab, setIngresoTab] = useState<string>("vacunacion");

  const [vacunas,   setVacunas]   = useState<VacunaItem[]>([]);
  const [lotes,     setLotes]     = useState<LoteItem[]>([]);
  const [eventos,   setEventos]   = useState<EventoItem[]>([]);
  const [stock,     setStock]     = useState<{ vacunas: StockVacuna[]; alertasCriticas: number; stockCritico: number } | null>(null);
  const [calDays,   setCalDays]   = useState<CalDay[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [calYear,   setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(() => new Date().getMonth() + 1);
  const [cerdasPend, setCerdasPend] = useState<CerdaPendiente[]>([]);
  const [vacOblig,  setVacOblig]  = useState<VacunaObligatoria[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);

  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState<string | null>(null);

  // Filtros
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("pendiente");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  async function runDemo() {
    setDemoLoading(true);
    const res = await fetch("/api/sanidad/demo", { method: "POST" });
    setDemoLoading(false);
    if (res.ok) { showMsg("Demo: 2 cerdas creadas y vacunas obligatorias configuradas"); loadAll(); }
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, lRes, eRes, sRes, cRes, pRes, cpRes] = await Promise.all([
        fetch("/api/sanidad/vacunas"),
        fetch("/api/sanidad/lotes"),
        fetch("/api/sanidad/eventos?hasta=2030-01-01"),
        fetch("/api/sanidad/stock"),
        fetch(`/api/sanidad/calendario?year=${calYear}&month=${calMonth}`),
        fetch("/api/sanidad/protocolos"),
        fetch("/api/sanidad/cerdas-pendientes"),
      ]);
      const [vd, ld, ed, sd, cd, pd, cpd] = await Promise.all([
        vRes.json(), lRes.json(), eRes.json(), sRes.json(), cRes.json(), pRes.json(), cpRes.json(),
      ]);
      if (Array.isArray(vd)) setVacunas(vd);
      if (Array.isArray(ld)) setLotes(ld);
      if (Array.isArray(ed)) setEventos(ed);
      if (sd?.vacunas) setStock(sd);
      if (cd?.days) setCalDays(cd.days);
      if (Array.isArray(pd)) setProtocolos(pd);
      if (Array.isArray(cpd?.cerdas)) { setCerdasPend(cpd.cerdas); setVacOblig(cpd.vacunasObligatorias ?? []); }
    } finally {
      setLoading(false);
    }
  }, [calYear, calMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  const noVacunas = !loading && vacunas.length === 0;

  // Eventos filtrados para la vista
  const eventosFiltrados = eventos.filter(e => {
    if (filterSector !== "all" && e.sector !== filterSector) return false;
    if (filterEstado !== "all" && e.estado !== filterEstado) return false;
    return true;
  });

  // KPIs
  const kpiHoy      = eventos.filter(e => e.diasRestantes === 0 && e.estado !== "aplicado").length;
  const kpiRetras   = eventos.filter(e => e.estado === "retrasado").length;
  const kpiProx7    = eventos.filter(e => e.estado === "pendiente" && e.diasRestantes > 0 && e.diasRestantes <= 7).length;
  const kpiAplicado = eventos.filter(e => e.estado === "aplicado").length;
  const kpiAlerta   = (stock?.alertasCriticas ?? 0) + (stock?.stockCritico ?? 0);

  /* ─── Formulario nuevo lote ───────────────────────────────────── */
  const [loteForm, setLoteForm] = useState({ vacunaId: "", numeroLote: "", cantidad: "", fechaVencimiento: "", proveedor: "", observaciones: "" });
  const [loteSaving, setLoteSaving] = useState(false);
  const [loteErr,    setLoteErr]    = useState<string | null>(null);

  async function submitLote(e: React.FormEvent) {
    e.preventDefault(); setLoteErr(null);
    if (!loteForm.vacunaId || !loteForm.numeroLote || !loteForm.cantidad || !loteForm.fechaVencimiento) {
      setLoteErr("Completá todos los campos obligatorios"); return;
    }
    setLoteSaving(true);
    const res = await fetch("/api/sanidad/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...loteForm, cantidad: Number(loteForm.cantidad) }),
    });
    setLoteSaving(false);
    if (res.ok) {
      setLoteForm({ vacunaId: "", numeroLote: "", cantidad: "", fechaVencimiento: "", proveedor: "", observaciones: "" });
      showMsg("Lote ingresado correctamente");
      loadAll();
    } else {
      const d = await res.json();
      setLoteErr(d.error ?? "Error al guardar");
    }
  }

  /* ─── Formulario nueva vacuna ─────────────────────────────────── */
  const [vacForm, setVacForm] = useState({ nombre: "", enfermedad: "", categoria: "plantel", viaAplicacion: "IM", dosisMl: "2", criticidad: "alta", bloqueoServicio: false, observaciones: "" });
  const [vacSaving, setVacSaving] = useState(false);
  const [vacErr,    setVacErr]    = useState<string | null>(null);

  async function submitVacuna(e: React.FormEvent) {
    e.preventDefault(); setVacErr(null);
    if (!vacForm.nombre || !vacForm.enfermedad) { setVacErr("Nombre y enfermedad son requeridos"); return; }
    setVacSaving(true);
    const res = await fetch("/api/sanidad/vacunas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vacForm, dosisMl: Number(vacForm.dosisMl) }),
    });
    setVacSaving(false);
    if (res.ok) {
      setVacForm({ nombre: "", enfermedad: "", categoria: "plantel", viaAplicacion: "IM", dosisMl: "2", criticidad: "alta", bloqueoServicio: false, observaciones: "" });
      showMsg("Vacuna agregada al catálogo");
      loadAll();
    } else {
      const d = await res.json();
      setVacErr(d.error ?? "Error al guardar");
    }
  }

  const isIngreso = tab === "ingreso";

  return (
    <>
      <Topbar
        title="Sanidad"
        icon={IconShield}
        iconColor="var(--info)"
        tabs={isIngreso ? [] : TABS}
        activeTab={isIngreso ? undefined : tab}
        onTabChange={setTab}
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {isIngreso ? (
              <button className="btn" onClick={() => setTab("vision")} style={{ fontSize: 11, height: 30 }}>
                ← Volver
              </button>
            ) : (
              <>
                <button className="btn" onClick={runDemo} disabled={demoLoading} style={{ height: 30, fontSize: 11 }} title="Crear 2 cerdas demo sin vacunar">
                  {demoLoading ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : "🧪"}
                  Demo
                </button>
                <button className="btn" onClick={loadAll} title="Actualizar" style={{ height: 30 }}>
                  <IconRefresh size={13} />
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setTab("ingreso")}
                  style={{ fontSize: 11, height: 30, background: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  <IconPlus size={12} /> Ingreso de datos
                </button>
              </>
            )}
          </div>
        }
      />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {msg && (
          <div className="kp-alert kp-alert-ok">
            <IconCheck size={13} /> {msg}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {!loading && noVacunas && tab !== "ingreso" && (
          <SeedBanner onSeeded={() => { showMsg("Catálogo inicializado"); loadAll(); }} />
        )}

        {/* ── VISIÓN GENERAL ─────────────────────────────────────── */}
        {!loading && !noVacunas && tab === "vision" && (
          <>
            {/* KPIs */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <KpiCard label="Para hoy"    value={kpiHoy}      color="var(--warning)"  emoji="📅" />
              <KpiCard label="Retrasadas"  value={kpiRetras}   color="var(--danger)"   emoji="🔴" />
              <KpiCard label="Próximos 7d" value={kpiProx7}    color="var(--info)"     emoji="📆" />
              <KpiCard label="Aplicadas"   value={kpiAplicado} color="var(--success)"  emoji="✅" />
              <KpiCard label="Alertas stock" value={kpiAlerta} color={kpiAlerta > 0 ? "var(--danger)" : "var(--success)"} emoji={kpiAlerta > 0 ? "⚠️" : "🟢"} />
            </div>

            {/* Alerta stock crítico */}
            {stock && (stock.alertasCriticas > 0 || stock.stockCritico > 0) && (
              <div className="kp-alert kp-alert-danger">
                <IconAlertTriangle size={13} />
                <span>
                  {stock.alertasCriticas > 0 && `${stock.alertasCriticas} vacuna(s) crítica(s) con stock insuficiente. `}
                  {stock.stockCritico > 0 && `${stock.stockCritico} vacuna(s) con lotes vencidos en stock.`}
                </span>
                <button className="btn" style={{ marginLeft: "auto", fontSize: 10, height: 24 }} onClick={() => setTab("inventario")}>Ver inventario</button>
              </div>
            )}

            {/* Filtros eventos */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="kp-input" value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{ height: 30, fontSize: 11, width: 140 }}>
                <option value="all">Todos los sectores</option>
                {Object.entries(SECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div style={{ display: "flex", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 2, border: "0.5px solid var(--border-default)" }}>
                {[
                  { k: "pendiente", l: "Pendientes" },
                  { k: "retrasado", l: "Retrasadas" },
                  { k: "aplicado",  l: "Aplicadas"  },
                  { k: "all",       l: "Todas"       },
                ].map(({ k, l }) => (
                  <button key={k} onClick={() => setFilterEstado(k)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: filterEstado === k ? "var(--bg-surface)" : "transparent",
                      color: filterEstado === k ? "var(--text-primary)" : "var(--text-muted)",
                      fontWeight: filterEstado === k ? 500 : 400 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de eventos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>
              <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                {eventosFiltrados.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center" }}>
                    <IconClipboardCheck size={28} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No hay eventos para los filtros seleccionados</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Los eventos se generan automáticamente con cada parto, servicio o destete.
                    </div>
                  </div>
                ) : (
                  eventosFiltrados.map(ev => (
                    <EventoRow key={ev.id} evento={ev} lotesDisp={lotes} onApplied={() => { showMsg("Vacunación registrada"); loadAll(); }} />
                  ))
                )}
              </div>

              {/* Calendario */}
              <CalendarView year={calYear} month={calMonth} days={calDays} onPrev={prevMonth} onNext={nextMonth} />
            </div>
          </>
        )}

        {/* ── INVENTARIO ─────────────────────────────────────────── */}
        {/* ── CERDAS POR VACUNAR ─────────────────────────────────── */}
        {!loading && tab === "cerdas" && (
          <>
            {vacOblig.length === 0 ? (
              <div style={{ background: "var(--bg-elevated)", border: "0.5px dashed var(--border-strong)", borderRadius: "var(--radius-lg)", padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>Sin vacunas obligatorias configuradas</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
                  Para usar esta sección, configurá vacunas obligatorias en Configuración → Gestación. Podés usar el demo para empezar.
                </div>
                <button className="btn btn-primary" onClick={runDemo} disabled={demoLoading} style={{ height: 32, fontSize: 12 }}>
                  {demoLoading ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "🧪"}
                  {demoLoading ? "Cargando demo..." : "Cargar demo (2 cerdas + vacunas)"}
                </button>
              </div>
            ) : (
              <>
                {/* Resumen del protocolo */}
                <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
                    Vacunas obligatorias para autorizar servicio ({vacOblig.length})
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {vacOblig.map(v => (
                      <div key={v.id} style={{ border: "0.5px solid var(--danger)", borderRadius: "var(--radius-md)", padding: "5px 10px", fontSize: 11 }}>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>💉 {v.nombreVacuna}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
                          {MOMENTO_LABELS[v.momentoAplicacion] ?? v.momentoAplicacion}
                          {v.diasEsperaServicio > 0 && ` · Esperar ${v.diasEsperaServicio}d post-vacuna`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {cerdasPend.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
                    <IconCheck size={28} style={{ color: "var(--success)", display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>¡Todas las cerdas están al día!</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>No hay cerdas vacías o servidas con vacunas pendientes.</div>
                    <button className="btn" style={{ marginTop: 14, fontSize: 11 }} onClick={runDemo} disabled={demoLoading}>
                      🧪 Cargar cerdas demo
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {cerdasPend.length} cerda(s) con vacunas pendientes o en período de espera — bloqueadas para servicio
                    </div>
                    {cerdasPend.map(c => (
                      <CerdaVacunaRow key={c.id} cerda={c} onVacunada={() => { showMsg("Vacunación registrada"); loadAll(); }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && tab === "inventario" && (
          <>
            {noVacunas ? (
              <SeedBanner onSeeded={() => { showMsg("Catálogo inicializado"); loadAll(); }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(stock?.vacunas ?? []).map(sv => (
                  <div key={sv.vacunaId} style={{ background: "var(--bg-surface)", border: `0.5px solid ${sv.alertaStock ? "var(--danger)" : sv.alertaVencimiento ? "var(--warning)" : "var(--border-default)"}`, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                          💉 {sv.nombre}
                          {sv.criticidad === "alta" && <span style={{ fontSize: 9, background: "var(--danger)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>CRÍTICO</span>}
                          {sv.bloqueoServicio && <span style={{ fontSize: 9, background: "var(--warning)", color: "#000", borderRadius: 3, padding: "1px 4px" }}>Bloqueo servicio</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sv.enfermedad}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: sv.alertaStock ? "var(--danger)" : "var(--success)" }}>
                          {sv.stockNoVencido}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          dosis disponibles · {sv.dosisNecesariasProx7d > 0 ? `necesita ${sv.dosisNecesariasProx7d}/7d` : "sin necesidad próxima"}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "8px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {sv.lotes.length === 0 ? (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin lotes registrados</span>
                      ) : sv.lotes.map(l => (
                        <div key={l.id} style={{
                          border: `0.5px solid ${l.vencido ? "var(--danger)" : l.diasParaVencer <= 30 ? "var(--warning)" : "var(--border-default)"}`,
                          borderRadius: "var(--radius-md)", padding: "5px 10px", fontSize: 11,
                          background: l.vencido ? "rgba(239,68,68,.07)" : "var(--bg-elevated)",
                        }}>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{l.numeroLote}</div>
                          <div style={{ color: "var(--text-muted)", marginTop: 1 }}>
                            {l.cantidadActual} dosis · vence {new Date(l.fechaVencimiento).toLocaleDateString("es-PY")}
                            {l.vencido && <span style={{ color: "var(--danger)", marginLeft: 4 }}>VENCIDO</span>}
                            {!l.vencido && l.diasParaVencer <= 30 && <span style={{ color: "var(--warning)", marginLeft: 4 }}>vence en {l.diasParaVencer}d</span>}
                            {l.abierto && <span style={{ color: "var(--info)", marginLeft: 4 }}>Abierto</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(sv.alertaStock || sv.alertaVencidos) && (
                      <div style={{ padding: "6px 14px", borderTop: "0.5px solid var(--border-default)", fontSize: 11, color: sv.alertaStock ? "var(--danger)" : "var(--warning)", display: "flex", alignItems: "center", gap: 6 }}>
                        <IconAlertTriangle size={11} />
                        {sv.alertaStock && `Stock insuficiente para próximos 7 días (faltan ${sv.dosisNecesariasProx7d - sv.stockNoVencido} dosis). `}
                        {sv.alertaVencidos && "Tiene lotes vencidos con stock."}
                      </div>
                    )}
                  </div>
                ))}
                {(stock?.vacunas ?? []).length === 0 && (
                  <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
                    <IconPackage size={28} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sin stock registrado</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── CATÁLOGO ───────────────────────────────────────────── */}
        {!loading && tab === "catalogo" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Vacunas */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Vacunas ({vacunas.length})</div>
              <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                {vacunas.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin vacunas</div>
                ) : vacunas.map(v => (
                  <div key={v.id} style={{ padding: "9px 13px", borderBottom: "0.5px solid var(--border-default)" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{v.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: "2px 8px", flexWrap: "wrap" }}>
                      <span>{v.enfermedad}</span>
                      <span>· {v.viaAplicacion} {v.dosisMl}ml</span>
                      <span>· Stock: {v.stockTotal} dosis</span>
                      {v.eventosPendientes > 0 && <span style={{ color: "var(--warning)" }}>· {v.eventosPendientes} pendiente(s)</span>}
                      {v.bloqueoServicio && <span style={{ color: "var(--danger)" }}>· Bloqueo</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocolos */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Protocolos ({protocolos.length})</div>
              {protocolos.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>Sin protocolos</div>
              ) : protocolos.map(p => (
                <div key={p.id} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ padding: "9px 13px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{SECTOR_LABEL[p.fase] ?? p.fase} · {p.tipoAnimal}</div>
                  </div>
                  {p.items.map(item => (
                    <div key={item.id} style={{ padding: "7px 13px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{item.vacuna.nombre}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          Día {item.diaCiclo} · {item.disparador} · {item.vacuna.viaAplicacion} {item.vacuna.dosisMl}ml
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {item.esObligatorio && <span style={{ fontSize: 9, background: "var(--accent)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>Obligatorio</span>}
                        {item.bloqueoServicio && <span style={{ fontSize: 9, background: "var(--danger)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>Bloqueo</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INGRESO DE DATOS ───────────────────────────────────── */}
        {tab === "ingreso" && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)", alignSelf: "flex-start" }}>
              {INGRESO_TABS.map(t => (
                <button key={t.key} onClick={() => setIngresoTab(t.key)}
                  style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: ingresoTab === t.key ? "var(--bg-surface)" : "transparent",
                    color: ingresoTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: ingresoTab === t.key ? 500 : 400 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Vacunación */}
            {ingresoTab === "vacunacion" && (
              <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <div style={{ padding: "9px 14px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                  Eventos pendientes de vacunación
                </div>
                {loading ? (
                  <div style={{ padding: 24, textAlign: "center" }}><IconLoader2 size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} /></div>
                ) : eventos.filter(e => e.estado !== "aplicado" && e.estado !== "omitido").length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center" }}>
                    <IconCheck size={28} style={{ color: "var(--success)", display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>¡Todo al día! No hay vacunaciones pendientes.</div>
                  </div>
                ) : (
                  eventos
                    .filter(e => e.estado !== "aplicado" && e.estado !== "omitido")
                    .sort((a, b) => a.diasRestantes - b.diasRestantes)
                    .map(ev => (
                      <EventoRow key={ev.id} evento={ev} lotesDisp={lotes} onApplied={() => { showMsg("Vacunación registrada correctamente"); loadAll(); }} />
                    ))
                )}
              </div>
            )}

            {/* Nuevo lote */}
            {ingresoTab === "lotes" && (
              <div style={{ maxWidth: 560 }}>
                <form onSubmit={submitLote} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconPackage size={14} style={{ color: "var(--info)" }} /> Ingresar lote de vacuna
                  </div>
                  {loteErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><IconAlertTriangle size={11} /> {loteErr}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="kp-label">Vacuna *</label>
                      <select className="kp-input" style={{ appearance: "auto" }} value={loteForm.vacunaId} onChange={e => setLoteForm(f => ({ ...f, vacunaId: e.target.value }))}>
                        <option value="">— Seleccionar —</option>
                        {vacunas.map(v => <option key={v.id} value={v.id}>{v.nombre} — {v.enfermedad}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Número de lote *</label>
                        <input className="kp-input" placeholder="LOT-2026-001" value={loteForm.numeroLote} onChange={e => setLoteForm(f => ({ ...f, numeroLote: e.target.value }))} />
                      </div>
                      <div>
                        <label className="kp-label">Cantidad (dosis) *</label>
                        <input type="number" min="1" className="kp-input" placeholder="100" value={loteForm.cantidad} onChange={e => setLoteForm(f => ({ ...f, cantidad: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Fecha de vencimiento *</label>
                        <input type="date" className="kp-input" value={loteForm.fechaVencimiento} onChange={e => setLoteForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
                      </div>
                      <div>
                        <label className="kp-label">Proveedor</label>
                        <input className="kp-input" placeholder="Laboratorio Vetsa" value={loteForm.proveedor} onChange={e => setLoteForm(f => ({ ...f, proveedor: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="kp-label">Observaciones</label>
                      <input className="kp-input" placeholder="Opcional..." value={loteForm.observaciones} onChange={e => setLoteForm(f => ({ ...f, observaciones: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" className="btn btn-primary" disabled={loteSaving} style={{ height: 32, fontSize: 12 }}>
                        {loteSaving ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <IconPlus size={13} />}
                        {loteSaving ? "Guardando..." : "Registrar lote"}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tabla de lotes actuales */}
                {lotes.length > 0 && (
                  <div style={{ marginTop: 16, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                    <div style={{ padding: "9px 14px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                      Lotes registrados ({lotes.length})
                    </div>
                    {lotes.map(l => (
                      <div key={l.id} style={{ padding: "8px 13px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{l.vacuna.nombre} — {l.numeroLote}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                            {l.cantidadActual}/{l.cantidadInicial} dosis · Vence {new Date(l.fechaVencimiento).toLocaleDateString("es-PY")}
                            {l.proveedor && ` · ${l.proveedor}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {l.vencido && <span style={{ fontSize: 9, background: "var(--danger)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>VENCIDO</span>}
                          {!l.vencido && l.alertaVencimiento && <span style={{ fontSize: 9, background: "var(--warning)", color: "#000", borderRadius: 3, padding: "1px 4px" }}>Vence en {l.diasParaVencer}d</span>}
                          {l.abierto && <span style={{ fontSize: 9, background: "var(--info)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>Abierto</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nueva vacuna */}
            {ingresoTab === "vacunas" && (
              <div style={{ maxWidth: 560 }}>
                <form onSubmit={submitVacuna} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconMedicalCross size={14} style={{ color: "var(--accent)" }} /> Agregar vacuna al catálogo
                  </div>
                  {vacErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><IconAlertTriangle size={11} /> {vacErr}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Nombre de la vacuna *</label>
                        <input className="kp-input" placeholder="Ej: Parvovirus + Leptospira" value={vacForm.nombre} onChange={e => setVacForm(f => ({ ...f, nombre: e.target.value }))} />
                      </div>
                      <div>
                        <label className="kp-label">Enfermedad / indicación *</label>
                        <input className="kp-input" placeholder="Ej: Parvovirus porcino" value={vacForm.enfermedad} onChange={e => setVacForm(f => ({ ...f, enfermedad: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Categoría</label>
                        <select className="kp-input" style={{ appearance: "auto" }} value={vacForm.categoria} onChange={e => setVacForm(f => ({ ...f, categoria: e.target.value }))}>
                          <option value="plantel">Plantel (cerdas)</option>
                          <option value="lechones">Lechones</option>
                          <option value="gestacion">Gestación</option>
                          <option value="recria">Recría</option>
                          <option value="engorde">Engorde</option>
                          <option value="all">Toda la granja</option>
                        </select>
                      </div>
                      <div>
                        <label className="kp-label">Vía de aplicación</label>
                        <select className="kp-input" style={{ appearance: "auto" }} value={vacForm.viaAplicacion} onChange={e => setVacForm(f => ({ ...f, viaAplicacion: e.target.value }))}>
                          <option value="IM">IM – Intramuscular</option>
                          <option value="SC">SC – Subcutánea</option>
                          <option value="IV">IV – Intravenosa</option>
                          <option value="oral">Oral</option>
                        </select>
                      </div>
                      <div>
                        <label className="kp-label">Dosis (ml)</label>
                        <input type="number" min="0.1" step="0.1" className="kp-input" value={vacForm.dosisMl} onChange={e => setVacForm(f => ({ ...f, dosisMl: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Criticidad</label>
                        <select className="kp-input" style={{ appearance: "auto" }} value={vacForm.criticidad} onChange={e => setVacForm(f => ({ ...f, criticidad: e.target.value }))}>
                          <option value="alta">Alta — bloqueo en alertas</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-primary)" }}>
                          <input type="checkbox" checked={vacForm.bloqueoServicio} onChange={e => setVacForm(f => ({ ...f, bloqueoServicio: e.target.checked }))} style={{ width: 14, height: 14 }} />
                          Bloquea servicio si no está aplicada
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="kp-label">Observaciones</label>
                      <input className="kp-input" placeholder="Opcional..." value={vacForm.observaciones} onChange={e => setVacForm(f => ({ ...f, observaciones: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" className="btn btn-primary" disabled={vacSaving} style={{ height: 32, fontSize: 12 }}>
                        {vacSaving ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <IconPlus size={13} />}
                        {vacSaving ? "Guardando..." : "Agregar vacuna"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
