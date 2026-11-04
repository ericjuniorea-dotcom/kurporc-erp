"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  IconChevronDown, IconChevronUp, IconLoader2, IconAlertTriangle,
  IconCircleCheck, IconX, IconTrendingUp, IconTrendingDown, IconMinus,
  IconVaccine,
} from "@tabler/icons-react";

/* ─── Tipos ──────────────────────────────────────────────────────── */

interface AnimalPendiente {
  eventoId: string;
  targetLabel: string | null;
  fecha: string;
  dosisNecesarias: number;
  estado: string;
  diasRestantes: number;
}

interface VacunaGrupo {
  vacunaId: string;
  nombre: string;
  totalAnimales: number;
  retrasadas: number;
  animales: AnimalPendiente[];
}

interface Modulo {
  key: string;
  label: string;
  totalPendientes: number;
  retrasadas: number;
  proximas: number;
  vacunas: VacunaGrupo[];
}

interface VisionGeneralData {
  kpis: {
    cumplimientoPct: number;
    retrasadas: { count: number; promedioAtrasoDias: number };
    paraHoyProx7d: number;
    aplicadasEstaSemana: { count: number; tendencia: "up" | "down" | "same" };
    alertasStock: number;
    estadoGeneral: "al_dia" | "atencion";
  };
  modulos: Modulo[];
  expandirPorDefecto: string;
}

interface LoteOption {
  id: string; numeroLote: string; cantidadActual: number;
  diasParaVencer: number; vencido: boolean;
}

const STORAGE_KEY = "sanidad-vision-general-expandido";

