"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import {
  IconShield, IconCheck, IconAlertTriangle,
  IconLoader2, IconRefresh, IconMedicalCross, IconPackage,
  IconPlus, IconDatabase, IconChevronUp,
  IconArrowLeft, IconVaccine, IconScissors,
  IconStethoscope, IconMicroscope, IconFlame,
} from "@tabler/icons-react";
import { VisionGeneralSanidad } from "@/components/sanidad/vision-general-sanidad";
import { PanelMaternidadSanidad } from "@/components/sanidad/panel-maternidad";
import { PanelTratamientos } from "@/components/sanidad/panel-tratamientos";
import { PanelNecropsias } from "@/components/sanidad/panel-necropsias";
import { PanelBrotes } from "@/components/sanidad/panel-brotes";
import { CentralAnalisisSanidad } from "@/components/sanidad/central-analisis";

/* ─── Tipos ──────────────────────────────────────────────────────── */

interface VacunaItem {
  id: string;
  nombre: string;
  enfermedad: string;
  sectorDestino: string;
  categoria: string;
  codigo: string | null;
  unidadMedida: string;
  stockMinimo: number | null;
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
  { key: "vision",   label: "Visión general"    },
  { key: "analisis", label: "Central de análisis" },
];

const INGRESO_TABS = [
  { key: "vacunacion", label: "Registrar vacunación" },
  { key: "lotes",      label: "Ingresar lote"        },
  { key: "vacunas",    label: "Nuevo producto"       },
  { key: "protocolos", label: "Protocolos"           },
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

/* ─── Página principal ───────────────────────────────────────────── */

export default function SanidadPage() {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [tab,       setTab]       = useState<string>("vision");
  const [ingresoTab, setIngresoTab] = useState<string>("vacunacion");

  const [vacunas,   setVacunas]   = useState<VacunaItem[]>([]);
  const [lotes,     setLotes]     = useState<LoteItem[]>([]);
  const [eventos,   setEventos]   = useState<EventoItem[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);

  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState<string | null>(null);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, lRes, eRes, pRes] = await Promise.all([
        fetch("/api/sanidad/vacunas"),
        fetch("/api/sanidad/lotes"),
        fetch("/api/sanidad/eventos?hasta=2030-01-01"),
        fetch("/api/sanidad/protocolos"),
      ]);
      const [vd, ld, ed, pd] = await Promise.all([
        vRes.json(), lRes.json(), eRes.json(), pRes.json(),
      ]);
      if (Array.isArray(vd)) setVacunas(vd);
      if (Array.isArray(ld)) setLotes(ld);
      if (Array.isArray(ed)) setEventos(ed);
      if (Array.isArray(pd)) setProtocolos(pd);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const noVacunas = !loading && vacunas.length === 0;

  /* ─── Formulario nuevo lote ───────────────────────────────────── */
  const EMPTY_LOTE_FORM = { vacunaId: "", numeroLote: "", cantidad: "", fechaVencimiento: "", proveedor: "", costoUnitario: "", observaciones: "" };
  const [loteForm, setLoteForm] = useState(EMPTY_LOTE_FORM);
  const [loteSaving, setLoteSaving] = useState(false);
  const [loteErr,    setLoteErr]    = useState<string | null>(null);
  const productoSeleccionado = vacunas.find(v => v.id === loteForm.vacunaId);
  const UNIDAD_LABEL: Record<string, string> = { DOSIS: "dosis", ML: "ml", KG: "kg", UNIDAD: "unidades", SACO: "sacos" };

  async function submitLote(e: React.FormEvent) {
    e.preventDefault(); setLoteErr(null);
    if (!loteForm.vacunaId || !loteForm.numeroLote || !loteForm.cantidad || !loteForm.fechaVencimiento) {
      setLoteErr("Completá todos los campos obligatorios"); return;
    }
    setLoteSaving(true);
    const res = await fetch("/api/sanidad/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...loteForm, cantidad: Number(loteForm.cantidad),
        costoUnitario: loteForm.costoUnitario ? Number(loteForm.costoUnitario) : null,
      }),
    });
    setLoteSaving(false);
    if (res.ok) {
      setLoteForm(EMPTY_LOTE_FORM);
      showMsg("Lote ingresado correctamente");
      loadAll();
    } else {
      const d = await res.json();
      setLoteErr(d.error ?? "Error al guardar");
    }
  }

  /* ─── Formulario nuevo producto ───────────────────────────────── */
  const EMPTY_VAC_FORM = {
    categoria: "VACUNA", nombre: "", enfermedad: "", sectorDestino: "plantel",
    viaAplicacion: "IM", dosisMl: "2", criticidad: "alta", bloqueoServicio: false,
    stockMinimo: "", observaciones: "",
  };
  const [vacForm, setVacForm] = useState(EMPTY_VAC_FORM);
  const [vacSaving, setVacSaving] = useState(false);
  const [vacErr,    setVacErr]    = useState<string | null>(null);

  async function submitVacuna(e: React.FormEvent) {
    e.preventDefault(); setVacErr(null);
    if (!vacForm.nombre || !vacForm.enfermedad) { setVacErr("Nombre y enfermedad son requeridos"); return; }
    setVacSaving(true);
    const res = await fetch("/api/sanidad/vacunas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...vacForm,
        dosisMl: Number(vacForm.dosisMl),
        stockMinimo: vacForm.stockMinimo ? Number(vacForm.stockMinimo) : null,
      }),
    });
    setVacSaving(false);
    if (res.ok) {
      const creado = await res.json();
      setVacForm(EMPTY_VAC_FORM);
      showMsg(`Producto ${creado.codigo} agregado al catálogo`);
      loadAll();
    } else {
      const d = await res.json();
      setVacErr(d.error ?? "Error al guardar");
    }
  }

  const isIngreso = tab === "ingreso";

  const pendientesVacunacion = useMemo(
    () => eventos.filter(e => e.estado !== "aplicado" && e.estado !== "omitido").length,
    [eventos],
  );

  const CATEGORIAS = [
    { key: "vacunacion",   label: "Vacunación",             icon: IconVaccine,     color: "var(--info)",    sub: "Protocolo, lotes y aplicación",                                    contador: pendientesVacunacion },
    { key: "maternidad",   label: "Sanidad de maternidad",  icon: IconScissors,    color: "#e0785c",         sub: "Descolmillado, corte de cola, corte de ombligo, hierro, castración" },
    { key: "tratamientos", label: "Tratamientos clínicos",  icon: IconStethoscope, color: "#8b5cf6",         sub: "Diagnóstico, medicamento y período de retiro" },
    { key: "necropsias",   label: "Necropsias / bajas",     icon: IconMicroscope, color: "var(--text-muted)", sub: "Registro de mortalidad con causa sanitaria" },
    { key: "brotes",       label: "Brotes / alertas",       icon: IconFlame,       color: "var(--warning)", sub: "Heatmap sanitario — solo lectura" },
  ] as const;

  // ── Landing: hub de categorías ──────────────────────────────────
  if (categoria === null) {
    return (
      <>
        <Topbar title="Sanidad" icon={IconShield} iconColor="var(--info)" />
        <div style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Sanidad</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>Elegí una categoría para ver el detalle.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {CATEGORIAS.map(c => (
              <button
                key={c.key}
                onClick={() => setCategoria(c.key)}
                className="panel"
                style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", cursor: "pointer", transition: "filter 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.97)")}
                onMouseLeave={e => (e.currentTarget.style.filter = "none")}
              >
                <c.icon size={26} style={{ color: c.color }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{c.sub}</div>
                {"contador" in c && c.contador > 0 && (
                  <span style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
                    {c.contador} pendiente{c.contador > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── Categorías nuevas: paneles simples con su propio "volver" ───
  if (categoria !== "vacunacion") {
    const cat = CATEGORIAS.find(c => c.key === categoria)!;
    return (
      <>
        <Topbar
          title="Sanidad"
          icon={IconShield}
          iconColor="var(--info)"
          actions={
            <button className="btn" onClick={() => setCategoria(null)} style={{ fontSize: 11, height: 30 }}>
              <IconArrowLeft size={12} /> Categorías
            </button>
          }
        />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <cat.icon size={18} style={{ color: cat.color }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{cat.label}</span>
          </div>
          {categoria === "maternidad"   && <PanelMaternidadSanidad />}
          {categoria === "tratamientos" && <PanelTratamientos />}
          {categoria === "necropsias"   && <PanelNecropsias />}
          {categoria === "brotes"       && <PanelBrotes />}
        </div>
      </>
    );
  }

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
            <button className="btn" onClick={() => setCategoria(null)} style={{ fontSize: 11, height: 30 }}>
              <IconArrowLeft size={12} /> Categorías
            </button>
            {isIngreso ? (
              <button className="btn" onClick={() => setTab("vision")} style={{ fontSize: 11, height: 30 }}>
                ← Volver
              </button>
            ) : (
              <>
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
          <VisionGeneralSanidad />
        )}

        {/* ── CENTRAL DE ANÁLISIS ────────────────────────────────── */}
        {!loading && !noVacunas && tab === "analisis" && (
          <CentralAnalisisSanidad />
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
                      <label className="kp-label">Producto *</label>
                      <select className="kp-input" style={{ appearance: "auto" }} value={loteForm.vacunaId} onChange={e => setLoteForm(f => ({ ...f, vacunaId: e.target.value }))}>
                        <option value="">— Seleccionar —</option>
                        {vacunas.map(v => <option key={v.id} value={v.id}>{v.codigo ? `${v.codigo} — ` : ""}{v.nombre} — {v.enfermedad}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Número de lote *</label>
                        <input className="kp-input" placeholder="LOT-2026-001" value={loteForm.numeroLote} onChange={e => setLoteForm(f => ({ ...f, numeroLote: e.target.value }))} />
                      </div>
                      <div>
                        <label className="kp-label">Cantidad ({UNIDAD_LABEL[productoSeleccionado?.unidadMedida ?? "DOSIS"]}) *</label>
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
                      <label className="kp-label">Costo unitario (₲ por {UNIDAD_LABEL[productoSeleccionado?.unidadMedida ?? "DOSIS"]})</label>
                      <input type="number" min="0" step="1" className="kp-input" placeholder="Opcional — para ver cuánto sale este producto en Logística" value={loteForm.costoUnitario} onChange={e => setLoteForm(f => ({ ...f, costoUnitario: e.target.value }))} />
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

            {/* Nuevo producto */}
            {ingresoTab === "vacunas" && (
              <div style={{ maxWidth: 560 }}>
                <form onSubmit={submitVacuna} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconMedicalCross size={14} style={{ color: "var(--accent)" }} /> Agregar producto al catálogo
                  </div>
                  {vacErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><IconAlertTriangle size={11} /> {vacErr}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="kp-label">Tipo de producto *</label>
                      <select className="kp-input" style={{ appearance: "auto" }} value={vacForm.categoria} onChange={e => setVacForm(f => ({ ...f, categoria: e.target.value }))}>
                        <option value="VACUNA">Vacuna</option>
                        <option value="SUPLEMENTO">Suplemento</option>
                        <option value="MEDICAMENTO">Medicamento</option>
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="kp-label">Nombre *</label>
                        <input className="kp-input" placeholder="Ej: Parvovirus + Leptospira" value={vacForm.nombre} onChange={e => setVacForm(f => ({ ...f, nombre: e.target.value }))} />
                      </div>
                      <div>
                        <label className="kp-label">Enfermedad / indicación *</label>
                        <input className="kp-input" placeholder="Ej: Parvovirus porcino" value={vacForm.enfermedad} onChange={e => setVacForm(f => ({ ...f, enfermedad: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {vacForm.categoria === "VACUNA" && (
                        <div>
                          <label className="kp-label">Sector destino</label>
                          <select className="kp-input" style={{ appearance: "auto" }} value={vacForm.sectorDestino} onChange={e => setVacForm(f => ({ ...f, sectorDestino: e.target.value }))}>
                            <option value="plantel">Plantel Reproductivo (cerdas)</option>
                            <option value="lechones">Lechones</option>
                            <option value="gestacion">Gestación</option>
                            <option value="recria">Recría</option>
                            <option value="engorde">Engorde</option>
                            <option value="all">Toda la granja</option>
                          </select>
                        </div>
                      )}
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
                      {vacForm.categoria === "VACUNA" ? (
                        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-primary)" }}>
                            <input type="checkbox" checked={vacForm.bloqueoServicio} onChange={e => setVacForm(f => ({ ...f, bloqueoServicio: e.target.checked }))} style={{ width: 14, height: 14 }} />
                            Bloquea servicio si no está aplicada
                          </label>
                        </div>
                      ) : (
                        <div>
                          <label className="kp-label">Stock mínimo</label>
                          <input type="number" min="0" className="kp-input" placeholder="Alerta si el stock cae debajo de esto" value={vacForm.stockMinimo} onChange={e => setVacForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="kp-label">Observaciones</label>
                      <input className="kp-input" placeholder="Opcional..." value={vacForm.observaciones} onChange={e => setVacForm(f => ({ ...f, observaciones: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" className="btn btn-primary" disabled={vacSaving} style={{ height: 32, fontSize: 12 }}>
                        {vacSaving ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <IconPlus size={13} />}
                        {vacSaving ? "Guardando..." : "Agregar producto"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Protocolos (solo lectura) */}
            {ingresoTab === "protocolos" && (
              <div style={{ maxWidth: 720 }}>
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
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
