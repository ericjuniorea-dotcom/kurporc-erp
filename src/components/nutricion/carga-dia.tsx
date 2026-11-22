"use client";
// Sanidad y Nutrición · carga del día. Cada entrega es una carga nueva (en un día puede haber varias del mismo
// balanceado): al guardar, la casilla vuelve a cero y abajo queda la última carga (kg, quién y a qué hora) y el
// total del día. Gestación, Iniciación y Engorde: por balanceado. Maternidad: por hembra lactante (ella y sus lechones).
// Lechones: cada balanceado es una fase con meta = lechones vivos × kg por lechón; la barra muestra lo consumido
// desde el parto y, al llegar, avisa que hay que pasar al siguiente (si muere un lechón, la meta baja sola).
import { useCallback, useEffect, useState, useTransition } from "react";
import { IconArrowRight, IconCheck, IconChevronDown, IconCircleCheck, IconChevronUp, IconLoader2, IconX } from "@tabler/icons-react";
import { anularConsumo, registrarConsumo, type nutricionDia } from "@/app/acciones/nutricion";
import { leerDia } from "@/lib/nutricion/cliente";
import { CaravanaFicha } from "@/components/plantel/caravana-ficha";
import type { ModuloNutricion } from "@/lib/nutricion/plan";
import { mensajeError } from "@/lib/version-vieja";

type Datos = Awaited<ReturnType<typeof nutricionDia>>;
type Tipo = Datos["tipos"][number];
type Reg = Datos["registros"][number];

