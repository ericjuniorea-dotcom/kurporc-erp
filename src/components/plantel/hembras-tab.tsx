"use client";
import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconSearch, IconSkull, IconAlertTriangle,
  IconLoader2, IconChevronDown, IconX,
} from "@tabler/icons-react";
import { EstadoBadgeSow } from "./estado-badge";

const SOW_STATES = [
  { value: "", label: "Activas (todos los estados)" },
  { value: "QUARANTINE", label: "Cuarentena" },
  { value: "REPLACEMENT_DEVELOPING", label: "Reemplazo en desarrollo" },
  { value: "REPLACEMENT_READY", label: "Lista para servicio" },
  { value: "MATED", label: "Servida" },
  { value: "PREGNANT", label: "Gestante" },
  { value: "FARROWING", label: "En paridera" },
  { value: "LACTATING", label: "Lactante" },
  { value: "EMPTY", label: "Vacía" },
];

const GENETIC_LINES = ["TN Rexne", "TN Duroc", "PIC", "Genesus", "NAIMA CG36", "Otra"];
const BREEDS = ["Yorkshire", "Landrace", "Duroc", "Hampshire", "Pietrain", "Híbrido", "Otra"];

const CATEGORIAS_DESCARTE = [
  "Reproductiva", "Sanitaria", "Productiva", "Genética",
  "Conductual", "Manejo", "Bioseguridad", "Accidental", "Mortalidad", "Otros",
];

const MOTIVOS_POR_CATEGORIA: Record<string, string[]> = {
  "Reproductiva": [
    "No presenta celo", "Repetición de celo", "Retorno irregular al celo", "Anestro prolongado",
    "Baja tasa de concepción", "Infertilidad", "Baja fertilidad", "Abortos repetitivos",
    "Momificación fetal recurrente", "Bajo tamaño de camada", "Baja cantidad de nacidos vivos",
    "Alta cantidad de nacidos muertos", "Alta mortalidad pre-destete", "Baja producción de leche",
    "Problemas de maternidad", "Aplasta muchos lechones", "Rechazo de lechones",
    "Mala habilidad materna", "Intervalo destete-celo prolongado", "Muchos servicios por preñez",
    "Edad reproductiva avanzada", "Fin de vida productiva",
  ],
  "Sanitaria": [
    "Cojera crónica", "Artritis", "Problemas podales", "Lesiones en pezuñas", "Fracturas",
    "Problemas de columna", "Hernia", "Prolapso uterino", "Prolapso rectal", "Prolapso vaginal",
    "Mastitis", "Metritis", "Síndrome MMA (Mastitis - Metritis - Agalaxia)", "Agalaxia",
    "Enfermedad respiratoria crónica", "Enfermedad digestiva crónica", "Diarrea recurrente",
    "Enfermedad sistémica", "Fiebre persistente", "Enfermedad infecciosa", "Enfermedad parasitaria",
    "Lesiones cutáneas graves", "Úlceras", "Caquexia", "Baja condición corporal",
    "Tumores", "Ceguera", "Problemas neurológicos",
  ],
  "Productiva": [
    "Baja productividad", "Bajo número de partos", "Bajo número de lechones destetados",
    "Baja eficiencia alimenticia", "Crecimiento deficiente", "Baja ganancia diaria de peso",
    "Bajo peso corporal", "Sobrepeso", "Conversión alimenticia deficiente",
    "Baja producción durante varios ciclos",
  ],
  "Genética": [
    "Defectos congénitos", "Malformaciones", "Mala conformación", "Defectos en pezones",
    "Defectos reproductivos hereditarios", "Problemas locomotores hereditarios",
    "Mala calidad genética", "Reemplazo por mejoramiento genético",
  ],
  "Conductual": [
    "Agresividad", "Canibalismo", "Muerde lechones", "Difícil manejo",
    "Estrés excesivo", "Temperamento inadecuado",
  ],
  "Manejo": [
    "Edad avanzada", "Exceso de peso", "Baja condición corporal", "Reposición del plantel",
    "Reducción del stock", "Venta programada", "Cambio de línea genética",
    "Optimización del plantel", "Decisión administrativa",
  ],
  "Bioseguridad": [
    "Sospecha de enfermedad", "Positivo a enfermedad", "Cuarentena",
    "Riesgo sanitario", "Programa de erradicación", "Control epidemiológico",
  ],
  "Accidental": [
    "Fractura accidental", "Lesión traumática", "Golpe", "Aplastamiento",
    "Accidente durante manejo", "Accidente durante transporte", "Electrocución", "Ahogamiento",
  ],
  "Mortalidad": [
    "Muerte natural", "Muerte súbita", "Eutanasia humanitaria", "Sacrificio sanitario",
  ],
  "Otros": [
    "Animal perdido", "Robo", "Error de identificación", "Desconocido", "Otro (especificar)",
  ],
};

