"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IconPlus, IconLoader2, IconToggleLeft, IconToggleRight, IconFileText,
  IconAlertCircle, IconChevronDown, IconChevronRight, IconVaccine,
  IconShieldCheck, IconX,
} from "@tabler/icons-react";
import { LABORATORIOS, buscarMarcas } from "@/lib/config/catalogo-marcas";

type ModuleKey = "GESTACION" | "MATERNIDAD" | "RECRIA" | "ENGORDE" | "PLANTEL" | "BALANCEADO";
type Paridad = "NULIPARA" | "MULTIPARA" | "AMBAS";
type Sujeto = "LECHON" | "HEMBRA";

const SUJETO_LABELS: Record<Sujeto, string> = { LECHON: "Lechones", HEMBRA: "Hembras en lactación" };

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

const PARIDAD_LABELS: Record<Paridad, string> = {
  NULIPARA: "Nulípara", MULTIPARA: "Multípara", AMBAS: "Ambas",
};

export interface ConfigVacuna {
  id: string; modulo: string; nombreVacuna: string; marcaComercial: string;
  laboratorio: string; principioActivo?: string; enfermedadObjetivo?: string | null;
  viaAplicacion: string; dosisMl: string; momentoAplicacion: string;
  refuerzoDias?: number | null; paisProcedencia?: string; tempConservacion?: string;
  diasAlertaVto?: number; obligatoria: boolean; diasEsperaServicio?: number;
  notas?: string; activa: boolean; fichaTecnicaUrl?: string;
  stockDosis?: number; stockMinimoAlerta?: number;
  paridad: Paridad; diaGestacion?: number | null; ordenDosis: number;
  sujeto?: Sujeto | null; diaReferencia?: number | null;
}

interface GrupoEnfermedad {
  enfermedad: string;
  obligatoria: boolean;
  totalMarcas: number;
  marcas: Array<{
    marcaComercial: string; laboratorio: string; principioActivo?: string;
    fichaTecnicaUrl?: string; stockDosis?: number; stockMinimoAlerta?: number;
    dosis: ConfigVacuna[];
  }>;
}

function agruparPorEnfermedad(filas: ConfigVacuna[]): GrupoEnfermedad[] {
  const porEnfermedad = new Map<string, ConfigVacuna[]>();
  for (const v of filas) {
    const key = v.enfermedadObjetivo?.trim() || "Sin enfermedad asignada";
    if (!porEnfermedad.has(key)) porEnfermedad.set(key, []);
    porEnfermedad.get(key)!.push(v);
  }
  return Array.from(porEnfermedad.entries()).map(([enfermedad, fs]) => {
    const porMarca = new Map<string, ConfigVacuna[]>();
    for (const f of fs) {
      const mk = `${f.marcaComercial}__${f.laboratorio}`;
      if (!porMarca.has(mk)) porMarca.set(mk, []);
      porMarca.get(mk)!.push(f);
    }
    const marcas = Array.from(porMarca.values()).map(rows => ({
      marcaComercial: rows[0].marcaComercial,
      laboratorio:    rows[0].laboratorio,
      principioActivo: rows[0].principioActivo,
      fichaTecnicaUrl: rows[0].fichaTecnicaUrl,
      stockDosis:      rows[0].stockDosis,
      stockMinimoAlerta: rows[0].stockMinimoAlerta,
      dosis: rows.slice().sort((a, b) => a.ordenDosis - b.ordenDosis),
    }));
    return {
      enfermedad,
      obligatoria: fs.some(f => f.obligatoria),
      totalMarcas: marcas.length,
      marcas,
    };
  }).sort((a, b) => a.enfermedad.localeCompare(b.enfermedad));
}

function Spinner() {
  return <IconLoader2 size={15} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />;
}

interface DosisRow {
  key: string; diaGestacion: string; viaAplicacion: string; dosisMl: string;
  refuerzoDias: string; obligatoria: boolean; diasEsperaServicio: string;
}

const nuevaDosisRow = (n: number): DosisRow => ({
  key: `d${n}-${Math.random().toString(36).slice(2, 8)}`,
  diaGestacion: "", viaAplicacion: "IM", dosisMl: "", refuerzoDias: "",
  obligatoria: false, diasEsperaServicio: "0",
});

