"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  IconHeart, IconHeartPlus, IconBuildingWarehouse, IconChartLine,
  IconDna, IconFlask, IconSettings, IconCheck, IconPlus,
  IconLoader2, IconToggleLeft, IconToggleRight, IconTrash, IconEdit,
  IconFileText, IconAlertCircle, IconPackage,
} from "@tabler/icons-react";

/* ─── Momentos de aplicación estandarizados ────────────────────── */

const MOMENTO_LABELS: Record<string, string> = {
  PRE_SERVICIO_7:    "7d pre-servicio",
  PRE_SERVICIO_21:   "21d pre-servicio",
  PRE_SERVICIO_42:   "42d pre-servicio",
  PRE_PARTO_30:      "30d pre-parto",
  PRE_PARTO_14:      "14d pre-parto",
  POST_PARTO_1:      "Día 1 post-parto",
  POST_PARTO_7:      "Día 7 post-parto",
  POST_PARTO_14:     "Día 14 post-parto",
  LECHON_3D:         "Día 3 lechón",
  LECHON_7D:         "Día 7 lechón",
  LECHON_14D:        "Día 14 lechón",
  LECHON_21D:        "Día 21 lechón",
  AL_DESTETE:        "Al destete",
  INGRESO_LOTE_7:    "7d post-ingreso lote",
  INGRESO_LOTE_14:   "14d post-ingreso lote",
  REFUERZO_6M:       "Refuerzo 6 meses",
  REFUERZO_ANUAL:    "Refuerzo anual",
};

/* ─── Constantes de módulo ─────────────────────────────────────── */

const MODULES = [
  { key: "GESTACION",  label: "Gestación",   icon: IconHeart,             iconColor: "var(--success)" },
  { key: "MATERNIDAD", label: "Maternidad",  icon: IconHeartPlus,         iconColor: "var(--info)" },
  { key: "RECRIA",     label: "Iniciación",  icon: IconBuildingWarehouse, iconColor: "var(--warning)" },
  { key: "ENGORDE",    label: "Engorde",     icon: IconChartLine,         iconColor: "var(--danger)" },
  { key: "PLANTEL",    label: "Plantel",     icon: IconDna,               iconColor: "var(--accent)" },
  { key: "BALANCEADO", label: "Balanceado",  icon: IconFlask,             iconColor: "var(--text-muted)" },
] as const;
type ModuleKey = typeof MODULES[number]["key"];

const CONFIG_TABS = ["Metas", "Razas", "Vacunas", "Procesos", "Alertas"] as const;
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

/* ─── Tipos ─────────────────────────────────────────────────────── */