const TIPOS_DESCARTE = [
  "Venta", "Faena", "Eutanasia", "Muerte natural",
  "Eliminación sanitaria", "Donación", "Otro",
];
const DESTINOS_DESCARTE = [
  "Frigorífico", "Venta a productor", "Eliminación sanitaria",
  "Necropsia", "Incineración", "Compostaje", "Otro",
];

const todayIso = () => new Date().toISOString().split("T")[0];

const EMPTY_DISCARD = {
  categoria: "",
  motivosEspecificos: [] as string[],
  motivoPrincipal: "",
  tipoDescarte: "",
  destination: "",
  discardDate: todayIso(),
  pesoKg: "",
  condicionCorporal: "",
  estadoSanitario: "",
  estadoReproductivo: "",
  estadoProductivo: "",
  numeroParto: "",
  diasUltimoParto: "",
  diasUltimoServicio: "",
  numeroServicios: "",
  lechonesDestetados: "",
  diagnostico: "",
  veterinario: "",
  observacionesClinicas: "",
  observaciones: "",
  responsableAutoriza: "",
};

interface Sow {
  id: string;
  erpCode: string | null;
  caravanaCode: string | null;
  identCode: string;
  plantelState: string | null;
  geneticLine: string | null;
  birthDate: string | null;
  currentParityCount: number;
  galponAssigned: string | null;
  entryDate: string;
  animalEvents: Array<{ eventType: string; eventDate: string; description: string | null }>;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const days = Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000);
  if (days < 60)  return `${days}d`;
  if (days < 730) return `${Math.floor(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10, paddingBottom: 6, borderBottom: "0.5px solid var(--border-subtle)" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

interface HembrasTabProps {
  selectedSowId?: string | null;
  onSelectSow?:   (sowId: string | null) => void;
}

export function HembrasTab({ selectedSowId, onSelectSow }: HembrasTabProps = {}) {
  const [sows, setSows]             = useState<Sow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);

  // Death modal (simple)
  const [deathModal, setDeathModal] = useState<Sow | null>(null);
  const [deathCause, setDeathCause] = useState("");
  const [deathNotes, setDeathNotes] = useState("");

  // Quarantine config
  const [diasCuarentena, setDiasCuarentena] = useState(30);

  // Discard modal (comprehensive)
  const [discardModal, setDiscardModal]     = useState<Sow | null>(null);
  const [discardForm, setDiscardForm]       = useState({ ...EMPTY_DISCARD });
  const [loadingRepro, setLoadingRepro]     = useState(false);

  const [form, setForm] = useState({
    caravanaCode: "", tattooCode: "", rfidChip: "", breed: "", geneticLine: "",
    birthDate: "", entryWeightKg: "", sourceProvider: "", purchasePriceGs: "",
    damCodeOrigin: "", sireCodeOrigin: "", galponAssigned: "", corralAssigned: "",
    plantelNotes: "", initialDestination: "QUARANTINE",
  });

  const loadSows = useCallback(async () => {
    setLoading(true);
    try {
      const [sowsRes, cfgRes] = await Promise.all([
        fetch(`/api/plantel/hembras?${new URLSearchParams([
          ...(stateFilter ? [["state", stateFilter]] : []),
          ...(search ? [["search", search]] : []),
        ] as string[][])}`),
        fetch("/api/config/procesos?modulo=PLANTEL"),
      ]);
      if (sowsRes.ok) setSows(await sowsRes.json());
      if (cfgRes.ok) {
        const cfgs = await cfgRes.json() as { procesoKey: string; valor: Record<string, unknown> }[];
        const cuarentenaConfig = cfgs.find(c => c.procesoKey === "cuarentena_hembras");
        if (cuarentenaConfig?.valor?.dias_cuarentena) {
          setDiasCuarentena(Number(cuarentenaConfig.valor.dias_cuarentena));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [stateFilter, search]);

  useEffect(() => {
    const t = setTimeout(loadSows, 300);
    return () => clearTimeout(t);
  }, [loadSows]);

  async function handleSubmit() {
    if (!form.caravanaCode || !form.birthDate || !form.entryWeightKg || !form.sourceProvider || !form.geneticLine) {
      alert("Completá los campos obligatorios: Caravana, F. Nacimiento, Peso, Proveedor, Línea genética");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plantel/hembras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ caravanaCode: "", tattooCode: "", rfidChip: "", breed: "", geneticLine: "",
          birthDate: "", entryWeightKg: "", sourceProvider: "", purchasePriceGs: "",
          damCodeOrigin: "", sireCodeOrigin: "", galponAssigned: "", corralAssigned: "",
          plantelNotes: "", initialDestination: "QUARANTINE" });
        loadSows();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeath() {
    if (!deathModal || !deathCause) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/plantel/hembras/${deathModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_death", cause: deathCause, notes: deathNotes }),
      });
      if (res.ok) {
        setDeathModal(null);
        setDeathCause(""); setDeathNotes("");
        loadSows();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    if (!discardModal) return;
    if (!discardForm.categoria || !discardForm.motivoPrincipal || !discardForm.tipoDescarte) {
      alert("Completá: Categoría, Motivo principal y Tipo de descarte");
      return;
    }
    if (discardForm.motivosEspecificos.length === 0) {
      alert("Seleccioná al menos un motivo específico");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/plantel/hembras/${discardModal.id}/descarte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discardForm),
      });
      if (res.ok) {
        setDiscardModal(null);
        setDiscardForm({ ...EMPTY_DISCARD });
        loadSows();
      } else {
        const err = await res.json();
        alert(err.error ?? "Error al registrar descarte");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleQuarantineRelease(sow: Sow) {
    await fetch(`/api/plantel/hembras/${sow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quarantine_release" }),
    });
    loadSows();
  }

  function toggleMotivo(m: string) {
    setDiscardForm(prev => {
      const next = prev.motivosEspecificos.includes(m)
        ? prev.motivosEspecificos.filter(x => x !== m)
        : [...prev.motivosEspecificos, m];
      const motivoPrincipal = next.includes(prev.motivoPrincipal) ? prev.motivoPrincipal : (next[0] ?? "");
      return { ...prev, motivosEspecificos: next, motivoPrincipal };
    });
  }

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const DF = (k: keyof typeof EMPTY_DISCARD, v: string) => setDiscardForm(p => ({ ...p, [k]: v }));

  const motivosActuales = discardForm.categoria ? (MOTIVOS_POR_CATEGORIA[discardForm.categoria] ?? []) : [];
  const needsSanInfo = ["Sanitaria", "Bioseguridad"].includes(discardForm.categoria);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="kp-input"
            placeholder="Buscar por código ERP o caravana…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <div style={{ position: "relative" }}>
          <select
            className="kp-input"
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            style={{ appearance: "auto", paddingRight: 28, minWidth: 180 }}
          >
            {SOW_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} aria-hidden /> Registrar hembra
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : sows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No se encontraron hembras con los filtros actuales.
          </div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Código ERP</th>
                <th>Caravana</th>
                <th>Estado</th>
                <th>Línea genética</th>
                <th>Edad</th>
                <th>N° parto</th>
                <th>Último evento</th>
                <th>Galpón</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sows.map(sow => {
                const lastEv = sow.animalEvents[0];
                const isSelected = selectedSowId === sow.id;
                return (
                  <tr
                    key={sow.id}
                    onClick={() => onSelectSow?.(isSelected ? null : sow.id)}
                    style={{
                      cursor: onSelectSow ? "pointer" : undefined,
                      background: isSelected ? "var(--accent-subtle)" : undefined,
                      outline: isSelected ? "1px solid var(--accent-border)" : undefined,
                      outlineOffset: -1,
                    }}
                  >
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                      {sow.erpCode ?? "—"}
                    </td>
                    <td style={{ fontWeight: 500 }}>{sow.caravanaCode || sow.identCode}</td>
                    <td><EstadoBadgeSow state={sow.plantelState} /></td>
                    <td style={{ color: "var(--text-secondary)" }}>{sow.geneticLine ?? "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{calcAge(sow.birthDate)}</td>
                    <td style={{ textAlign: "center" }}>{sow.currentParityCount}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {lastEv ? `${lastEv.eventType} · ${fmtDate(lastEv.eventDate)}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{sow.galponAssigned ?? "—"}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {sow.plantelState === "QUARANTINE" && (() => {
                          const daysSinceEntry = Math.floor(
                            (Date.now() - new Date(sow.entryDate).getTime()) / 86400000
                          );
                          const daysLeft = diasCuarentena - daysSinceEntry;
                          const canRelease = daysLeft <= 0;
                          return canRelease ? (
                            <button
                              className="btn"
                              style={{ fontSize: 10, height: 26, color: "var(--success-text)" }}
                              onClick={() => handleQuarantineRelease(sow)}
                              title={`Alta sanitaria (cumplió ${diasCuarentena} días)`}
                            >
                              Alta
                            </button>
                          ) : (
                            <span
                              title={`Cuarentena: faltan ${daysLeft} día(s) para el alta (${diasCuarentena}d configurados)`}
                              style={{ fontSize: 10, color: "var(--warning-text)", cursor: "default", padding: "2px 6px", border: "0.5px solid var(--warning-border)", borderRadius: "var(--radius-sm)", background: "var(--warning-subtle)", whiteSpace: "nowrap" }}
                            >
                              {daysLeft}d restantes
                            </span>
                          );
                        })()}
                        <button
                          className="btn"
                          style={{ fontSize: 10, height: 26, color: "var(--danger-text)" }}
                          onClick={() => { setDeathModal(sow); setDeathCause(""); setDeathNotes(""); }}
                          title="Registrar muerte"
                        >
                          <IconSkull size={11} />
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 10, height: 26, color: "var(--warning-text)" }}
                          onClick={async () => {
                            setDiscardModal(sow);
                            setDiscardForm({ ...EMPTY_DISCARD, discardDate: todayIso() });
                            setLoadingRepro(true);
                            try {
                              const r = await fetch(`/api/plantel/hembras/${sow.id}/datos-reproductivos`);
                              if (r.ok) {
                                const d = await r.json();
                                setDiscardForm(prev => ({
                                  ...prev,
                                  numeroParto:        String(d.numeroParto ?? ""),
                                  diasUltimoParto:    d.diasUltimoParto !== null ? String(d.diasUltimoParto) : "",
                                  diasUltimoServicio: d.diasUltimoServicio !== null ? String(d.diasUltimoServicio) : "",
                                  numeroServicios:    d.numeroServicios !== null ? String(d.numeroServicios) : "",
                                  lechonesDestetados: d.lechonesDestetados !== null ? String(d.lechonesDestetados) : "",
                                }));
                              }
                            } finally {
                              setLoadingRepro(false);
                            }
                          }}
                          title="Registrar descarte"
                        >
                          <IconAlertTriangle size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Registration modal */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 560, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Registrar hembra</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Caravana *</label>
                  <input className="kp-input" value={form.caravanaCode} onChange={e => F("caravanaCode", e.target.value)} placeholder="Ej: 0042" />
                </div>
                <div>
                  <label className="kp-label">Tatuaje</label>
                  <input className="kp-input" value={form.tattooCode} onChange={e => F("tattooCode", e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Raza</label>
                  <select className="kp-input" value={form.breed} onChange={e => F("breed", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Línea genética *</label>
                  <select className="kp-input" value={form.geneticLine} onChange={e => F("geneticLine", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {GENETIC_LINES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Fecha de nacimiento *</label>
                  <input className="kp-input" type="date" value={form.birthDate} onChange={e => F("birthDate", e.target.value)} />
                </div>
                <div>
                  <label className="kp-label">Peso al ingreso (kg) *</label>
                  <input className="kp-input" type="number" step="0.1" value={form.entryWeightKg} onChange={e => F("entryWeightKg", e.target.value)} placeholder="Ej: 135.0" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Proveedor / Origen *</label>
                  <input className="kp-input" value={form.sourceProvider} onChange={e => F("sourceProvider", e.target.value)} placeholder="Nombre de la granja de origen" />
                </div>
                <div>
                  <label className="kp-label">Precio de compra (₲)</label>
                  <input className="kp-input" type="number" value={form.purchasePriceGs} onChange={e => F("purchasePriceGs", e.target.value)} placeholder="Ej: 2500000" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Código madre (origen)</label>
                  <input className="kp-input" value={form.damCodeOrigin} onChange={e => F("damCodeOrigin", e.target.value)} placeholder="Árbol genealógico" />
                </div>
                <div>
                  <label className="kp-label">Código padre (origen)</label>
                  <input className="kp-input" value={form.sireCodeOrigin} onChange={e => F("sireCodeOrigin", e.target.value)} placeholder="Árbol genealógico" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Galpón asignado</label>
                  <input className="kp-input" value={form.galponAssigned} onChange={e => F("galponAssigned", e.target.value)} placeholder="Ej: Galpón A" />
                </div>
                <div>
                  <label className="kp-label">Corral</label>
                  <input className="kp-input" value={form.corralAssigned} onChange={e => F("corralAssigned", e.target.value)} placeholder="Ej: 12" />
                </div>
              </div>
              <div>
                <label className="kp-label">Destino inicial *</label>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  {[{ val: "QUARANTINE", label: "Cuarentena" }, { val: "ACTIVE", label: "Plantel activo" }].map(({ val, label }) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                      <input type="radio" name="destination" value={val} checked={form.initialDestination === val} onChange={() => F("initialDestination", val)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="kp-label">Observaciones</label>
                <textarea className="kp-input" rows={2} value={form.plantelNotes} onChange={e => F("plantelNotes", e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar hembra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Death modal (simple) */}
      {deathModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDeathModal(null)}
        >
          <div
            style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Registrar muerte — <span style={{ color: "var(--accent)" }}>{deathModal.caravanaCode || deathModal.identCode}</span>
              </h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="kp-label">Causa de muerte *</label>
                <input className="kp-input" value={deathCause} onChange={e => setDeathCause(e.target.value)} placeholder="Describir la causa…" />
              </div>
              <div>
                <label className="kp-label">Observaciones</label>
                <textarea className="kp-input" rows={2} value={deathNotes} onChange={e => setDeathNotes(e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setDeathModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeath} disabled={saving || !deathCause}>
                {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar muerte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard modal (comprehensive) */}
      {discardModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setDiscardModal(null)}
        >
          <div
            style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 660, maxHeight: "92vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  Registrar descarte
                </h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {discardModal.erpCode ?? ""} · <span style={{ fontWeight: 500, color: "var(--accent)" }}>{discardModal.caravanaCode || discardModal.identCode}</span>
                </div>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} onClick={() => setDiscardModal(null)}>
                <IconX size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: "auto", flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

              {/* 1. Categorización */}
              <FormSection title="1. Categoría y motivos *">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="kp-label">Categoría *</label>
                    <select
                      className="kp-input"
                      value={discardForm.categoria}
                      onChange={e => setDiscardForm(p => ({ ...p, categoria: e.target.value, motivosEspecificos: [], motivoPrincipal: "" }))}
                      style={{ appearance: "auto" }}
                    >
                      <option value="">Seleccionar categoría…</option>
                      {CATEGORIAS_DESCARTE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="kp-label">Fecha del descarte *</label>
                    <input className="kp-input" type="date" value={discardForm.discardDate} onChange={e => DF("discardDate", e.target.value)} />
                  </div>
                </div>

                {discardForm.categoria && (
                  <div>
                    <label className="kp-label">Motivos específicos * (selección múltiple)</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, maxHeight: 180, overflowY: "auto", padding: "6px 0" }}>
                      {motivosActuales.map(m => {
                        const checked = discardForm.motivosEspecificos.includes(m);
                        return (
                          <label
                            key={m}
                            style={{
                              display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11,
                              padding: "4px 8px", borderRadius: "var(--radius-sm)",
                              border: `0.5px solid ${checked ? "var(--warning-border)" : "var(--border-default)"}`,
                              background: checked ? "var(--warning-subtle)" : "var(--bg-overlay)",
                              color: checked ? "var(--warning-text)" : "var(--text-secondary)",
                              transition: "all 0.1s",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMotivo(m)}
                              style={{ display: "none" }}
                            />
                            {checked && <span style={{ fontSize: 10, fontWeight: 700 }}>✓</span>}
                            {m}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {discardForm.motivosEspecificos.length > 0 && (
                  <div>
                    <label className="kp-label">Motivo principal * (el más importante)</label>
                    <select
                      className="kp-input"
                      value={discardForm.motivoPrincipal}
                      onChange={e => DF("motivoPrincipal", e.target.value)}
                      style={{ appearance: "auto" }}
                    >
                      <option value="">Seleccionar…</option>
                      {discardForm.motivosEspecificos.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </FormSection>

              {/* 2. Tipo y destino */}
              <FormSection title="2. Tipo de descarte y destino *">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="kp-label">Tipo de descarte *</label>
                    <select className="kp-input" value={discardForm.tipoDescarte} onChange={e => DF("tipoDescarte", e.target.value)} style={{ appearance: "auto" }}>
                      <option value="">Seleccionar…</option>
                      {TIPOS_DESCARTE.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="kp-label">Destino del animal</label>
                    <select className="kp-input" value={discardForm.destination} onChange={e => DF("destination", e.target.value)} style={{ appearance: "auto" }}>
                      <option value="">Seleccionar…</option>
                      {DESTINOS_DESCARTE.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </FormSection>

              {/* 3. Estado del animal */}
              <FormSection title="3. Estado del animal al descarte (opcional)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="kp-label">Peso (kg)</label>
                    <input className="kp-input" type="number" step="0.1" value={discardForm.pesoKg} onChange={e => DF("pesoKg", e.target.value)} placeholder="Ej: 285.0" />
                  </div>
                  <div>
                    <label className="kp-label">Condición corporal (1–5)</label>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => DF("condicionCorporal", discardForm.condicionCorporal === String(n) ? "" : String(n))}
                          style={{
                            flex: 1, height: 32, border: `0.5px solid ${discardForm.condicionCorporal === String(n) ? "var(--accent)" : "var(--border-default)"}`,
                            borderRadius: "var(--radius-sm)", background: discardForm.condicionCorporal === String(n) ? "var(--accent-subtle)" : "var(--bg-overlay)",
                            color: discardForm.condicionCorporal === String(n) ? "var(--accent)" : "var(--text-muted)",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="kp-label">Estado sanitario</label>
                    <input className="kp-input" value={discardForm.estadoSanitario} onChange={e => DF("estadoSanitario", e.target.value)} placeholder="Ej: Caquéxico" />
                  </div>
                  <div>
                    <label className="kp-label">Estado reproductivo</label>
                    <input className="kp-input" value={discardForm.estadoReproductivo} onChange={e => DF("estadoReproductivo", e.target.value)} placeholder="Ej: Anestro" />
                  </div>
                  <div>
                    <label className="kp-label">Estado productivo</label>
                    <input className="kp-input" value={discardForm.estadoProductivo} onChange={e => DF("estadoProductivo", e.target.value)} placeholder="Ej: Baja producción" />
                  </div>
                </div>
              </FormSection>

              {/* 4. Info reproductiva */}
              <FormSection title={`4. Información reproductiva${loadingRepro ? " — cargando datos…" : " (autocompletado)"}`}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <div>
                    <label className="kp-label">N° parto al descarte</label>
                    <input className="kp-input" type="number" min="0" value={discardForm.numeroParto} onChange={e => DF("numeroParto", e.target.value)} placeholder="Ej: 5" />
                  </div>
                  <div>
                    <label className="kp-label">Días desde último parto</label>
                    <input className="kp-input" type="number" min="0" value={discardForm.diasUltimoParto} onChange={e => DF("diasUltimoParto", e.target.value)} placeholder="Ej: 21" />
                  </div>
                  <div>
                    <label className="kp-label">Días desde último servicio</label>
                    <input className="kp-input" type="number" min="0" value={discardForm.diasUltimoServicio} onChange={e => DF("diasUltimoServicio", e.target.value)} placeholder="Ej: 115" />
                  </div>
                  <div>
                    <label className="kp-label">N° servicios realizados</label>
                    <input className="kp-input" type="number" min="0" value={discardForm.numeroServicios} onChange={e => DF("numeroServicios", e.target.value)} placeholder="Ej: 12" />
                  </div>
                  <div>
                    <label className="kp-label">Lechones destetados (últ. parto)</label>
                    <input className="kp-input" type="number" min="0" value={discardForm.lechonesDestetados} onChange={e => DF("lechonesDestetados", e.target.value)} placeholder="Ej: 10" />
                  </div>
                </div>
              </FormSection>

              {/* 5. Info sanitaria */}
              {needsSanInfo && (
                <FormSection title="5. Información sanitaria">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="kp-label">Diagnóstico</label>
                      <input className="kp-input" value={discardForm.diagnostico} onChange={e => DF("diagnostico", e.target.value)} placeholder="Diagnóstico clínico" />
                    </div>
                    <div>
                      <label className="kp-label">Veterinario responsable</label>
                      <input className="kp-input" value={discardForm.veterinario} onChange={e => DF("veterinario", e.target.value)} placeholder="Nombre del veterinario" />
                    </div>
                  </div>
                  <div>
                    <label className="kp-label">Observaciones clínicas</label>
                    <textarea className="kp-input" rows={2} value={discardForm.observacionesClinicas} onChange={e => DF("observacionesClinicas", e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} placeholder="Hallazgos clínicos, tratamientos realizados, medicamentos…" />
                  </div>
                </FormSection>
              )}

              {/* 6. Observaciones generales */}
              <FormSection title={`${needsSanInfo ? "6" : "5"}. Registro y observaciones`}>
                <div>
                  <label className="kp-label">Responsable que autoriza el descarte</label>
                  <input className="kp-input" value={discardForm.responsableAutoriza} onChange={e => DF("responsableAutoriza", e.target.value)} placeholder="Nombre del responsable" />
                </div>
                <div>
                  <label className="kp-label">Observaciones generales</label>
                  <textarea className="kp-input" rows={3} value={discardForm.observaciones} onChange={e => DF("observaciones", e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} placeholder="Información adicional sobre el descarte…" />
                </div>
              </FormSection>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                * Campos obligatorios: Categoría, Motivos, Motivo principal, Tipo de descarte
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setDiscardModal(null)}>Cancelar</button>
                <button
                  className="btn btn-danger"
                  onClick={handleDiscard}
                  disabled={saving || !discardForm.categoria || !discardForm.motivoPrincipal || !discardForm.tipoDescarte}
                >
                  {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Confirmar descarte"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