const hoyPY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
const kg = (v: number) => `${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`;
const gs = (v: number) => `₲ ${Math.round(v).toLocaleString("es-PY")}`;
const hora = (iso: string) => new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const numero = (s: string) => Number(s.replace(",", ".")) || 0;
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function CargaDiaNutricion() {
  const [fecha, setFecha] = useState(hoyPY());
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(() => {
    setError(null);
    // Si falla, reintenta una vez; si es porque la pantalla quedó con una versión vieja, recarga sola
    leerDia(fecha).then(setDatos).catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : "No se pudo cargar."));
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return (
    <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {error}
      <button type="button" className="btn" onClick={() => window.location.reload()}>Recargar</button>
      <button type="button" className="btn" onClick={cargar}>Reintentar</button>
    </div>
  );
  if (!datos) return <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}><IconLoader2 size={15} className="animate-spin" aria-hidden /> Cargando…</div>;

  const tiposDe = (m: ModuloNutricion) => datos.tipos.filter(t => t.modulo === m);
  const regsDe = (feedTypeId: string, farrowingId: string | null) => datos.registros.filter(r => r.feedTypeId === feedTypeId && r.farrowingId === farrowingId);
  // Teórico del día (solo donde hay meta)
  let teorico = 0;
  for (const t of tiposDe("GESTACION").slice(0, 1)) teorico += (t.kgPorAnimal ?? 0) * datos.animales.GESTACION;
  const hembra = tiposDe("MATERNIDAD_HEMBRAS")[0];
  // (los lechones tienen meta por fase, no por día: se siguen con la barra de cada camada)
  for (let i = 0; i < datos.cerdas.length; i++) teorico += hembra?.kgPorAnimal ?? 0;
  const cargado = datos.registros.reduce((s, r) => s + r.kg, 0);
  const costo = datos.registros.reduce((s, r) => s + r.costoGs, 0);
  const sinPlan = datos.tipos.length === 0;
  const comun = { fecha, regsDe, onGuardado: cargar };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
          Día
          <input type="date" className="kp-input" value={fecha} max={hoyPY()} onChange={e => e.target.value && setFecha(e.target.value)} style={{ height: 32 }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, flex: 1, minWidth: 280 }}>
          {[["Teórico del día", kg(teorico)], ["Cargado", `${kg(cargado)} · ${datos.registros.length} carga${datos.registros.length === 1 ? "" : "s"}`], ["Costo del día", gs(costo)]].map(([t, v]) => (
            <div key={t} style={{ ...tarjeta, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {sinPlan && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Todavía no hay balanceados en el plan. Abrí «Plan de alimentación» y tocá «Cargar plan sugerido».</div>}

      <ModuloTotal titulo="Gestación" animales={datos.animales.GESTACION} detalle="reproductoras activas fuera de Maternidad" tipos={tiposDe("GESTACION")} {...comun} />

      <section style={tarjeta} aria-label="Maternidad">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Maternidad</h3>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{datos.cerdas.length} reproductoras lactantes · cargá lo que se entregó a cada una y a sus lechones</span>
        </div>
        {datos.cerdas.length === 0 ? <div style={{ padding: 14, fontSize: 12.5, color: "var(--text-muted)" }}>No hay reproductoras en Maternidad.</div> : (
          <div className="kp-cerdas-carga">
            {datos.cerdas.map(c => <FilaCerda key={c.farrowingId} c={c} hembra={hembra} lechones={tiposDe("MATERNIDAD_LECHONES")} {...comun} />)}
          </div>
        )}
      </section>

      <ModuloTotal titulo="Iniciación" animales={datos.animales.INICIACION} detalle={`lechones en ${datos.lotes.INICIACION} lote(s)`} tipos={tiposDe("INICIACION")} {...comun} />
      <ModuloTotal titulo="Engorde" animales={datos.animales.ENGORDE} detalle={`cerdos en ${datos.lotes.ENGORDE} lote(s)`} tipos={tiposDe("ENGORDE")} {...comun} />
    </div>
  );
}

function Stock({ t }: { t: Tipo }) {
  return <span style={{ fontSize: 11, color: t.stockKg <= 0 ? "var(--danger-text)" : "var(--text-muted)" }}>stock {kg(t.stockKg)}{t.costoKg ? ` · ${gs(t.costoKg)}/kg` : ""}</span>;
}

/** Lo ya cargado de un balanceado: total del día, la última carga (quién y a qué hora) y el detalle con «Anular». */
function Cargas({ regs, onCambio }: { regs: Reg[]; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (regs.length === 0) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin cargas este día</span>;
  const ultima = regs[regs.length - 1];
  const total = regs.reduce((s, r) => s + r.kg, 0);
  const anular = (r: Reg) => {
    if (!window.confirm(`¿Anular la carga de ${kg(r.kg)} de las ${hora(r.hora)}? El balanceado vuelve al inventario.`)) return;
    setMsg(null);
    iniciar(async () => {
      const res = await anularConsumo(r.id).catch((e: unknown) => ({ ok: false as const, error: mensajeError(e, "No se pudo anular. Probá de nuevo.") }));
      if (!res.ok) setMsg(res.error); else onCambio();
    });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5 }}>
      <span style={{ color: "var(--success-text)", display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <IconCheck size={12} aria-hidden />
        Última: {kg(ultima.kg)}{ultima.quien ? ` · ${ultima.quien}` : ""} · {hora(ultima.hora)}
      </span>
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
        style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "var(--text-secondary)", display: "inline-flex", gap: 3, alignItems: "center" }}>
        Total del día: <strong style={{ fontWeight: 500 }}>{kg(total)}</strong> en {regs.length} carga{regs.length === 1 ? "" : "s"}
        {abierto ? <IconChevronUp size={12} aria-hidden /> : <IconChevronDown size={12} aria-hidden />}
      </button>
      {abierto && (
        <ul style={{ listStyle: "none", margin: 0, padding: "4px 0 0", display: "flex", flexDirection: "column", gap: 2, borderTop: "0.5px dashed var(--border-default)" }}>
          {[...regs].reverse().map(r => (
            <li key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              <span>{hora(r.hora)}</span><span>· {kg(r.kg)}</span>{r.costoGs > 0 && <span>· {gs(r.costoGs)}</span>}<span>· {r.quien ?? "—"}</span>
              {r.puedeAnular && (
                <button type="button" disabled={pendiente} onClick={() => anular(r)} aria-label={`Anular la carga de las ${hora(r.hora)}`} title="Anular esta carga"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-text)", display: "inline-flex", padding: 0 }}><IconX size={12} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <span role="status" style={{ color: "var(--danger-text)" }}>{msg}</span>}
    </div>
  );
}

/** Guarda una o más cargas; si sale bien, avisa para vaciar las casillas y recarga el día. */
function useGuardar(onGuardado: () => void) {
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "ok" | "aviso" | "error"; texto: string } | null>(null);
  const guardar = (items: { fecha: string; feedTypeId: string; farrowingId: string | null; kg: number }[], alGuardar: (guardados: string[]) => void) => {
    setMsg(null);
    if (items.length === 0) { setMsg({ tipo: "error", texto: "Cargá los kg entregados." }); return; }
    iniciar(async () => {
      const avisos: string[] = [], guardados: string[] = [];
      for (const it of items) {
        const r = await registrarConsumo(it).catch((e: unknown) => ({ ok: false as const, error: mensajeError(e, "No se pudo guardar. Probá de nuevo.") }));
        if (!r.ok) { alGuardar(guardados); setMsg({ tipo: "error", texto: r.error }); onGuardado(); return; }
        guardados.push(it.feedTypeId);
        if (r.aviso) avisos.push(r.aviso);
      }
      alGuardar(guardados);
      setMsg(avisos.length ? { tipo: "aviso", texto: avisos.join(" ") } : { tipo: "ok", texto: "Guardado" });
      onGuardado();
    });
  };
  return { pendiente, msg, guardar };
}

function Mensaje({ msg }: { msg: { tipo: "ok" | "aviso" | "error"; texto: string } | null }) {
  if (!msg) return null;
  const color = msg.tipo === "ok" ? "var(--success-text)" : msg.tipo === "aviso" ? "var(--warning-text)" : "var(--danger-text)";
  return <span role="status" style={{ fontSize: 12, color }}>{msg.texto}</span>;
}

function ModuloTotal({ titulo, animales, detalle, tipos, fecha, regsDe, onGuardado }: {
  titulo: string; animales: number; detalle: string; tipos: Tipo[]; fecha: string;
  regsDe: (t: string, f: string | null) => Reg[]; onGuardado: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const { pendiente, msg, guardar } = useGuardar(onGuardado);
  const aGuardar = tipos.filter(t => numero(valores[t.id] ?? "") > 0);
  return (
    <section style={{ ...tarjeta, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }} aria-label={titulo}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{animales.toLocaleString("es-PY")} {detalle}</span>
      </div>
      {tipos.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin balanceado en el plan para este módulo.</span>}
      {tipos.map(t => {
        const meta = t.kgPorAnimal != null ? t.kgPorAnimal * animales : null;
        return (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.nombre}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {meta != null ? <>Teórico: <strong style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{kg(meta)}</strong> ({t.kgPorAnimal} kg × {animales})</> : "A gusto (sin meta)"} · <Stock t={t} />
              </div>
            </div>
            <input className="kp-input" inputMode="decimal" aria-label={`kg entregados de ${t.nombre}`} placeholder="0 kg" value={valores[t.id] ?? ""}
              onChange={e => setValores(v => ({ ...v, [t.id]: e.target.value }))} style={{ height: 32, width: 110 }} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}><Cargas regs={regsDe(t.id, null)} onCambio={onGuardado} /></div>
          </div>
        );
      })}
      {tipos.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente || aGuardar.length === 0}
            onClick={() => guardar(aGuardar.map(t => ({ fecha, feedTypeId: t.id, farrowingId: null, kg: numero(valores[t.id]) })), g => setValores(v => Object.fromEntries(Object.entries(v).filter(([k]) => !g.includes(k)))))}>
            {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Guardar {titulo.toLowerCase()}
          </button>
          <Mensaje msg={msg} />
        </div>
      )}
    </section>
  );
}

function FilaCerda({ c, hembra, lechones, fecha, regsDe, onGuardado }: {
  c: Datos["cerdas"][number]; hembra?: Tipo; lechones: Tipo[]; fecha: string;
  regsDe: (t: string, f: string | null) => Reg[]; onGuardado: () => void;
}) {
  // Arranca en la fase en curso: el primer balanceado cuya meta todavía no se completó
  const enCurso = lechones.find(t => !completa(t, c)) ?? lechones[lechones.length - 1];
  const [tipoL, setTipoL] = useState(enCurso?.id ?? "");
  const [kgH, setKgH] = useState("");
  const [kgL, setKgL] = useState("");
  const { pendiente, msg, guardar } = useGuardar(onGuardado);
  const tL = lechones.find(t => t.id === tipoL);
  const items = [
    ...(hembra && numero(kgH) > 0 ? [{ fecha, feedTypeId: hembra.id, farrowingId: c.farrowingId, kg: numero(kgH) }] : []),
    ...(tL && numero(kgL) > 0 ? [{ fecha, feedTypeId: tL.id, farrowingId: c.farrowingId, kg: numero(kgL) }] : []),
  ];
  // Las cargas de lechones de todos los balanceados (puede haber pasado de Vilo Baby a Pre-inicial en el día)
  const regsL = lechones.flatMap(t => regsDe(t.id, c.farrowingId).map(r => ({ ...r, quien: r.quien ? `${r.quien} · ${t.nombre}` : t.nombre })))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <article className="kp-cerda-carga" aria-label={`Reproductora ${c.caravana}`}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}><CaravanaFicha sowId={c.sowId} caravana={c.caravana} /></span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{c.lechones} lechones · {c.dias} días de lactancia</span>
      </header>
      <div className="kp-cerda-bloque">
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Reproductora{hembra ? ` · ${hembra.nombre}` : ""}</div>
        {hembra ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="kp-input" inputMode="decimal" aria-label="kg entregados a la reproductora" placeholder="0 kg" value={kgH} onChange={e => setKgH(e.target.value)} style={{ height: 40, width: 120 }} />
              {hembra.kgPorAnimal != null && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>teórico {kg(hembra.kgPorAnimal)}</span>}
            </div>
            <Cargas regs={regsDe(hembra.id, c.farrowingId)} onCambio={onGuardado} />
          </>
        ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin balanceado de lactación en el plan</span>}
      </div>
      <div className="kp-cerda-bloque">
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Lechones</div>
        {lechones.length ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="kp-input" aria-label="Balanceado de los lechones" value={tipoL} onChange={e => setTipoL(e.target.value)} style={{ height: 40, flex: "1 1 140px", minWidth: 0 }}>
                {lechones.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <input className="kp-input" inputMode="decimal" aria-label="kg entregados a los lechones" placeholder="0 kg" value={kgL} onChange={e => setKgL(e.target.value)} style={{ height: 40, width: 120 }} />
            </div>
            {tL && <AvanceFase t={tL} c={c} siguiente={lechones[lechones.indexOf(tL) + 1]} onPasar={setTipoL} />}
            <Cargas regs={regsL} onCambio={onGuardado} />
          </>
        ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin balanceado de lechones en el plan</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button type="button" className="btn btn-primary" style={{ height: 42, fontSize: 14, width: "100%", justifyContent: "center" }} disabled={pendiente || items.length === 0}
          onClick={() => guardar(items, g => { if (hembra && g.includes(hembra.id)) setKgH(""); if (tL && g.includes(tL.id)) setKgL(""); })}>
          {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar
        </button>
        <Mensaje msg={msg} />
      </div>
    </article>
  );
}

const metaFase = (t: Tipo, c: Datos["cerdas"][number]) => t.kgPorAnimal != null ? t.kgPorAnimal * c.lechones : null;
const completa = (t: Tipo, c: Datos["cerdas"][number]) => { const m = metaFase(t, c); return m != null && m > 0 && (c.consumido[t.id] ?? 0) >= m - 1e-9; };

/** Consumido hasta el momento de esta fase (balanceado) frente a la meta de la camada, con barra verde que se llena. */
function AvanceFase({ t, c, siguiente, onPasar }: { t: Tipo; c: Datos["cerdas"][number]; siguiente?: Tipo; onPasar: (id: string) => void }) {
  const consumido = c.consumido[t.id] ?? 0;
  const meta = metaFase(t, c);
  if (meta == null) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Consumido hasta el momento: {kg(consumido)} (sin meta en el plan)</span>;
  const listo = completa(t, c);
  const pct = meta > 0 ? Math.min(100, (consumido / meta) * 100) : 0;
  return (
    <div style={{ border: `0.5px solid ${listo ? "var(--success)" : "var(--border-default)"}`, background: listo ? "var(--success-subtle, var(--bg-elevated))" : "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--text-secondary)" }}>
        <span>Consumido de {t.nombre}</span>
        <strong style={{ fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{kg(consumido)} de {kg(meta)}</strong>
      </div>
      <div role="progressbar" aria-label={`Avance de ${t.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        style={{ height: 8, borderRadius: 4, background: "var(--bg-overlay)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: "var(--success)", transition: "width .4s ease" }} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Meta: {c.lechones} lechones vivos × {t.kgPorAnimal} kg{!listo && meta > consumido ? ` · faltan ${kg(meta - consumido)}` : ""}</div>
      {listo && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 500, color: "var(--success-text)" }}>
          <IconCircleCheck size={14} aria-hidden />
          Completado{siguiente ? <> · pasar a {siguiente.nombre}</> : " · última fase de maternidad"}
          {siguiente && (
            <button type="button" onClick={() => onPasar(siguiente.id)} className="btn"
              style={{ height: 24, fontSize: 11.5, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Pasar a {siguiente.nombre} <IconArrowRight size={12} aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
