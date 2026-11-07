"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/sesion-cliente";
import { useSearchParams, useRouter } from "next/navigation";
import {
  IconHeart, IconHeartPlus, IconBuildingWarehouse, IconChartLine,
  IconDna, IconSettings, IconCheck, IconPlus,
  IconLoader2, IconToggleLeft, IconToggleRight, IconTrash, IconEdit,
  IconPackage,
} from "@tabler/icons-react";
import VacunasTab from "@/components/configuracion/vacunas-tab";

/* ─── Constantes de módulo ─────────────────────────────────────── */

const MODULES = [
  { key: "GESTACION",  label: "Gestación",   icon: IconHeart,             iconColor: "var(--success)" },
  { key: "MATERNIDAD", label: "Maternidad",  icon: IconHeartPlus,         iconColor: "var(--info)" },
  { key: "RECRIA",     label: "Iniciación",  icon: IconBuildingWarehouse, iconColor: "var(--warning)" },
  { key: "ENGORDE",    label: "Engorde",     icon: IconChartLine,         iconColor: "var(--danger)" },
  { key: "PLANTEL",    label: "Plantel Reproductivo", icon: IconDna,  iconColor: "var(--accent)" },
] as const;
type ModuleKey = typeof MODULES[number]["key"];

const CONFIG_TABS = ["Metas", "Genética", "Vacunas", "Procesos", "Alertas"] as const;
type ConfigTab = typeof CONFIG_TABS[number];

/* ─── Labels humanos para KPIs ─────────────────────────────────── */

const META_LABELS: Record<string, string> = {
  nacidos_vivos_meta:          "Nacidos vivos / parto (meta)",
  mortalidad_pct_max:          "Mortalidad máxima (%)",
  peso_destete_kg:             "Peso al destete (kg)",
  dias_lactancia:              "Días de lactancia",
  destetados_parto:            "Destetados por parto",
  pct_momificados_max:         "Momificados máx (%)",
  peso_min_entrada_kg:         "Peso mínimo entrada maternidad (kg)",
  tasa_concepcion_pct:         "Tasa de concepción (%)",
  dias_open_max:               "Días en abierto máx",
  partos_cerda_anio:           "Partos por cerda / año",
  peso_gestacion_kg:           "Peso gestante objetivo (kg)",
  dias_gestacion:              "Días de gestación referencia",
  gmd_fase1_gdia:              "GMD Fase 1 (g/día)",
  gmd_fase2_gdia:              "GMD Fase 2 (g/día)",
  conversion_alimenticia:      "Conversión alimenticia",
  peso_umbral_f1_f2:           "Peso umbral Fase 1→2 (kg)",
  peso_umbral_f2_engorde:      "Peso umbral Fase 2→Engorde (kg)",
  peso_faena_objetivo:         "Peso de faena objetivo (kg)",
  dias_engorde:                "Días de engorde",
  conversion_alimenticia_engorde: "Conversión alimenticia engorde",
};

const ALERTA_LABELS: Record<string, string> = {
  mortalidad_alta:              "Mortalidad alta",
  bajo_nacidos_vivos:           "Bajo nacidos vivos",
  baja_concepcion:              "Baja tasa de concepción",
  dias_open_excedidos:          "Días en abierto excedidos",
  repeticiones_celo_descarte:   "Repeticiones de celo antes del descarte",
  baja_gmd:                     "GMD por debajo del umbral",
  atraso_peso_faena:            "Atraso en peso de faena",
};

// Unidad del umbral de cada alerta — el número solo no dice si es %, días,
// repeticiones, etc.
const ALERTA_UNITS: Record<string, string> = {
  mortalidad_alta:              "%",
  bajo_nacidos_vivos:           "lechones",
  baja_concepcion:              "%",
  dias_open_excedidos:          "días",
  repeticiones_celo_descarte:   "repeticiones",
  baja_gmd:                     "g/día",
  atraso_peso_faena:            "kg",
};

/* ─── Tipos ─────────────────────────────────────────────────────── */