const EMPTY_MARCA_FORM = {
  enfermedadObjetivo: "", marcaComercial: "", laboratorio: "", principioActivo: "",
  paisProcedencia: "", tempConservacion: "", fichaTecnicaUrl: "", notas: "",
};

export default function VacunasTab({ modulo }: { modulo: ModuleKey }) {
  const [vacunas, setVacunas] = useState<ConfigVacuna[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

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

  // ── Agrupado por enfermedad → marcas (bifurcado por sujeto en Maternidad) ──
  const esMaternidad = modulo === "MATERNIDAD";

  const gruposGenerico      = useMemo(() => esMaternidad ? [] : agruparPorEnfermedad(vacunas), [vacunas, esMaternidad]);
  const gruposLechon        = useMemo(() => esMaternidad ? agruparPorEnfermedad(vacunas.filter(v => v.sujeto === "LECHON")) : [], [vacunas, esMaternidad]);
  const gruposHembra        = useMemo(() => esMaternidad ? agruparPorEnfermedad(vacunas.filter(v => v.sujeto === "HEMBRA")) : [], [vacunas, esMaternidad]);
  const gruposSinClasificar = useMemo(() => esMaternidad ? agruparPorEnfermedad(vacunas.filter(v => !v.sujeto)) : [], [vacunas, esMaternidad]);

  const totalGrupos = esMaternidad
    ? gruposLechon.length + gruposHembra.length + gruposSinClasificar.length
    : gruposGenerico.length;
  const totalGruposVisibles = esMaternidad
    ? [gruposLechon, gruposHembra, gruposSinClasificar].reduce((s, gs) => s + (mostrarTodas ? gs.length : gs.filter(g => g.obligatoria).length), 0)
    : (mostrarTodas ? gruposGenerico.length : gruposGenerico.filter(g => g.obligatoria).length);
  const ocultos = totalGrupos - totalGruposVisibles;

  const enfermedadesExistentes = useMemo(
    () => Array.from(new Set(vacunas.map(v => v.enfermedadObjetivo).filter(Boolean))) as string[],
    [vacunas],
  );

  function toggleExpand(key: string) {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)" }}><Spinner /></div>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn" onClick={handleSeed} disabled={seeding} style={{ fontSize: 12 }}>
          {seeding ? <Spinner /> : vacunas.length === 0 ? "Cargar protocolo por defecto" : "Recargar defaults"}
        </button>
        <button
          className="btn"
          onClick={() => setMostrarTodas(m => !m)}
          style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
        >
          {mostrarTodas ? <IconToggleRight size={16} style={{ color: "var(--success)" }} /> : <IconToggleLeft size={16} />}
          Mostrar todas las enfermedades{!mostrarTodas && ocultos > 0 ? ` (${ocultos} ocultas)` : ""}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {totalGruposVisibles} enfermedad{totalGruposVisibles !== 1 ? "es" : ""} — módulo {modulo}
        </span>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} /> Agregar vacuna
        </button>
      </div>

      {!mostrarTodas && (
        <div className="kp-alert kp-alert-info" style={{ fontSize: 11, marginBottom: 12 }}>
          Mostrando solo enfermedades con al menos un esquema obligatorio. Activá &quot;Mostrar todas&quot; para ver también las opcionales.
        </div>
      )}

      {vacunas.length === 0 ? (
        <div className="kp-alert kp-alert-info" style={{ fontSize: 12 }}>
          No hay vacunas registradas aún. Podés cargar el protocolo por defecto o agregar una manualmente.
        </div>
      ) : esMaternidad ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <SeccionSujeto
            titulo="Lechones" keyPrefix="lechon" grupos={gruposLechon} mostrarTodas={mostrarTodas}
            expandidas={expandidas} toggleExpand={toggleExpand} toggleActiva={toggleActiva}
          />
          <SeccionSujeto
            titulo="Hembras en lactación" keyPrefix="hembra" grupos={gruposHembra} mostrarTodas={mostrarTodas}
            expandidas={expandidas} toggleExpand={toggleExpand} toggleActiva={toggleActiva}
          />
          {gruposSinClasificar.length > 0 && (
            <SeccionSujeto
              titulo="Sin clasificar" keyPrefix="sinclasificar" grupos={gruposSinClasificar} mostrarTodas={mostrarTodas}
              expandidas={expandidas} toggleExpand={toggleExpand} toggleActiva={toggleActiva}
            />
          )}
        </div>
      ) : (
        <ListaGrupos
          grupos={mostrarTodas ? gruposGenerico : gruposGenerico.filter(g => g.obligatoria)}
          keyPrefix="gral" expandidas={expandidas} toggleExpand={toggleExpand} toggleActiva={toggleActiva}
          vacioMensaje='No hay enfermedades obligatorias configuradas. Activá "Mostrar todas" para ver las opcionales.'
        />
      )}

      {showForm && (
        <AgregarVacunaModal
          modulo={modulo}
          enfermedadesExistentes={enfermedadesExistentes}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </div>
  );
}