interface ConfigMeta { id: string; modulo: string; kpiKey: string; valor: string; }
interface ConfigRaza {
  id: string; nombre: string; tipoLinea: string; usoPrincipal: string;
  nacidosVivosMeta?: number; diasGestacion?: number; activa: boolean;
}
interface ConfigVacuna {
  id: string; modulo: string; nombreVacuna: string; marcaComercial: string;
  laboratorio: string; viaAplicacion: string; dosisMl: string;
  momentoAplicacion: string; obligatoria: boolean; activa: boolean;
  fechaVencimientoLote?: string; stockDosis?: number; stockMinimoAlerta?: number;
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

function RazasTab() {
  const [razas, setRazas] = useState<ConfigRaza[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", tipoLinea: "MATERNA", usoPrincipal: "", nacidosVivosMeta: "", diasGestacion: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/config/razas");
    if (r.ok) setRazas(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActiva(raza: ConfigRaza) {
    await fetch(`/api/config/razas/${raza.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !raza.activa }),
    });
    load();
  }

  async function handleAdd() {
    if (!form.nombre || !form.tipoLinea || !form.usoPrincipal) { alert("Nombre, tipo de línea y uso principal son requeridos"); return; }
    setSaving(true);
    const r = await fetch("/api/config/razas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        nacidosVivosMeta: form.nacidosVivosMeta ? Number(form.nacidosVivosMeta) : undefined,
        diasGestacion: form.diasGestacion ? Number(form.diasGestacion) : undefined,
      }),
    });
    setSaving(false);
    if (r.ok) { setShowForm(false); setForm({ nombre: "", tipoLinea: "MATERNA", usoPrincipal: "", nacidosVivosMeta: "", diasGestacion: "" }); load(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} /> Agregar raza
        </button>
      </div>
      <table className="kp-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo línea</th>
            <th>Uso principal</th>
            <th>Nacidos vivos meta</th>
            <th>Días gestación</th>
            <th>Activa</th>
          </tr>
        </thead>
        <tbody>
          {razas.map(r => (
            <tr key={r.id} style={{ opacity: r.activa ? 1 : 0.5 }}>
              <td style={{ fontWeight: 500 }}>{r.nombre}</td>
              <td><span className={`badge ${r.tipoLinea === "MATERNA" ? "badge-ok" : r.tipoLinea === "PATERNA" ? "badge-info" : "badge-warn"}`}>{r.tipoLinea}</span></td>
              <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.usoPrincipal}</td>
              <td style={{ textAlign: "center" }}>{r.nacidosVivosMeta ?? "—"}</td>
              <td style={{ textAlign: "center" }}>{r.diasGestacion ?? "—"}</td>
              <td>
                <button
                  onClick={() => toggleActiva(r)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: r.activa ? "var(--success)" : "var(--text-muted)", padding: 0 }}
                >
                  {r.activa ? <IconToggleRight size={20} /> : <IconToggleLeft size={20} />}
                  <span style={{ fontSize: 11 }}>{r.activa ? "Activa" : "Inactiva"}</span>
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
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>Agregar raza / línea genética</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="kp-label">Nombre *</label>
                <input className="kp-input" value={form.nombre} onChange={e => F("nombre", e.target.value)} placeholder="Ej: Landrace, Large White, Duroc…" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Tipo de línea *</label>
                  <select className="kp-input" value={form.tipoLinea} onChange={e => F("tipoLinea", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="MATERNA">Materna</option>
                    <option value="PATERNA">Paterna</option>
                    <option value="HIBRIDA">Híbrida</option>
                  </select>
                </div>
                <div>
                  <label className="kp-label">Nacidos vivos meta</label>
                  <input className="kp-input" type="number" step="0.1" value={form.nacidosVivosMeta} onChange={e => F("nacidosVivosMeta", e.target.value)} placeholder="Ej: 13.5" />
                </div>
              </div>
              <div>
                <label className="kp-label">Uso principal *</label>
                <input className="kp-input" value={form.usoPrincipal} onChange={e => F("usoPrincipal", e.target.value)} placeholder="Ej: Línea materna — alta prolificidad" />
              </div>
              <div>
                <label className="kp-label">Días de gestación referencia</label>
                <input className="kp-input" type="number" value={form.diasGestacion} onChange={e => F("diasGestacion", e.target.value)} placeholder="Ej: 114" />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? <Spinner /> : "Agregar raza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_VACUNA_FORM = {
  nombreVacuna: "", marcaComercial: "", laboratorio: "", principioActivo: "",
  enfermedadObjetivo: "", viaAplicacion: "IM", dosisMl: "", momentoAplicacion: "",
  refuerzoDias: "", paisProcedencia: "", tempConservacion: "", diasAlertaVto: "30",
  stockDosis: "", stockMinimoAlerta: "", fichaTecnicaUrl: "",
  obligatoria: false, diasEsperaServicio: "0", notas: "",
};

function VacunasTab({ modulo }: { modulo: ModuleKey }) {
  const [vacunas, setVacunas] = useState<ConfigVacuna[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_VACUNA_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/config/vacunas?modulo=${modulo}`);
    if (r.ok) setVacunas(await r.json());
    setLoading(false);
  }, [modulo]);

  useEffect(() => { load(); }, [load]);

  async function toggleActiva(v: ConfigVacuna) {
    await fetch(`/api/config/vacunas/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !v.activa }),
    });
    load();
  }

  async function handleSeed() {
    setSeeding(true);
    await fetch("/api/config/seed", { method: "POST" });
    setSeeding(false);
    load();
  }

  async function handleAdd() {
    const { nombreVacuna, marcaComercial, laboratorio, principioActivo, viaAplicacion, dosisMl, momentoAplicacion, paisProcedencia, tempConservacion } = form;
    if (!nombreVacuna || !marcaComercial || !laboratorio || !principioActivo || !viaAplicacion || !dosisMl || !momentoAplicacion || !paisProcedencia || !tempConservacion) {
      alert("Completá todos los campos obligatorios (*)");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/config/vacunas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modulo,
        ...form,
        dosisMl: Number(form.dosisMl),
        refuerzoDias: form.refuerzoDias ? Number(form.refuerzoDias) : null,
        diasAlertaVto: Number(form.diasAlertaVto) || 30,
        stockDosis: form.stockDosis ? Number(form.stockDosis) : null,
        stockMinimoAlerta: form.stockMinimoAlerta ? Number(form.stockMinimoAlerta) : null,
        fichaTecnicaUrl: form.fichaTecnicaUrl || null,
        enfermedadObjetivo: form.enfermedadObjetivo || null,
        diasEsperaServicio: Number(form.diasEsperaServicio) || 0,
      }),
    });
    setSaving(false);
    if (r.ok) { setShowForm(false); setForm({ ...EMPTY_VACUNA_FORM }); load(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  const F = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn" onClick={handleSeed} disabled={seeding} style={{ fontSize: 12 }}>
          {seeding ? <Spinner /> : vacunas.length === 0 ? "Cargar protocolo por defecto" : "Recargar defaults"}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {vacunas.length} vacuna{vacunas.length !== 1 ? "s" : ""} — módulo {modulo}
        </span>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} /> Agregar vacuna
        </button>
      </div>

      {vacunas.length === 0 ? (
        <div className="kp-alert kp-alert-info" style={{ fontSize: 12 }}>
          No hay vacunas registradas aún. Podés cargar el protocolo por defecto o agregar una manualmente.
        </div>
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Vacuna</th>
              <th>Marca / Lab.</th>
              <th>Contra enfermedad</th>
              <th>Vía</th>
              <th>Dosis</th>
              <th>Momento aplicación</th>
              <th style={{ textAlign: "center" }}>Stock</th>
              <th>Obligatoria</th>
              <th style={{ textAlign: "center" }}>Ficha</th>
              <th>Activa</th>
            </tr>
          </thead>
          <tbody>
            {vacunas.map(v => {
              const stockBajo = v.stockDosis != null && v.stockMinimoAlerta != null && v.stockDosis <= v.stockMinimoAlerta;
              return (
                <tr key={v.id} style={{ opacity: v.activa ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>{v.nombreVacuna}</td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {v.marcaComercial}<br />
                    <span style={{ color: "var(--text-muted)" }}>{v.laboratorio}</span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 160 }}>
                    {(v as unknown as { enfermedadObjetivo?: string }).enfermedadObjetivo ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td><span className="badge badge-mat">{v.viaAplicacion}</span></td>
                  <td style={{ textAlign: "center" }}>{v.dosisMl} ml</td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{MOMENTO_LABELS[v.momentoAplicacion] ?? v.momentoAplicacion}</td>
                  <td style={{ textAlign: "center" }}>
                    {v.stockDosis != null ? (
                      <span style={{ fontWeight: 500, color: stockBajo ? "var(--danger)" : "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        {stockBajo && <IconAlertCircle size={11} />}
                        {v.stockDosis}
                        {v.stockMinimoAlerta != null && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>/ mín {v.stockMinimoAlerta}</span>}
                      </span>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {v.obligatoria ? <span className="badge badge-danger">Obligatoria</span> : <span className="badge">Opcional</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {(v as unknown as { fichaTecnicaUrl?: string }).fichaTecnicaUrl ? (
                      <a
                        href={(v as unknown as { fichaTecnicaUrl: string }).fichaTecnicaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver ficha técnica"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)", color: "var(--accent)", textDecoration: "none" }}
                      >
                        <IconFileText size={13} />
                      </a>
                    ) : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActiva(v)}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: v.activa ? "var(--success)" : "var(--text-muted)", padding: 0 }}
                    >
                      {v.activa ? <IconToggleRight size={20} /> : <IconToggleLeft size={20} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal agregar vacuna */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 580, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>
                Agregar vacuna — módulo {modulo}
              </h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>

              <div>
                <label className="kp-label">Nombre de la vacuna *</label>
                <input className="kp-input" value={form.nombreVacuna} onChange={e => F("nombreVacuna", e.target.value)} placeholder="Ej: Parvovirus + Leptospira" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Marca comercial *</label>
                  <input className="kp-input" value={form.marcaComercial} onChange={e => F("marcaComercial", e.target.value)} placeholder="Ej: Farrowsure Gold B" />
                </div>
                <div>
                  <label className="kp-label">Laboratorio *</label>
                  <input className="kp-input" value={form.laboratorio} onChange={e => F("laboratorio", e.target.value)} placeholder="Ej: Zoetis, MSD, Boehringer" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Principio activo *</label>
                  <input className="kp-input" value={form.principioActivo} onChange={e => F("principioActivo", e.target.value)} placeholder="Ej: Parvovirus porcino + Leptospira spp." />
                </div>
                <div>
                  <label className="kp-label">Contra qué enfermedad actúa</label>
                  <input className="kp-input" value={form.enfermedadObjetivo} onChange={e => F("enfermedadObjetivo", e.target.value)} placeholder="Ej: Parvovirus, Leptospirosis, PCV2…" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Vía de aplicación *</label>
                  <select className="kp-input" value={form.viaAplicacion} onChange={e => F("viaAplicacion", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="IM">IM — Intramuscular</option>
                    <option value="SC">SC — Subcutánea</option>
                    <option value="IV">IV — Intravenosa</option>
                    <option value="ORAL">ORAL</option>
                    <option value="INTRANASAL">Intranasal</option>
                  </select>
                </div>
                <div>
                  <label className="kp-label">Dosis (ml) *</label>
                  <input className="kp-input" type="number" step="0.1" min="0" value={form.dosisMl} onChange={e => F("dosisMl", e.target.value)} placeholder="Ej: 2" />
                </div>
                <div>
                  <label className="kp-label">Refuerzo (días)</label>
                  <input className="kp-input" type="number" min="0" value={form.refuerzoDias} onChange={e => F("refuerzoDias", e.target.value)} placeholder="Ej: 180" />
                </div>
              </div>

              <div>
                <label className="kp-label">Momento de aplicación *</label>
                <select className="kp-input" style={{ appearance: "auto" }} value={form.momentoAplicacion} onChange={e => F("momentoAplicacion", e.target.value)}>
                  <option value="">— Seleccionar momento —</option>
                  <optgroup label="Pre-Servicio (gestación)">
                    <option value="PRE_SERVICIO_7">7 días pre-servicio</option>
                    <option value="PRE_SERVICIO_21">21 días pre-servicio</option>
                    <option value="PRE_SERVICIO_42">42 días pre-servicio</option>
                  </optgroup>
                  <optgroup label="Pre/Post Parto (cerda)">
                    <option value="PRE_PARTO_30">30 días pre-parto</option>
                    <option value="PRE_PARTO_14">14 días pre-parto</option>
                    <option value="POST_PARTO_1">Día 1 post-parto</option>
                    <option value="POST_PARTO_7">Día 7 post-parto</option>
                    <option value="POST_PARTO_14">Día 14 post-parto</option>
                  </optgroup>
                  <optgroup label="Lechones">
                    <option value="LECHON_3D">Día 3 de vida del lechón</option>
                    <option value="LECHON_7D">Día 7 de vida del lechón</option>
                    <option value="LECHON_14D">Día 14 de vida del lechón</option>
                    <option value="LECHON_21D">Día 21 de vida (al destete)</option>
                  </optgroup>
                  <optgroup label="Lotes recría/engorde">
                    <option value="AL_DESTETE">Al destete / ingreso al lote</option>
                    <option value="INGRESO_LOTE_7">7 días post-ingreso a lote</option>
                    <option value="INGRESO_LOTE_14">14 días post-ingreso a lote</option>
                  </optgroup>
                  <optgroup label="Refuerzo periódico">
                    <option value="REFUERZO_6M">Refuerzo semestral (180 días)</option>
                    <option value="REFUERZO_ANUAL">Refuerzo anual (365 días)</option>
                  </optgroup>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">País procedencia *</label>
                  <input className="kp-input" value={form.paisProcedencia} onChange={e => F("paisProcedencia", e.target.value)} placeholder="Ej: USA, DEU, BRA" />
                </div>
                <div>
                  <label className="kp-label">Temperatura de conservación *</label>
                  <input className="kp-input" value={form.tempConservacion} onChange={e => F("tempConservacion", e.target.value)} placeholder="Ej: 2–8 °C" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Stock actual (dosis)</label>
                  <input className="kp-input" type="number" min="0" value={form.stockDosis} onChange={e => F("stockDosis", e.target.value)} placeholder="Ej: 100" />
                </div>
                <div>
                  <label className="kp-label">Stock mínimo alerta</label>
                  <input className="kp-input" type="number" min="0" value={form.stockMinimoAlerta} onChange={e => F("stockMinimoAlerta", e.target.value)} placeholder="Ej: 20" />
                </div>
                <div>
                  <label className="kp-label">Días alerta vencimiento</label>
                  <input className="kp-input" type="number" min="1" value={form.diasAlertaVto} onChange={e => F("diasAlertaVto", e.target.value)} placeholder="30" />
                </div>
              </div>

              <div>
                <label className="kp-label">URL Ficha Técnica</label>
                <input className="kp-input" type="url" value={form.fichaTecnicaUrl} onChange={e => F("fichaTecnicaUrl", e.target.value)} placeholder="https://… (PDF o página del fabricante)" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="vac-obligatoria"
                  type="checkbox"
                  checked={form.obligatoria}
                  onChange={e => F("obligatoria", e.target.checked)}
                  style={{ width: 15, height: 15, cursor: "pointer" }}
                />
                <label htmlFor="vac-obligatoria" style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                  Vacuna obligatoria del protocolo
                </label>
              </div>

              {form.obligatoria && (
                <div style={{ background: "var(--warning-subtle, rgba(234,179,8,.08))", border: "0.5px solid var(--warning-border, rgba(234,179,8,.3))", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
                  <label className="kp-label" style={{ color: "var(--warning-text, #854d0e)" }}>
                    ⏱ Días de espera post-vacuna para autorizar servicio
                  </label>
                  <input
                    className="kp-input"
                    type="number"
                    min="0"
                    value={form.diasEsperaServicio}
                    onChange={e => F("diasEsperaServicio", e.target.value)}
                    placeholder="Ej: 21"
                    style={{ maxWidth: 120 }}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                    Días mínimos desde la aplicación antes de permitir el servicio a esta cerda. 0 = sin espera.
                  </div>
                </div>
              )}

              <div>
                <label className="kp-label">Notas / Observaciones</label>
                <textarea
                  className="kp-input"
                  rows={2}
                  value={form.notas}
                  onChange={e => F("notas", e.target.value)}
                  placeholder="Contraindicaciones, observaciones de uso, etc."
                  style={{ height: "auto", paddingTop: 8, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => { setShowForm(false); setForm({ ...EMPTY_VACUNA_FORM }); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? <Spinner /> : "Guardar vacuna"}
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
            Metas, razas, vacunas y alertas por módulo
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
          {tab === "Razas"    && <RazasTab />}
          {tab === "Vacunas"  && <VacunasTab  modulo={modulo} />}
          {tab === "Procesos" && <ProcesosTab modulo={modulo} />}
          {tab === "Alertas"  && <AlertasTab  modulo={modulo} />}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