interface ConfigMeta { id: string; modulo: string; kpiKey: string; valor: string; }
type TipoGenetico = "RAZA_PURA" | "HIBRIDA_F1" | "SINTETICA" | "CRUZA_INTERNA";
type FuncionGenetica = "MATERNA" | "PATERNA";
interface Genetica {
  id: string; nombre: string; empresa?: string | null; tipoGenetico: TipoGenetico;
  funcion: FuncionGenetica; composicionRacial?: string | null;
  metaNacidosVivos?: number | null; activa: boolean;
}
interface ConfigAlerta {
  id: string; modulo: string; eventoKey: string; umbral?: string;
  gravedad: string; canales: string[]; activa: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function Spinner() {
  return <IconLoader2 size={15} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />;
}

function GravedadBadge({ g }: { g: string }) {
  const map: Record<string, string> = { DANGER: "badge-danger", WARNING: "badge-warn", INFO: "badge-info" };
  return <span className={`badge ${map[g] ?? "badge"}`}>{g}</span>;
}

/* ─── Sub-componentes de tab ─────────────────────────────────────── */

function MetasTab({ modulo }: { modulo: ModuleKey }) {
  const [metas, setMetas] = useState<ConfigMeta[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/config/metas?modulo=${modulo}`);
    if (r.ok) setMetas(await r.json());
    setLoading(false);
  }, [modulo]);

  useEffect(() => { load(); }, [load]);

  async function save(kpiKey: string) {
    const valor = editing[kpiKey];
    if (valor === undefined) return;
    setSaving(kpiKey);
    await fetch("/api/config/metas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo, kpiKey, valor: Number(valor) }),
    });
    setSaving(null);
    setEditing(p => { const n = { ...p }; delete n[kpiKey]; return n; });
    load();
  }

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  if (metas.length === 0) return (
    <div style={{ padding: 24 }}>
      <div className="kp-alert kp-alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
        No hay metas configuradas para este módulo. Aplicá los valores por defecto:
      </div>
      <button className="btn btn-primary" onClick={async () => {
        await fetch("/api/config/seed", { method: "POST" });
        load();
      }}>
        Cargar valores por defecto
      </button>
    </div>
  );

  return (
    <div>
      <table className="kp-table">
        <thead>
          <tr>
            <th style={{ width: "55%" }}>KPI / Indicador</th>
            <th>Clave</th>
            <th style={{ width: 160 }}>Valor</th>
            <th style={{ width: 72 }}></th>
          </tr>
        </thead>
        <tbody>
          {metas.map(m => {
            const editVal = editing[m.kpiKey];
            const isDirty = editVal !== undefined && editVal !== String(m.valor);
            return (
              <tr key={m.id}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>{META_LABELS[m.kpiKey] ?? m.kpiKey}</td>
                <td style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>{m.kpiKey}</td>
                <td>
                  <input
                    className="kp-input"
                    type="number"
                    step="0.01"
                    value={editVal ?? m.valor}
                    onChange={e => setEditing(p => ({ ...p, [m.kpiKey]: e.target.value }))}
                    style={{ height: 30, fontSize: 12 }}
                  />
                </td>
                <td>
                  {isDirty && (
                    <button
                      className="btn btn-primary"
                      style={{ height: 30, padding: "0 10px", fontSize: 11 }}
                      onClick={() => save(m.kpiKey)}
                      disabled={saving === m.kpiKey}
                    >
                      {saving === m.kpiKey ? <Spinner /> : <><IconCheck size={12} /> Guardar</>}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TIPO_GENETICO_LABELS: Record<TipoGenetico, string> = {
  RAZA_PURA: "Raza pura", HIBRIDA_F1: "Híbrida F1", SINTETICA: "Sintética", CRUZA_INTERNA: "Cruza interna",
};
const FUNCION_GENETICA_LABELS: Record<FuncionGenetica, string> = {
  MATERNA: "Materna", PATERNA: "Paterna",
};

const EMPTY_GENETICA_FORM = {
  nombre: "", empresa: "", tipoGenetico: "HIBRIDA_F1" as TipoGenetico, funcion: "MATERNA" as FuncionGenetica,
  composicionRacial: "", metaNacidosVivos: "",
};

function GeneticaTab() {
  const [genetica, setGenetica] = useState<Genetica[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_GENETICA_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/config/genetica");
    if (r.ok) setGenetica(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActiva(g: Genetica) {
    await fetch(`/api/config/genetica/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !g.activa }),
    });
    load();
  }

  async function handleAdd() {
    if (!form.nombre || !form.tipoGenetico || !form.funcion || !form.composicionRacial) {
      alert("Nombre, tipo genético, función y composición racial son requeridos");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/config/genetica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        empresa: form.empresa || null,
        metaNacidosVivos: form.funcion === "MATERNA" && form.metaNacidosVivos ? Number(form.metaNacidosVivos) : null,
      }),
    });
    setSaving(false);
    if (r.ok) { setShowForm(false); setForm({ ...EMPTY_GENETICA_FORM }); load(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  const F = (k: keyof typeof form, v: string) => setForm(p => ({
    ...p, [k]: v,
    ...(k === "funcion" && v === "PATERNA" ? { metaNacidosVivos: "" } : {}),
  }));

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} /> Agregar genética
        </button>
      </div>
      <table className="kp-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Función</th>
            <th>Composición</th>
            <th>Meta NV</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {genetica.map(g => (
            <tr key={g.id} style={{ opacity: g.activa ? 1 : 0.5 }}>
              <td>
                <div style={{ fontWeight: 500 }}>{g.nombre}</div>
                {g.empresa && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{g.empresa}</div>}
              </td>
              <td><span className="badge badge-mat">{TIPO_GENETICO_LABELS[g.tipoGenetico]}</span></td>
              <td><span className={`badge ${g.funcion === "MATERNA" ? "badge-ok" : "badge-info"}`}>{FUNCION_GENETICA_LABELS[g.funcion]}</span></td>
              <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{g.composicionRacial ?? "—"}</td>
              <td style={{ textAlign: "center" }}>{g.funcion === "PATERNA" ? "—" : g.metaNacidosVivos ?? "—"}</td>
              <td>
                <button
                  onClick={() => toggleActiva(g)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: g.activa ? "var(--success)" : "var(--text-muted)", padding: 0 }}
                >
                  {g.activa ? <IconToggleRight size={20} /> : <IconToggleLeft size={20} />}
                  <span style={{ fontSize: 11 }}>{g.activa ? "Activa" : "Inactiva"}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>Agregar genética</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Nombre *</label>
                  <input className="kp-input" value={form.nombre} onChange={e => F("nombre", e.target.value)} placeholder="Ej: TN70, Naïma CG36…" />
                </div>
                <div>
                  <label className="kp-label">Empresa</label>
                  <input className="kp-input" value={form.empresa} onChange={e => F("empresa", e.target.value)} placeholder="Ej: Topigs Norsvin, Nucleus, DanBred…" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Tipo genético *</label>
                  <select className="kp-input" value={form.tipoGenetico} onChange={e => F("tipoGenetico", e.target.value)} style={{ appearance: "auto" }}>
                    {(Object.keys(TIPO_GENETICO_LABELS) as TipoGenetico[]).map(t => (
                      <option key={t} value={t}>{TIPO_GENETICO_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Función *</label>
                  <select className="kp-input" value={form.funcion} onChange={e => F("funcion", e.target.value)} style={{ appearance: "auto" }}>
                    {(Object.keys(FUNCION_GENETICA_LABELS) as FuncionGenetica[]).map(f => (
                      <option key={f} value={f}>{FUNCION_GENETICA_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="kp-label">Composición racial *</label>
                <input className="kp-input" value={form.composicionRacial} onChange={e => F("composicionRacial", e.target.value)} placeholder="Ej: Landrace × Large White" />
              </div>
              <div>
                <label className="kp-label">Meta nacidos vivos{form.funcion === "PATERNA" ? " (no aplica a genética paterna)" : ""}</label>
                <input
                  className="kp-input" type="number" step="0.1"
                  value={form.metaNacidosVivos}
                  disabled={form.funcion === "PATERNA"}
                  onChange={e => F("metaNacidosVivos", e.target.value)}
                  placeholder="Ej: 14"
                  style={form.funcion === "PATERNA" ? { opacity: 0.5 } : undefined}
                />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? <Spinner /> : "Agregar genética"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertasTab({ modulo }: { modulo: ModuleKey }) {
  const [alertas, setAlertas] = useState<ConfigAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUmbral, setEditingUmbral] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/config/alertas?modulo=${modulo}`);
    if (r.ok) setAlertas(await r.json());
    setLoading(false);
  }, [modulo]);

  useEffect(() => { load(); }, [load]);

  async function toggleActiva(a: ConfigAlerta) {
    await fetch("/api/config/alertas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: a.modulo, eventoKey: a.eventoKey, umbral: a.umbral, canales: a.canales, gravedad: a.gravedad, activa: !a.activa }),
    });
    load();
  }

  async function saveUmbral(a: ConfigAlerta) {
    const umbral = editingUmbral[a.eventoKey];
    if (umbral === undefined) return;
    setSaving(a.eventoKey);
    await fetch("/api/config/alertas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: a.modulo, eventoKey: a.eventoKey, umbral: Number(umbral), canales: a.canales, gravedad: a.gravedad, activa: a.activa }),
    });
    setSaving(null);
    setEditingUmbral(p => { const n = { ...p }; delete n[a.eventoKey]; return n; });
    load();
  }

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  if (alertas.length === 0) return (
    <div style={{ padding: 24 }}>
      <div className="kp-alert kp-alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
        No hay alertas configuradas. Iniciá con los valores por defecto:
      </div>
      <button className="btn btn-primary" onClick={async () => {
        await fetch("/api/config/seed", { method: "POST" });
        load();
      }}>
        Cargar alertas por defecto
      </button>
    </div>
  );

  return (
    <table className="kp-table">
      <thead>
        <tr>
          <th>Evento</th>
          <th>Clave</th>
          <th>Umbral</th>
          <th>Gravedad</th>
          <th>Activa</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {alertas.map(a => {
          const editVal = editingUmbral[a.eventoKey];
          const isDirty = editVal !== undefined && editVal !== String(a.umbral ?? "");
          return (
            <tr key={a.id}>
              <td style={{ fontWeight: 500, fontSize: 12 }}>{ALERTA_LABELS[a.eventoKey] ?? a.eventoKey}</td>
              <td style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>{a.eventoKey}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    className="kp-input"
                    type="number"
                    step="0.1"
                    value={editVal ?? (a.umbral ?? "")}
                    onChange={e => setEditingUmbral(p => ({ ...p, [a.eventoKey]: e.target.value }))}
                    style={{ height: 28, width: 90, fontSize: 12 }}
                  />
                  {ALERTA_UNITS[a.eventoKey] && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ALERTA_UNITS[a.eventoKey]}</span>
                  )}
                  {isDirty && (
                    <button
                      className="btn btn-primary"
                      style={{ height: 28, padding: "0 8px", fontSize: 11 }}
                      onClick={() => saveUmbral(a)}
                      disabled={saving === a.eventoKey}
                    >
                      {saving === a.eventoKey ? <Spinner /> : <IconCheck size={12} />}
                    </button>
                  )}
                </div>
              </td>
              <td><GravedadBadge g={a.gravedad} /></td>
              <td>
                <button
                  onClick={() => toggleActiva(a)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: a.activa ? "var(--success)" : "var(--text-muted)", padding: 0 }}
                >
                  {a.activa ? <IconToggleRight size={20} /> : <IconToggleLeft size={20} />}
                </button>
              </td>
              <td></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Definición de procesos por módulo ─────────────────────────── */

interface NumParam   { type: "number";   label: string; min?: number; max?: number; unit?: string; defaultVal: number }
interface BoolParam  { type: "boolean";  label: string; defaultVal: boolean; hint?: string }
interface HorariosParam { type: "horarios"; label: string; defaultVal: string[] }
type ParamDef = NumParam | BoolParam | HorariosParam;

interface ProcesoTemplate {
  key: string;
  label: string;
  descripcion: string;
  params: Record<string, ParamDef>;
}

const MODULE_PROCESOS: Partial<Record<ModuleKey, ProcesoTemplate[]>> = {
  GESTACION: [
    {
      key: "protocolo_inseminacion",
      label: "Protocolo de inseminación artificial",
      descripcion: "Define cuántas dosis se aplican por ciclo de celo y el intervalo entre ellas. Dentro de este período no se generará alerta de repetición de celo.",
      params: {
        inseminaciones_por_ciclo: { type: "number",  label: "Inseminaciones por ciclo", min: 1, max: 5,  unit: "dosis",  defaultVal: 3  },
        intervalo_horas:          { type: "number",  label: "Intervalo entre dosis",    min: 4, max: 24, unit: "horas",  defaultVal: 12 },
        activo:                   { type: "boolean", label: "Proceso activo",                                            defaultVal: true },
      },
    },
    {
      key: "requisitos_servicio",
      label: "Requisitos mínimos para inseminación",
      descripcion: "Define el peso mínimo y los días mínimos desde ingreso/nacimiento que debe cumplir una cerda antes de ser inseminada. Las cerdas que no cumplan estos requisitos quedarán bloqueadas al registrar un servicio.",
      params: {
        peso_minimo_kg:                { type: "number",  label: "Peso mínimo",                   min: 50,  max: 300, unit: "kg",   defaultVal: 120 },
        dias_minimos_previo_servicio:  { type: "number",  label: "Días mínimos (edad/desde ingreso)", min: 0, max: 365, unit: "días", defaultVal: 180 },
        activo:                        { type: "boolean", label: "Proceso activo",                                                    defaultVal: true },
      },
    },
    {
      key: "recorrida_macho_celador",
      label: "Recorrida del macho celador",
      descripcion: "Detección de celo con macho celador — configura la frecuencia diaria y los horarios.",
      params: {
        vecesAlDia: { type: "number",   label: "Veces al día",            min: 1, max: 4,   unit: "veces",  defaultVal: 2 },
        horarios:   { type: "horarios", label: "Horarios de recorrida",                                      defaultVal: ["07:00", "15:00"] },
        activo:     { type: "boolean",  label: "Proceso activo",                                             defaultVal: true },
        notificar:  { type: "boolean",  label: "Recordatorio automático", hint: "Envía alerta al operador en cada horario programado", defaultVal: true },
      },
    },
    {
      key: "protocolo_seguimiento_servicio",
      label: "Seguimiento post-servicio",
      descripcion: "Define los días desde la inseminación para la confirmación de retorno al celo y la ecografía de diagnóstico de preñez. Estos plazos se usan para calcular las fechas en el panel de cerdas servidas.",
      params: {
        dias_confirmacion_celo: { type: "number", label: "Días para confirmación de celo", min: 14, max: 30, unit: "días", defaultVal: 21 },
        dias_ecografia:         { type: "number", label: "Días para ecografía",            min: 21, max: 42, unit: "días", defaultVal: 28 },
        activo:                 { type: "boolean", label: "Proceso activo",                                               defaultVal: true },
      },
    },
  ],
  MATERNIDAD: [
    {
      key: "corte_cola",
      label: "Corte de cola",
      descripcion: "Procedimiento de corte de cola en lechones recién nacidos.",
      params: {
        diasPostParto: { type: "number",  label: "Días post-parto",       min: 0, max: 7,  unit: "días", defaultVal: 1 },
        activo:        { type: "boolean", label: "Procedimiento activo",                                  defaultVal: true },
        notificar:     { type: "boolean", label: "Notificación automática", hint: "Genera tarea en Sanidad automáticamente al registrar el parto", defaultVal: true },
      },
    },
    {
      key: "descolmillado",
      label: "Descolmillado",
      descripcion: "Recorte de colmillos en lechones para evitar lesiones a la madre y compañeros.",
      params: {
        diasPostParto: { type: "number",  label: "Días post-parto",       min: 0, max: 7,  unit: "días", defaultVal: 1 },
        activo:        { type: "boolean", label: "Procedimiento activo",                                  defaultVal: true },
        notificar:     { type: "boolean", label: "Notificación automática", hint: "Genera tarea en Sanidad automáticamente al registrar el parto", defaultVal: true },
      },
    },
    {
      key: "castracion",
      label: "Castración",
      descripcion: "Castración de lechones machos — debe realizarse antes de los 21 días.",
      params: {
        diasPostParto: { type: "number",  label: "Días post-parto",          min: 1, max: 21, unit: "días", defaultVal: 7 },
        activo:        { type: "boolean", label: "Procedimiento activo",                                    defaultVal: true },
        notificar:     { type: "boolean", label: "Notificación automática",   hint: "Genera tarea en Sanidad automáticamente al registrar el parto", defaultVal: true },
      },
    },
    {
      key: "dias_lactancia",
      label: "Días de lactancia",
      descripcion: "Duración estándar del período de lactancia hasta el destete.",
      params: {
        dias:                { type: "number",  label: "Días de lactancia",          min: 14, max: 35, unit: "días", defaultVal: 21 },
        notificarDiasAntes:  { type: "number",  label: "Avisar con anticipación",    min: 1,  max: 7,  unit: "días", defaultVal: 2 },
        notificar:           { type: "boolean", label: "Notificación automática",     hint: "Alerta cuando se acerca la fecha de destete", defaultVal: true },
      },
    },
    {
      key: "desinfeccion_sala",
      label: "Desinfección de sala",
      descripcion: "Limpieza y desinfección periódica de las salas de parición.",
      params: {
        frecuenciaDias: { type: "number",  label: "Cada cuántos días",    min: 1, max: 30, unit: "días", defaultVal: 7 },
        activo:         { type: "boolean", label: "Procedimiento activo",                                defaultVal: true },
        notificar:      { type: "boolean", label: "Notificación automática", hint: "Genera tarea de limpieza periódicamente",             defaultVal: true },
      },
    },
  ],
  RECRIA: [
    {
      key: "desinfeccion_sala",
      label: "Desinfección de sala",
      descripcion: "Limpieza y desinfección periódica de las salas de recría.",
      params: {
        frecuenciaDias: { type: "number",  label: "Cada cuántos días",    min: 1, max: 30, unit: "días", defaultVal: 14 },
        activo:         { type: "boolean", label: "Procedimiento activo",                                defaultVal: true },
        notificar:      { type: "boolean", label: "Notificación automática",                             defaultVal: true },
      },
    },
  ],
  ENGORDE: [
    {
      key: "desinfeccion_sala",
      label: "Desinfección de sala",
      descripcion: "Limpieza y desinfección periódica de los corrales de engorde.",
      params: {
        frecuenciaDias: { type: "number",  label: "Cada cuántos días",    min: 1, max: 30, unit: "días", defaultVal: 14 },
        activo:         { type: "boolean", label: "Procedimiento activo",                                defaultVal: true },
        notificar:      { type: "boolean", label: "Notificación automática",                             defaultVal: true },
      },
    },
  ],
  PLANTEL: [
    {
      key: "cuarentena_hembras",
      label: "Cuarentena de hembras nuevas o enfermas",
      descripcion: "Define la cantidad de días de cuarentena obligatoria para hembras que ingresan al plantel o que son reingresadas por enfermedad. El sistema mostrará la fecha de alta posible y bloqueará el alta manual antes de ese plazo.",
      params: {
        dias_cuarentena:   { type: "number",  label: "Días de cuarentena",    min: 7, max: 90,  unit: "días",  defaultVal: 30 },
        activo:            { type: "boolean", label: "Control activo",         hint: "Si está activo, el sistema bloquea el alta antes de cumplir los días configurados",  defaultVal: true },
        notificar:         { type: "boolean", label: "Notificar alta posible", hint: "Envía alerta cuando la cerda cumple los días de cuarentena y puede recibir el alta", defaultVal: true },
      },
    },
    {
      key: "cuarentena_reproductores",
      label: "Cuarentena de reproductores nuevos",
      descripcion: "Define la cantidad de días de cuarentena para reproductores (verracos) que ingresan al plantel.",
      params: {
        dias_cuarentena:   { type: "number",  label: "Días de cuarentena",    min: 7, max: 90,  unit: "días",  defaultVal: 45 },
        activo:            { type: "boolean", label: "Control activo",                                          defaultVal: true },
        notificar:         { type: "boolean", label: "Notificar alta posible",                                  defaultVal: true },
      },
    },
  ],
};

function getDefaultValor(params: Record<string, ParamDef>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(params)) out[k] = p.defaultVal;
  return out;
}

function ProcesosTab({ modulo }: { modulo: ModuleKey }) {
  const templates = MODULE_PROCESOS[modulo] ?? [];
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [saved,    setSaved]    = useState<string | null>(null);
  // valor por procesoKey
  const [valores, setValores]   = useState<Record<string, Record<string, unknown>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/config/procesos?modulo=${modulo}`);
    if (r.ok) {
      const data = await r.json() as { procesoKey: string; valor: Record<string, unknown> }[];
      const tpls = MODULE_PROCESOS[modulo] ?? [];
      const m: Record<string, Record<string, unknown>> = {};
      for (const t of tpls) {
        const stored = data.find(d => d.procesoKey === t.key);
        m[t.key] = stored ? { ...getDefaultValor(t.params), ...(stored.valor as object) } : getDefaultValor(t.params);
      }
      setValores(m);
    }
    setLoading(false);
  }, [modulo]);

  useEffect(() => { load(); }, [load]);

  function setParam(procesoKey: string, paramKey: string, value: unknown) {
    setValores(prev => ({
      ...prev,
      [procesoKey]: { ...prev[procesoKey], [paramKey]: value },
    }));
  }

  function addHorario(procesoKey: string, paramKey: string) {
    const current = (valores[procesoKey]?.[paramKey] as string[]) ?? [];
    setParam(procesoKey, paramKey, [...current, "08:00"]);
  }

  function removeHorario(procesoKey: string, paramKey: string, idx: number) {
    const current = (valores[procesoKey]?.[paramKey] as string[]) ?? [];
    setParam(procesoKey, paramKey, current.filter((_, i) => i !== idx));
  }

  function updateHorario(procesoKey: string, paramKey: string, idx: number, val: string) {
    const current = (valores[procesoKey]?.[paramKey] as string[]) ?? [];
    const updated = [...current];
    updated[idx] = val;
    setParam(procesoKey, paramKey, updated);
  }

  async function saveProceso(procesoKey: string) {
    setSaving(procesoKey);
    const r = await fetch("/api/config/procesos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo, procesoKey, valor: valores[procesoKey] }),
    });
    setSaving(null);
    if (r.ok) { setSaved(procesoKey); setTimeout(() => setSaved(null), 2500); }
  }

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  if (templates.length === 0) return (
    <div style={{ padding: 24 }}>
      <div className="kp-alert kp-alert-info" style={{ fontSize: 12 }}>
        Los procesos configurables para este módulo estarán disponibles próximamente.
      </div>
    </div>
  );

  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      {templates.map(t => {
        const v = valores[t.key] ?? {};
        const isActive = v.activo !== false;
        return (
          <div key={t.key} className="panel" style={{ padding: 20, opacity: isActive ? 1 : 0.65 }}>
            {/* Encabezado del proceso */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.descripcion}</div>
              </div>
              {saved === t.key && (
                <span style={{ fontSize: 11, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
                  <IconCheck size={12} /> Guardado
                </span>
              )}
            </div>

            {/* Parámetros */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
              {Object.entries(t.params).map(([paramKey, paramDef]) => {
                if (paramDef.type === "number") {
                  return (
                    <div key={paramKey}>
                      <label className="kp-label">{paramDef.label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          className="kp-input"
                          type="number"
                          min={paramDef.min}
                          max={paramDef.max}
                          value={String(v[paramKey] ?? paramDef.defaultVal)}
                          onChange={e => setParam(t.key, paramKey, Number(e.target.value))}
                          style={{ width: 80 }}
                        />
                        {paramDef.unit && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{paramDef.unit}</span>}
                      </div>
                    </div>
                  );
                }
                if (paramDef.type === "boolean") {
                  const checked = v[paramKey] !== false;
                  return (
                    <div key={paramKey} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label className="kp-label">{paramDef.label}</label>
                      <button
                        onClick={() => setParam(t.key, paramKey, !checked)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, width: "fit-content" }}
                      >
                        {checked
                          ? <IconToggleRight size={22} style={{ color: "var(--accent)" }} />
                          : <IconToggleLeft  size={22} style={{ color: "var(--text-muted)" }} />
                        }
                        <span style={{ fontSize: 12, color: checked ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {checked ? "Sí" : "No"}
                        </span>
                      </button>
                      {paramDef.hint && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{paramDef.hint}</span>
                      )}
                    </div>
                  );
                }
                if (paramDef.type === "horarios") {
                  const horarios = (v[paramKey] as string[]) ?? paramDef.defaultVal;
                  return (
                    <div key={paramKey} style={{ gridColumn: "1 / -1" }}>
                      <label className="kp-label">{paramDef.label}</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>
                        {horarios.map((h, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              className="kp-input"
                              type="time"
                              value={h}
                              onChange={e => updateHorario(t.key, paramKey, idx, e.target.value)}
                              style={{ width: 100 }}
                            />
                            <button
                              onClick={() => removeHorario(t.key, paramKey, idx)}
                              disabled={horarios.length <= 1}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 2, display: "flex" }}
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        ))}
                        <button className="btn" style={{ fontSize: 11, height: 32 }} onClick={() => addHorario(t.key, paramKey)}>
                          <IconPlus size={12} /> Agregar horario
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "0.5px solid var(--border-default)", paddingTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => saveProceso(t.key)}
                disabled={saving === t.key}
                style={{ fontSize: 12 }}
              >
                {saving === t.key ? <Spinner /> : <IconCheck size={12} />}
                {saving === t.key ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────────── */

export default function ConfiguracionPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [modulo, setModulo] = useState<ModuleKey>((searchParams.get("modulo") as ModuleKey) ?? "GESTACION");
  const [tab, setTab] = useState<ConfigTab>((searchParams.get("tab") as ConfigTab) ?? "Metas");

  function changeModulo(m: ModuleKey) {
    setModulo(m);
    router.replace(`/configuracion?modulo=${m}&tab=${tab}`, { scroll: false });
  }
  function changeTab(t: ConfigTab) {
    setTab(t);
    router.replace(`/configuracion?modulo=${modulo}&tab=${t}`, { scroll: false });
  }

  if (status === "loading") return null;

  const activeModule = MODULES.find(m => m.key === modulo) ?? MODULES[0];

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Module sidebar */}
      <aside style={{
        width: 200, flexShrink: 0, borderRight: "0.5px solid var(--border-default)",
        background: "var(--bg-elevated)", display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid var(--border-default)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconSettings size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Configuración</span>
          </div>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "3px 0 0" }}>
            Metas, genética, vacunas y alertas por módulo
          </p>
        </div>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {MODULES.map(m => {
            const isActive = m.key === modulo;
            return (
              <button
                key={m.key}
                onClick={() => changeModulo(m.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", border: "none", textAlign: "left", cursor: "pointer",
                  background: isActive ? "var(--bg-overlay)" : "transparent",
                  borderRight: isActive ? `2px solid var(--accent)` : "2px solid transparent",
                  transition: "background 0.1s",
                }}
              >
                <m.icon size={14} style={{ color: isActive ? m.iconColor : "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isActive ? 500 : 400 }}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
        {/* Module header */}
        <div style={{ padding: "14px 24px 0", borderBottom: "0.5px solid var(--border-default)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <activeModule.icon size={16} style={{ color: activeModule.iconColor }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{activeModule.label}</span>
          </div>

          {/* Config tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {CONFIG_TABS.map(t => (
              <button
                key={t}
                onClick={() => changeTab(t)}
                style={{
                  padding: "7px 16px", fontSize: 12, fontWeight: 500, border: "none", background: "none",
                  cursor: "pointer",
                  color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "color 0.12s",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: "16px 24px" }}>
          {tab === "Metas"    && <MetasTab    modulo={modulo} />}
          {tab === "Genética" && <GeneticaTab />}
          {tab === "Vacunas"  && <VacunasTab  modulo={modulo} />}
          {tab === "Procesos" && <ProcesosTab modulo={modulo} />}
          {tab === "Alertas"  && <AlertasTab  modulo={modulo} />}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