function SeccionSujeto({
  titulo, keyPrefix, grupos, mostrarTodas, expandidas, toggleExpand, toggleActiva,
}: {
  titulo: string; keyPrefix: string; grupos: GrupoEnfermedad[]; mostrarTodas: boolean;
  expandidas: Set<string>; toggleExpand: (k: string) => void; toggleActiva: (v: ConfigVacuna) => void;
}) {
  const visibles = mostrarTodas ? grupos : grupos.filter(g => g.obligatoria);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
        {titulo} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>({visibles.length})</span>
      </div>
      <ListaGrupos
        grupos={visibles} keyPrefix={keyPrefix} expandidas={expandidas} toggleExpand={toggleExpand} toggleActiva={toggleActiva}
        vacioMensaje={grupos.length === 0
          ? `Sin vacunas configuradas para ${titulo.toLowerCase()}.`
          : `No hay enfermedades obligatorias en ${titulo.toLowerCase()}. Activá "Mostrar todas" para ver las opcionales.`}
      />
    </div>
  );
}

function ListaGrupos({
  grupos, keyPrefix, expandidas, toggleExpand, toggleActiva, vacioMensaje,
}: {
  grupos: GrupoEnfermedad[]; keyPrefix: string; expandidas: Set<string>;
  toggleExpand: (k: string) => void; toggleActiva: (v: ConfigVacuna) => void; vacioMensaje: string;
}) {
  if (grupos.length === 0) {
    return <div className="kp-alert kp-alert-info" style={{ fontSize: 12 }}>{vacioMensaje}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {grupos.map(g => {
        const expKey = `${keyPrefix}::${g.enfermedad}`;
        const isOpen = expandidas.has(expKey);
        return (
          <div key={expKey} style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <button
              onClick={() => toggleExpand(expKey)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: "var(--bg-surface)", border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              {isOpen ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
              <IconVaccine size={15} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{g.enfermedad}</span>
              <span className="badge" style={{ fontSize: 10 }}>{g.totalMarcas} marca{g.totalMarcas !== 1 ? "s" : ""}</span>
              {g.obligatoria ? (
                <span className="badge badge-danger" style={{ fontSize: 10 }}>Obligatoria</span>
              ) : (
                <span className="badge" style={{ fontSize: 10 }}>Opcional</span>
              )}
            </button>

            {isOpen && (
              <div style={{ padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {g.marcas.map(m => (
                  <div key={`${m.marcaComercial}__${m.laboratorio}`} style={{ border: "0.5px solid var(--border-subtle, var(--border-default))", borderRadius: "var(--radius-md)", padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, fontSize: 12.5 }}>{m.marcaComercial}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.laboratorio}</span>
                      {m.stockDosis != null && (
                        <span style={{
                          fontSize: 10.5,
                          color: m.stockMinimoAlerta != null && m.stockDosis <= m.stockMinimoAlerta ? "var(--danger)" : "var(--text-muted)",
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          {m.stockMinimoAlerta != null && m.stockDosis <= m.stockMinimoAlerta && <IconAlertCircle size={11} />}
                          Stock: {m.stockDosis}{m.stockMinimoAlerta != null && ` / mín ${m.stockMinimoAlerta}`}
                        </span>
                      )}
                      {m.fichaTecnicaUrl && (
                        <a
                          href={m.fichaTecnicaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abre la ficha técnica oficial del laboratorio en PDF"
                          style={{ marginLeft: "auto", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, textDecoration: "none" }}
                        >
                          <IconFileText size={13} /> Ficha del producto
                        </a>
                      )}
                    </div>

                    <table className="kp-table" style={{ fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Dosis</th>
                          <th>Paridad</th>
                          <th>Momento</th>
                          <th>Vía</th>
                          <th>ml</th>
                          <th>Espera servicio</th>
                          <th>Obligatoria</th>
                          <th>Activa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.dosis.map(v => (
                          <tr key={v.id} style={{ opacity: v.activa ? 1 : 0.5 }}>
                            <td>#{v.ordenDosis}</td>
                            <td>
                              <span className="badge badge-mat" style={{ fontSize: 10 }}>{PARIDAD_LABELS[v.paridad]}</span>
                            </td>
                            <td>
                              {v.diaGestacion != null
                                ? `Día ${v.diaGestacion} de gestación`
                                : v.diaReferencia != null
                                  ? (v.sujeto === "LECHON" ? `Día ${v.diaReferencia} de vida` : `Día ${v.diaReferencia} post-parto`)
                                  : (MOMENTO_LABELS[v.momentoAplicacion] ?? v.momentoAplicacion)}
                            </td>
                            <td><span className="badge">{v.viaAplicacion}</span></td>
                            <td>{v.dosisMl}</td>
                            <td>{v.diasEsperaServicio ? `${v.diasEsperaServicio}d` : "—"}</td>
                            <td>{v.obligatoria ? <span className="badge badge-danger" style={{ fontSize: 10 }}>Sí</span> : <span style={{ color: "var(--text-muted)" }}>No</span>}</td>
                            <td>
                              <button
                                onClick={() => toggleActiva(v)}
                                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: v.activa ? "var(--success)" : "var(--text-muted)", padding: 0 }}
                              >
                                {v.activa ? <IconToggleRight size={18} /> : <IconToggleLeft size={18} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgregarVacunaModal({
  modulo, enfermedadesExistentes, onClose, onSaved, saving, setSaving,
}: {
  modulo: ModuleKey; enfermedadesExistentes: string[]; onClose: () => void; onSaved: () => void;
  saving: boolean; setSaving: (v: boolean) => void;
}) {
  const esMaternidad = modulo === "MATERNIDAD";
  const [marca, setMarca] = useState({ ...EMPTY_MARCA_FORM });
  const [sujeto, setSujeto] = useState<Sujeto>("LECHON");
  const [tab, setTab] = useState<Paridad>("AMBAS");
  const [dosisPorParidad, setDosisPorParidad] = useState<Record<Paridad, DosisRow[]>>({
    AMBAS: [nuevaDosisRow(1)], NULIPARA: [], MULTIPARA: [],
  });
  const [error, setError] = useState<string | null>(null);
  const tabActivo: Paridad = esMaternidad ? "AMBAS" : tab;

  const sugerenciasMarca = useMemo(
    () => buscarMarcas(marca.marcaComercial, marca.laboratorio || undefined),
    [marca.marcaComercial, marca.laboratorio],
  );

  function M(k: keyof typeof marca, v: string) { setMarca(p => ({ ...p, [k]: v })); }

  function seleccionarMarca(nombre: string) {
    const match = sugerenciasMarca.find(s => s.marcaComercial === nombre) ?? buscarMarcas(nombre).find(s => s.marcaComercial === nombre);
    setMarca(p => ({
      ...p,
      marcaComercial: nombre,
      laboratorio: match?.laboratorio ?? p.laboratorio,
      principioActivo: p.principioActivo || match?.principioActivo || "",
    }));
  }

  function addDosis(p: Paridad) {
    setDosisPorParidad(prev => ({ ...prev, [p]: [...prev[p], nuevaDosisRow(prev[p].length + 1)] }));
  }
  function removeDosis(p: Paridad, key: string) {
    setDosisPorParidad(prev => ({ ...prev, [p]: prev[p].filter(d => d.key !== key) }));
  }
  function updateDosis(p: Paridad, key: string, patch: Partial<DosisRow>) {
    setDosisPorParidad(prev => ({
      ...prev,
      [p]: prev[p].map(d => d.key === key ? { ...d, ...patch } : d),
    }));
  }

  async function handleGuardar() {
    setError(null);
    const { enfermedadObjetivo, marcaComercial, laboratorio, principioActivo, paisProcedencia, tempConservacion } = marca;
    if (!enfermedadObjetivo || !marcaComercial || !laboratorio || !principioActivo || !paisProcedencia || !tempConservacion) {
      setError("Completá enfermedad, marca, laboratorio, principio activo, país y temperatura de conservación.");
      return;
    }
    const todasLasDosis = (["AMBAS", "NULIPARA", "MULTIPARA"] as Paridad[]).flatMap(p => dosisPorParidad[p].map(d => ({ ...d, paridad: p })));
    if (todasLasDosis.length === 0) {
      setError("Agregá al menos una dosis en alguna de las pestañas de paridad.");
      return;
    }
    for (const d of todasLasDosis) {
      if (!d.dosisMl) { setError("Cada dosis necesita la cantidad en ml."); return; }
    }

    setSaving(true);
    try {
      let ordenGlobal = 1;
      for (const d of todasLasDosis) {
        const diaValor = d.diaGestacion ? Number(d.diaGestacion) : null;
        const momentoAplicacion = esMaternidad
          ? (diaValor != null ? `Día ${diaValor} ${sujeto === "LECHON" ? "de vida" : "post-parto"}` : "Sin día fijo (a criterio veterinario)")
          : (diaValor != null ? `Día ${diaValor} de gestación` : "Sin día fijo (a criterio veterinario)");
        const res = await fetch("/api/config/vacunas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modulo,
            nombreVacuna: enfermedadObjetivo,
            marcaComercial, laboratorio, principioActivo,
            enfermedadObjetivo,
            viaAplicacion: d.viaAplicacion,
            dosisMl: Number(d.dosisMl),
            momentoAplicacion,
            refuerzoDias: d.refuerzoDias ? Number(d.refuerzoDias) : null,
            paisProcedencia, tempConservacion,
            fichaTecnicaUrl: marca.fichaTecnicaUrl || null,
            obligatoria: d.obligatoria,
            diasEsperaServicio: Number(d.diasEsperaServicio) || 0,
            notas: marca.notas || null,
            paridad: d.paridad,
            diaGestacion: esMaternidad ? null : diaValor,
            sujeto: esMaternidad ? sujeto : null,
            diaReferencia: esMaternidad ? diaValor : null,
            ordenDosis: ordenGlobal++,
          }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error ?? "Error al guardar una de las dosis");
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 660, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>
            Agregar vacuna — módulo {modulo}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
          {error && <div className="kp-alert kp-alert-danger" style={{ fontSize: 12 }}>{error}</div>}

          <div>
            <label className="kp-label">Enfermedad *</label>
            <input className="kp-input" list="enfermedades-existentes" value={marca.enfermedadObjetivo}
              onChange={e => M("enfermedadObjetivo", e.target.value)} placeholder="Ej: Parvovirosis + Leptospirosis" />
            <datalist id="enfermedades-existentes">
              {enfermedadesExistentes.map(en => <option key={en} value={en} />)}
            </datalist>
          </div>

          {esMaternidad && (
            <div>
              <label className="kp-label">Sujeto de aplicación *</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["LECHON", "HEMBRA"] as Sujeto[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSujeto(s)}
                    className="btn"
                    style={{
                      fontSize: 11.5, padding: "5px 12px",
                      background: sujeto === s ? "var(--accent)" : undefined,
                      color: sujeto === s ? "#fff" : undefined,
                      border: sujeto === s ? "0.5px solid var(--accent)" : undefined,
                    }}
                  >
                    {SUJETO_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="kp-label">Marca comercial *</label>
              <input className="kp-input" list="marcas-sugeridas" value={marca.marcaComercial}
                onChange={e => seleccionarMarca(e.target.value)} placeholder="Ej: Suiseng" />
              <datalist id="marcas-sugeridas">
                {sugerenciasMarca.map(s => <option key={s.marcaComercial} value={s.marcaComercial}>{s.laboratorio}</option>)}
              </datalist>
            </div>
            <div>
              <label className="kp-label">Laboratorio *</label>
              <input className="kp-input" list="laboratorios-conocidos" value={marca.laboratorio}
                onChange={e => M("laboratorio", e.target.value)} placeholder="Ej: Hipra" />
              <datalist id="laboratorios-conocidos">
                {LABORATORIOS.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="kp-label">Principio activo *</label>
            <input className="kp-input" value={marca.principioActivo} onChange={e => M("principioActivo", e.target.value)} placeholder="Ej: Parvovirus porcino + Leptospira spp." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="kp-label">País procedencia *</label>
              <input className="kp-input" value={marca.paisProcedencia} onChange={e => M("paisProcedencia", e.target.value)} placeholder="Ej: ESP, USA, DEU" />
            </div>
            <div>
              <label className="kp-label">Temperatura de conservación *</label>
              <input className="kp-input" value={marca.tempConservacion} onChange={e => M("tempConservacion", e.target.value)} placeholder="Ej: 2–8 °C" />
            </div>
          </div>

          <div>
            <label className="kp-label">URL Ficha Técnica</label>
            <input className="kp-input" type="url" value={marca.fichaTecnicaUrl} onChange={e => M("fichaTecnicaUrl", e.target.value)} placeholder="https://…" />
          </div>

          {/* ── Esquema de dosis ──────────────────────────────────────── */}
          <div style={{ borderTop: "0.5px solid var(--border-default)", paddingTop: 12 }}>
            <label className="kp-label" style={{ marginBottom: 8, display: "block" }}>Esquema de dosis</label>
            {!esMaternidad && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["AMBAS", "NULIPARA", "MULTIPARA"] as Paridad[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setTab(p)}
                    className="btn"
                    style={{
                      fontSize: 11.5, padding: "5px 12px",
                      background: tab === p ? "var(--accent)" : undefined,
                      color: tab === p ? "#fff" : undefined,
                      border: tab === p ? "0.5px solid var(--accent)" : undefined,
                    }}
                  >
                    {PARIDAD_LABELS[p]} ({dosisPorParidad[p].length})
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dosisPorParidad[tabActivo].length === 0 && (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Sin dosis todavía.</div>
              )}
              {dosisPorParidad[tabActivo].map((d, idx) => (
                <div key={d.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr auto auto", gap: 8, alignItems: "end", background: "var(--bg-canvas, rgba(0,0,0,.02))", padding: 8, borderRadius: "var(--radius-md)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", paddingBottom: 8 }}>#{idx + 1}</span>
                  <div>
                    <label className="kp-label" style={{ fontSize: 10 }}>
                      {esMaternidad ? (sujeto === "LECHON" ? "Día de vida" : "Día post-parto") : "Día de gestación"}
                    </label>
                    <input className="kp-input" type="number" min="0" value={d.diaGestacion}
                      onChange={e => updateDosis(tabActivo, d.key, { diaGestacion: e.target.value })} placeholder={esMaternidad ? "Ej: 21" : "Ej: 70"} />
                  </div>
                  <div>
                    <label className="kp-label" style={{ fontSize: 10 }}>Vía</label>
                    <select className="kp-input" style={{ appearance: "auto" }} value={d.viaAplicacion}
                      onChange={e => updateDosis(tabActivo, d.key, { viaAplicacion: e.target.value })}>
                      <option value="IM">IM</option><option value="SC">SC</option><option value="IV">IV</option>
                      <option value="ORAL">ORAL</option><option value="INTRANASAL">Intranasal</option>
                    </select>
                  </div>
                  <div>
                    <label className="kp-label" style={{ fontSize: 10 }}>Dosis (ml) *</label>
                    <input className="kp-input" type="number" step="0.1" min="0" value={d.dosisMl}
                      onChange={e => updateDosis(tabActivo, d.key, { dosisMl: e.target.value })} />
                  </div>
                  <div>
                    <label className="kp-label" style={{ fontSize: 10 }}>Espera servicio (d)</label>
                    <input className="kp-input" type="number" min="0" value={d.diasEsperaServicio}
                      onChange={e => updateDosis(tabActivo, d.key, { diasEsperaServicio: e.target.value })} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, paddingBottom: 8, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={d.obligatoria} onChange={e => updateDosis(tabActivo, d.key, { obligatoria: e.target.checked })} />
                    Obligatoria
                  </label>
                  <button onClick={() => removeDosis(tabActivo, d.key)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", paddingBottom: 8 }}>
                    <IconX size={14} />
                  </button>
                </div>
              ))}
              <button className="btn" style={{ fontSize: 11.5, alignSelf: "flex-start" }} onClick={() => addDosis(tabActivo)}>
                <IconPlus size={12} /> Agregar dosis{!esMaternidad && ` en "${PARIDAD_LABELS[tabActivo]}"`}
              </button>
            </div>
          </div>

          <div>
            <label className="kp-label">Notas / Observaciones</label>
            <textarea className="kp-input" rows={2} value={marca.notas} onChange={e => M("notas", e.target.value)}
              placeholder="Contraindicaciones, observaciones de uso, etc." style={{ height: "auto", paddingTop: 8, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? <Spinner /> : (<><IconShieldCheck size={13} /> Guardar vacuna</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
