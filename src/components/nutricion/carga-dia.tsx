"use client";
// Sanidad y Nutrición · carga del día. Gestación, Iniciación y Engorde: kg totales del día por balanceado.
// Maternidad: por hembra lactante, lo que comió ella y lo que comieron sus lechones (Vilo Baby, Pre-inicial 1 o 2).
// Cada carga descuenta del inventario y queda quién la hizo y cuánto costó.
import { useCallback, useEffect, useState, useTransition } from "react";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { guardarConsumo, nutricionDia } from "@/app/acciones/nutricion";
import { CaravanaFicha } from "@/components/plantel/caravana-ficha";
import type { ModuloNutricion } from "@/lib/nutricion/plan";

type Datos = Awaited<ReturnType<typeof nutricionDia>>;
type Tipo = Datos["tipos"][number];
type Reg = Datos["registros"][number];

const hoyPY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
const kg = (v: number) => `${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`;
const gs = (v: number) => `₲ ${Math.round(v).toLocaleString("es-PY")}`;
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function CargaDiaNutricion() {
  const [fecha, setFecha] = useState(hoyPY());
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(() => {
    setError(null);
    nutricionDia(fecha).then(setDatos).catch(() => setError("No se pudo cargar. Recargá la página."));
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</div>;
  if (!datos) return <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}><IconLoader2 size={15} className="animate-spin" aria-hidden /> Cargando…</div>;

  const tiposDe = (m: ModuloNutricion) => datos.tipos.filter(t => t.modulo === m);
  const regDe = (feedTypeId: string, farrowingId: string | null) => datos.registros.find(r => r.feedTypeId === feedTypeId && r.farrowingId === farrowingId);
  // Teórico del día (solo donde hay meta)
  let teorico = 0;
  for (const t of tiposDe("GESTACION").slice(0, 1)) teorico += (t.kgPorAnimal ?? 0) * datos.animales.GESTACION;
  const hembra = tiposDe("MATERNIDAD_HEMBRAS")[0];
  for (const c of datos.cerdas) {
    teorico += hembra?.kgPorAnimal ?? 0;
    const lt = tiposDe("MATERNIDAD_LECHONES").find(t => regDe(t.id, c.farrowingId)) ?? tiposDe("MATERNIDAD_LECHONES")[0];
    teorico += (lt?.kgPorAnimal ?? 0) * c.lechones;
  }
  const cargado = datos.registros.reduce((s, r) => s + r.kg, 0);
  const costo = datos.registros.reduce((s, r) => s + r.costoGs, 0);
  const sinPlan = datos.tipos.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
          Día
          <input type="date" className="kp-input" value={fecha} max={hoyPY()} onChange={e => setFecha(e.target.value)} style={{ height: 32 }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 8, flex: 1, minWidth: 300 }}>
          {[["Teórico del día", kg(teorico)], ["Cargado", kg(cargado)], ["Costo del día", gs(costo)]].map(([t, v]) => (
            <div key={t} style={{ ...tarjeta, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {sinPlan && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Todavía no hay balanceados en el plan. Abrí «Plan de alimentación» y tocá «Cargar plan sugerido».</div>}

      <ModuloTotal titulo="Gestación" animales={datos.animales.GESTACION} detalle="hembras activas fuera de Maternidad" tipos={tiposDe("GESTACION")} fecha={fecha} regDe={regDe} onGuardado={cargar} />

      <section style={{ ...tarjeta, overflow: "hidden" }} aria-label="Maternidad">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Maternidad</h3>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{datos.cerdas.length} hembras lactantes · cargá lo que comió cada una y sus lechones</span>
        </div>
        {datos.cerdas.length === 0 ? <div style={{ padding: 14, fontSize: 12.5, color: "var(--text-muted)" }}>No hay hembras en Maternidad.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table className="kp-table" style={{ minWidth: 860 }}>
              <thead><tr><th>Cerda</th><th style={{ textAlign: "right" }}>Lechones</th><th>Hembra (lactación)</th><th>Lechones</th><th /></tr></thead>
              <tbody>
                {datos.cerdas.map(c => <FilaCerda key={c.farrowingId} c={c} hembra={hembra} lechones={tiposDe("MATERNIDAD_LECHONES")} fecha={fecha} regDe={regDe} onGuardado={cargar} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModuloTotal titulo="Iniciación" animales={datos.animales.INICIACION} detalle={`lechones en ${datos.lotes.INICIACION} lote(s)`} tipos={tiposDe("INICIACION")} fecha={fecha} regDe={regDe} onGuardado={cargar} />
      <ModuloTotal titulo="Engorde" animales={datos.animales.ENGORDE} detalle={`cerdos en ${datos.lotes.ENGORDE} lote(s)`} tipos={tiposDe("ENGORDE")} fecha={fecha} regDe={regDe} onGuardado={cargar} />
    </div>
  );
}

function Stock({ t }: { t: Tipo }) {
  return <span style={{ fontSize: 11, color: t.stockKg <= 0 ? "var(--danger-text)" : "var(--text-muted)" }}>stock {kg(t.stockKg)}{t.costoKg ? ` · ${gs(t.costoKg)}/kg` : ""}</span>;
}

function Guardado({ r }: { r?: Reg }) {
  if (!r) return null;
  return <span style={{ fontSize: 11, color: "var(--success-text)", display: "inline-flex", gap: 4, alignItems: "center" }}><IconCheck size={12} aria-hidden /> {kg(r.kg)}{r.costoGs ? ` · ${gs(r.costoGs)}` : ""}{r.quien ? ` · ${r.quien}` : ""}</span>;
}

function useGuardar(onGuardado: () => void) {
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const guardar = (items: { fecha: string; feedTypeId: string; farrowingId: string | null; kg: number }[]) => {
    setMsg(null);
    iniciar(async () => {
      const avisos: string[] = [];
      for (const it of items) {
        const r = await guardarConsumo(it).catch(() => ({ ok: false as const, error: "No se pudo guardar. Recargá la página." }));
        if (!r.ok) { setMsg(r.error); return; }
        if (r.aviso) avisos.push(r.aviso);
      }
      if (avisos.length) setMsg(avisos.join(" "));
      onGuardado();
    });
  };
  return { pendiente, msg, guardar };
}

function ModuloTotal({ titulo, animales, detalle, tipos, fecha, regDe, onGuardado }: {
  titulo: string; animales: number; detalle: string; tipos: Tipo[]; fecha: string;
  regDe: (t: string, f: string | null) => Reg | undefined; onGuardado: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const { pendiente, msg, guardar } = useGuardar(onGuardado);
  useEffect(() => { setValores(Object.fromEntries(tipos.map(t => [t.id, regDe(t.id, null) ? String(regDe(t.id, null)!.kg) : ""]))); }, [tipos, regDe]);
  return (
    <section style={{ ...tarjeta, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }} aria-label={titulo}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{animales.toLocaleString("es-PY")} {detalle}</span>
      </div>
      {tipos.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin balanceado en el plan para este módulo.</span>}
      {tipos.map(t => {
        const meta = t.kgPorAnimal != null ? t.kgPorAnimal * animales : null;
        return (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.nombre}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {meta != null ? <>Teórico: <strong style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{kg(meta)}</strong> ({t.kgPorAnimal} kg × {animales})</> : "A gusto (sin meta)"} · <Stock t={t} />
              </div>
            </div>
            <input className="kp-input" inputMode="decimal" aria-label={`kg de ${t.nombre}`} placeholder="kg del día" value={valores[t.id] ?? ""}
              onChange={e => setValores(v => ({ ...v, [t.id]: e.target.value }))} style={{ height: 32, width: 120 }} />
            <Guardado r={regDe(t.id, null)} />
          </div>
        );
      })}
      {tipos.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente}
            onClick={() => guardar(tipos.filter(t => (valores[t.id] ?? "") !== "" || regDe(t.id, null)).map(t => ({ fecha, feedTypeId: t.id, farrowingId: null, kg: Number((valores[t.id] || "0").replace(",", ".")) || 0 })))}>
            {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Guardar {titulo.toLowerCase()}
          </button>
          {msg && <span role="status" style={{ fontSize: 12, color: "var(--warning-text)" }}>{msg}</span>}
        </div>
      )}
    </section>
  );
}

function FilaCerda({ c, hembra, lechones, fecha, regDe, onGuardado }: {
  c: Datos["cerdas"][number]; hembra?: Tipo; lechones: Tipo[]; fecha: string;
  regDe: (t: string, f: string | null) => Reg | undefined; onGuardado: () => void;
}) {
  const regH = hembra ? regDe(hembra.id, c.farrowingId) : undefined;
  const tipoGuardado = lechones.find(t => regDe(t.id, c.farrowingId));
  const [tipoL, setTipoL] = useState(tipoGuardado?.id ?? lechones[0]?.id ?? "");
  const [kgH, setKgH] = useState(regH ? String(regH.kg) : "");
  const regL = tipoL ? regDe(tipoL, c.farrowingId) : undefined;
  const [kgL, setKgL] = useState(regL ? String(regL.kg) : "");
  const { pendiente, msg, guardar } = useGuardar(onGuardado);
  const tL = lechones.find(t => t.id === tipoL);
  useEffect(() => { setKgH(regH ? String(regH.kg) : ""); }, [regH]);
  useEffect(() => { setKgL(regL ? String(regL.kg) : ""); }, [regL]);

  return (
    <tr style={{ verticalAlign: "top" }}>
      <td><CaravanaFicha sowId={c.sowId} caravana={c.caravana} /><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.dias} días de lactancia</div></td>
      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.lechones}</td>
      <td>
        {hembra ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <input className="kp-input" inputMode="decimal" aria-label="kg de la hembra" placeholder={hembra.kgPorAnimal != null ? `teórico ${hembra.kgPorAnimal} kg` : "kg"} value={kgH} onChange={e => setKgH(e.target.value)} style={{ height: 30, width: 120 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hembra.nombre}</span>
            <Guardado r={regH} />
          </div>
        ) : <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Sin balanceado de lactación en el plan</span>}
      </td>
      <td>
        {lechones.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <select className="kp-input" aria-label="Balanceado de los lechones" value={tipoL} onChange={e => setTipoL(e.target.value)} style={{ height: 30, width: "auto" }}>
                {lechones.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <input className="kp-input" inputMode="decimal" aria-label="kg de los lechones" placeholder={tL?.kgPorAnimal != null ? `teórico ${kg(tL.kgPorAnimal * c.lechones)}` : "kg"} value={kgL} onChange={e => setKgL(e.target.value)} style={{ height: 30, width: 120 }} />
            </div>
            {tL?.kgPorAnimal != null && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Teórico: {c.lechones} × {tL.kgPorAnimal} kg = {kg(c.lechones * tL.kgPorAnimal)}</span>}
            <Guardado r={regL} />
          </div>
        ) : <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Sin balanceado de lechones en el plan</span>}
      </td>
      <td style={{ textAlign: "right" }}>
        <button type="button" className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente || (!hembra && !tL)}
          onClick={() => guardar([
            ...(hembra && (kgH !== "" || regH) ? [{ fecha, feedTypeId: hembra.id, farrowingId: c.farrowingId, kg: Number((kgH || "0").replace(",", ".")) || 0 }] : []),
            ...(tL && (kgL !== "" || regL) ? [{ fecha, feedTypeId: tL.id, farrowingId: c.farrowingId, kg: Number((kgL || "0").replace(",", ".")) || 0 }] : []),
          ])}>
          {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Guardar
        </button>
        {msg && <div role="status" style={{ fontSize: 11.5, color: "var(--warning-text)", maxWidth: 220, marginTop: 4 }}>{msg}</div>}
      </td>
    </tr>
  );
}