function semaforoCumplimiento(pct: number) {
  if (pct >= 90) return "var(--success-text)";
  if (pct >= 70) return "var(--warning-text)";
  return "var(--danger-text)";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ─── KPIs ───────────────────────────────────────────────────────── */

function KpiCumplimientoRow({ kpis }: { kpis: VisionGeneralData["kpis"] }) {
  const TendIcon = kpis.aplicadasEstaSemana.tendencia === "up" ? IconTrendingUp
    : kpis.aplicadasEstaSemana.tendencia === "down" ? IconTrendingDown : IconMinus;
  const tendColor = kpis.aplicadasEstaSemana.tendencia === "down" ? "var(--warning-text)" : "var(--success-text)";

  const cards = [
    { label: "Cumplimiento", value: `${kpis.cumplimientoPct}%`, color: semaforoCumplimiento(kpis.cumplimientoPct), sub: "últimos 30 días" },
    { label: "Retrasadas", value: kpis.retrasadas.count, color: kpis.retrasadas.count > 0 ? "var(--danger-text)" : "var(--success-text)", sub: kpis.retrasadas.count > 0 ? `prom. ${kpis.retrasadas.promedioAtrasoDias}d de atraso` : "sin atrasos" },
    { label: "Para hoy / 7d", value: kpis.paraHoyProx7d, color: "var(--text-primary)", sub: "próximas" },
    { label: "Aplicadas esta semana", value: kpis.aplicadasEstaSemana.count, color: tendColor, sub: null, icon: TendIcon },
    { label: "Alertas de stock", value: kpis.alertasStock, color: kpis.alertasStock > 0 ? "var(--danger-text)" : "var(--success-text)", sub: kpis.alertasStock > 0 ? "vacunas con stock insuficiente" : "stock ok" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {cards.map(c => (
        <div key={c.label} className="panel" style={{ flex: "1 1 160px", minWidth: 150 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</span>
            {c.icon && <c.icon size={16} style={{ color: c.color }} />}
          </div>
          {c.sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function EstadoGeneralBadge({ estado }: { estado: "al_dia" | "atencion" }) {
  const ok = estado === "al_dia";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 99,
      background: ok ? "var(--success-subtle)" : "var(--danger-subtle)",
      border: `0.5px solid ${ok ? "var(--success-border)" : "var(--danger)"}`,
      color: ok ? "var(--success-text)" : "var(--danger-text)",
      fontSize: 12, fontWeight: 700,
    }}>
      {ok ? <IconCircleCheck size={13} /> : <IconAlertTriangle size={13} />}
      {ok ? "Al día" : "Atención requerida"}
    </div>
  );
}

/* ─── Fila de vacuna con selección ───────────────────────────────── */

function VacunaGrupoRow({
  grupo, selected, onToggleAll, onToggleOne, onRegistrar,
}: {
  grupo: VacunaGrupo;
  selected: Set<string>;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onRegistrar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ids = grupo.animales.map(a => a.eventoId);
  const seleccionadosCount = ids.filter(id => selected.has(id)).length;
  const allChecked = seleccionadosCount === ids.length;
  const someChecked = seleccionadosCount > 0 && !allChecked;

  return (
    <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--bg-elevated)" }}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked; }}
          onChange={e => onToggleAll(ids, e.target.checked)}
          style={{ width: 14, height: 14, cursor: "pointer" }}
        />
        <button
          onClick={() => setOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{grupo.nombre}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{grupo.totalAnimales} cerdas</span>
          {grupo.retrasadas > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
              {grupo.retrasadas} retrasada{grupo.retrasadas > 1 ? "s" : ""}
            </span>
          )}
          {open ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
        </button>
        <button
          className="btn btn-primary"
          disabled={seleccionadosCount === 0}
          onClick={onRegistrar}
          style={{ fontSize: 11, height: 28, flexShrink: 0 }}
        >
          <IconVaccine size={12} /> Registrar aplicación ({seleccionadosCount})
        </button>
      </div>

      {open && (
        <div>
          {grupo.animales.map((a, i) => (
            <div
              key={a.eventoId}
              onClick={() => onToggleOne(a.eventoId)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", cursor: "pointer", borderTop: i > 0 ? "0.5px solid var(--border-subtle)" : "none" }}
            >
              <input type="checkbox" checked={selected.has(a.eventoId)} onChange={() => onToggleOne(a.eventoId)} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>{a.targetLabel ?? "—"}</span>
              <span style={{ fontSize: 11, color: a.estado === "retrasado" ? "var(--danger-text)" : "var(--text-muted)" }}>
                {a.estado === "retrasado" ? `Retrasada ${-a.diasRestantes}d` : fmtDate(a.fecha)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Acordeón de módulo ─────────────────────────────────────────── */

function ModuloVacunacionAccordion({
  modulo, isOpen, onToggle, selected, onToggleAll, onToggleOne, onRegistrar,
}: {
  modulo: Modulo; isOpen: boolean; onToggle: () => void;
  selected: Set<string>;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onRegistrar: (grupo: VacunaGrupo, ids: string[]) => void;
}) {
  const alDia = modulo.totalPendientes === 0;

  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div
        role="button" tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: alDia ? "var(--text-muted)" : "var(--text-primary)" }}>{modulo.label}</span>
          {alDia ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--success-text)" }}>
              <IconCircleCheck size={12} /> Al día
            </span>
          ) : (
            <>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{modulo.totalPendientes} pendiente{modulo.totalPendientes > 1 ? "s" : ""}</span>
              {modulo.retrasadas > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
                  {modulo.retrasadas} retrasada{modulo.retrasadas > 1 ? "s" : ""}
                </span>
              )}
              {modulo.proximas > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
                  {modulo.proximas} en 7d
                </span>
              )}
            </>
          )}
        </div>
        {!alDia && (isOpen ? <IconChevronUp size={13} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={13} style={{ color: "var(--text-muted)" }} />)}
      </div>

      {isOpen && !alDia && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {modulo.vacunas.map(v => (
            <VacunaGrupoRow
              key={v.vacunaId}
              grupo={v}
              selected={selected}
              onToggleAll={onToggleAll}
              onToggleOne={onToggleOne}
              onRegistrar={() => onRegistrar(v, v.animales.map(a => a.eventoId).filter(id => selected.has(id)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Modal de registrar aplicación (bulk, con split de lote) ───── */

function RegistrarAplicacionModal({
  grupo, eventoIds: eventoIdsIniciales, onClose, onDone,
}: {
  grupo: VacunaGrupo; eventoIds: string[]; onClose: () => void; onDone: () => void;
}) {
  const { data: session } = useSession();
  const [pendientes, setPendientes] = useState<string[]>(eventoIdsIniciales);
  const [lotes, setLotes] = useState<LoteOption[]>([]);
  const [loteId, setLoteId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [responsable, setResponsable] = useState(session?.user?.name ?? "");
  const [dosis, setDosis] = useState(String(grupo.animales[0]?.dosisNecesarias ?? 1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aplicadosGrupos, setAplicadosGrupos] = useState(0);

  useEffect(() => {
    fetch(`/api/sanidad/lotes?vacunaId=${grupo.vacunaId}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: LoteOption[]) => setLotes(d.filter(l => !l.vencido)))
      .catch(() => {});
  }, [grupo.vacunaId]);

  const labelPorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of grupo.animales) m[a.eventoId] = a.targetLabel ?? a.eventoId;
    return m;
  }, [grupo]);

  const loteSeleccionado = lotes.find(l => l.id === loteId);
  const dosisNum = Number(dosis) || 0;
  const dosisTotales = dosisNum * pendientes.length;
  const alcanzaPara = loteSeleccionado && dosisNum > 0 ? Math.floor(loteSeleccionado.cantidadActual / dosisNum) : 0;
  const stockInsuficiente = !!loteSeleccionado && loteSeleccionado.cantidadActual < dosisTotales;

  async function enviar(idsAEnviar: string[]) {
    if (!loteSeleccionado) { setError("Elegí un lote"); return null; }
    if (!responsable.trim()) { setError("El responsable es requerido"); return null; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/sanidad/vacunacion/aplicar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoIds: idsAEnviar, numeroLote: loteSeleccionado.numeroLote,
          responsable, fechaAplicacion: fecha, dosisPorAnimal: dosisNum,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al registrar");
        return null;
      }
      return idsAEnviar;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegistrarTodo() {
    const enviados = await enviar(pendientes);
    if (!enviados) return;
    setAplicadosGrupos(n => n + 1);
    setPendientes([]);
  }

  async function handleAplicarParcial() {
    const primeros = pendientes.slice(0, alcanzaPara);
    const enviados = await enviar(primeros);
    if (!enviados) return;
    setAplicadosGrupos(n => n + 1);
    setPendientes(prev => prev.filter(id => !primeros.includes(id)));
    setLoteId("");
    fetch(`/api/sanidad/lotes?vacunaId=${grupo.vacunaId}`).then(r => r.ok ? r.json() : []).then((d: LoteOption[]) => setLotes(d.filter(l => !l.vencido))).catch(() => {});
  }

  function quitarAnimal(id: string) {
    setPendientes(prev => prev.filter(x => x !== id));
  }

  if (pendientes.length === 0 && aplicadosGrupos > 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 400, padding: 18 }} onClick={e => e.stopPropagation()}>
          <div className="kp-alert kp-alert-success" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <IconCircleCheck size={15} /> Aplicación registrada ({aplicadosGrupos} lote{aplicadosGrupos > 1 ? "s" : ""} usado{aplicadosGrupos > 1 ? "s" : ""}).
          </div>
          <button className="btn btn-primary" onClick={() => { onDone(); onClose(); }}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 480, padding: 18 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Registrar aplicación — {grupo.nombre}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && (
            <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlertTriangle size={15} />{error}
            </div>
          )}
          {aplicadosGrupos > 0 && (
            <div className="kp-alert kp-alert-success" style={{ fontSize: 11 }}>
              {aplicadosGrupos} lote(s) ya aplicado(s) en esta sesión. Faltan {pendientes.length} animal(es).
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="kp-label">Fecha de aplicación</label>
              <input className="kp-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Dosis por animal (ml)</label>
              <input className="kp-input" type="number" step="0.1" value={dosis} onChange={e => setDosis(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="kp-label">N° de lote *</label>
            <select className="kp-input" value={loteId} onChange={e => setLoteId(e.target.value)} style={{ appearance: "auto" }}>
              <option value="">Seleccionar…</option>
              {lotes.map(l => (
                <option key={l.id} value={l.id}>
                  {l.numeroLote} — {l.cantidadActual} dosis · vence en {l.diasParaVencer}d
                </option>
              ))}
            </select>
          </div>

          {stockInsuficiente && loteSeleccionado && (
            <div className="kp-alert kp-alert-warning" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span>Este lote solo alcanza para {alcanzaPara} de {pendientes.length} animales. Elegí otro lote para completar o reducí la selección.</span>
              <button type="button" className="btn" style={{ fontSize: 11, alignSelf: "flex-start" }} onClick={handleAplicarParcial} disabled={submitting || alcanzaPara === 0}>
                Aplicar a los primeros {alcanzaPara} y elegir otro lote para el resto
              </button>
            </div>
          )}

          <div>
            <label className="kp-label">Responsable *</label>
            <input className="kp-input" value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Nombre de quien aplica" />
          </div>

          <div>
            <label className="kp-label">Animales incluidos ({pendientes.length})</label>
            <div style={{ maxHeight: 140, overflowY: "auto", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
              {pendientes.map((id, i) => (
                <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: i > 0 ? "0.5px solid var(--border-subtle)" : "none" }}>
                  <span style={{ fontSize: 12 }}>{labelPorId[id]}</span>
                  <button onClick={() => quitarAnimal(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                    <IconX size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleRegistrarTodo} disabled={submitting || !loteId || pendientes.length === 0 || stockInsuficiente}>
              {submitting ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Registrando…</> : "Registrar aplicación"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Contenedor principal ───────────────────────────────────────── */

export function VisionGeneralSanidad() {
  const [data, setData] = useState<VisionGeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ grupo: VacunaGrupo; eventoIds: string[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sanidad/vision-general")
      .then(r => r.ok ? r.json() : null)
      .then((d: VisionGeneralData | null) => {
        setData(d);
        if (d) {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
          setExpandido(stored ?? d.expandirPorDefecto);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleModulo(key: string) {
    setExpandido(prev => {
      const next = prev === key ? null : key;
      if (typeof window !== "undefined") {
        if (next) sessionStorage.setItem(STORAGE_KEY, next);
        else sessionStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleRegistrar(grupo: VacunaGrupo, ids: string[]) {
    if (ids.length === 0) return;
    setModal({ grupo, eventoIds: ids });
  }

  function handleModalDone() {
    setSelected(new Set());
    load();
  }

  if (loading || !data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {modal && (
        <RegistrarAplicacionModal
          grupo={modal.grupo}
          eventoIds={modal.eventoIds}
          onClose={() => setModal(null)}
          onDone={handleModalDone}
        />
      )}

      <EstadoGeneralBadge estado={data.kpis.estadoGeneral} />
      <KpiCumplimientoRow kpis={data.kpis} />

      {data.kpis.alertasStock > 0 && (
        <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconAlertTriangle size={15} />
          {data.kpis.alertasStock} vacuna(s) crítica(s) con stock insuficiente.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.modulos.map(m => (
          <ModuloVacunacionAccordion
            key={m.key}
            modulo={m}
            isOpen={expandido === m.key}
            onToggle={() => toggleModulo(m.key)}
            selected={selected}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onRegistrar={handleRegistrar}
          />
        ))}
      </div>
    </div>
  );
}
