"use client";
// Cierre de mes · Reparto de gastos compartidos (costeo por etapa, Fase 5). Vista previa por gasto, reglas editables
// (criterio por concepto, kW por etapa) y botón Repartir. El cierre no se puede hacer con compartidos sin repartir.
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconArrowsSplit, IconLoader2, IconSettings } from "@tabler/icons-react";
import { InputNumero } from "@/components/ui/input-numero";
import { guardarReglaReparto, repartirMes } from "@/app/acciones/costeo-reparto";

type Criterio = "PERSONAL" | "POTENCIA" | "ANIMALES" | "PORCENTAJE" | "ETAPA";
type Regla = { subcategoriaCodigo: string; criterio: Criterio; valores: Record<string, number>; etapaCodigo: string | null };
type Linea = { movimientoId: string; fecha: string; concepto: string; subcategoria: string; montoGs: string; criterio: Criterio; partes: { etapa: string; porcentaje: number; montoGs: string }[]; error: string | null };
type Datos = { mes: number; animales: Record<string, number>; personal: Record<string, number>; reglas: Regla[]; criterios: Record<Criterio, { nombre: string; como: string }>;
  etapas: { codigo: string; nombre: string; tipo: string }[]; repartidos: number; lineas: Linea[]; subcategorias: { codigo: string; nombre: string }[]; puedeRepartir: boolean };

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const gs = (v: string | number) => `₲ ${Math.round(Number(v)).toLocaleString("es-PY")}`;
const nro = (s: string) => Number((s || "").replace(/\./g, "").replace(",", "."));

export function RepartoCompartidos({ mes, cerrado }: { mes: number; cerrado: boolean }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const cargar = useCallback(() => {
    fetch(`/api/finanzas/reparto?mes=${mes}`, { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setMsg({ ok: false, t: e instanceof Error ? e.message : "No se pudo cargar." }));
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!datos) return <div style={{ ...tarjeta, padding: 14, fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center" }}>{msg ? msg.t : <><IconLoader2 size={14} className="animate-spin" /> Cargando reparto…</>}</div>;

  const nombre = (c: string) => datos.etapas.find(e => e.codigo === c)?.nombre ?? c;
  const total = datos.lineas.reduce((s, l) => s + Number(l.montoGs), 0);
  const porEtapa = new Map<string, number>();
  for (const l of datos.lineas) for (const p of l.partes) porEtapa.set(p.etapa, (porEtapa.get(p.etapa) ?? 0) + Number(p.montoGs));
  const errores = [...new Set(datos.lineas.filter(l => l.error).map(l => l.error!))];
  const todoRepartido = datos.lineas.length > 0 && datos.repartidos === datos.lineas.length;

  return (
    <section style={{ ...tarjeta, overflow: "hidden" }} aria-label="Reparto de gastos compartidos">
      <div style={{ padding: "12px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Reparto de gastos compartidos</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sueldos de producción, luz, agua y combustible se reparten entre las etapas antes de cerrar.</div>
        </div>
        {datos.puedeRepartir && <button type="button" className="btn" onClick={() => setEditando(v => !v)}><IconSettings size={14} aria-hidden /> Reglas</button>}
      </div>
      {msg && <div role="status" style={{ margin: "10px 14px 0", fontSize: 13, padding: "8px 12px", borderRadius: "var(--radius-md)", background: msg.ok ? "var(--success-subtle)" : "var(--danger-subtle)", color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</div>}

      {editando && <EditorReglas datos={datos} onGuardado={t => { setMsg({ ok: true, t }); cargar(); }} onError={t => setMsg({ ok: false, t })} />}

      {datos.lineas.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Este mes no tiene gastos compartidos.</div> : (
        <>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{datos.lineas.length.toLocaleString("es-PY")} gastos · {gs(total)} · {todoRepartido ? <strong style={{ color: "var(--success-text)", fontWeight: 500 }}>repartido ✓</strong> : <strong style={{ color: "var(--warning-text)", fontWeight: 500 }}>sin repartir</strong>}</div>
            {[...porEtapa.entries()].sort((a, b) => b[1] - a[1]).map(([e, v]) => (
              <div key={e} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{nombre(e)}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{gs(v)} <span style={{ color: "var(--text-muted)" }}>· {total ? Math.round((v / total) * 100) : 0} %</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: "var(--bg-overlay)", overflow: "hidden" }}><div style={{ width: `${total ? (v / total) * 100 : 0}%`, height: "100%", background: "var(--accent)" }} /></div>
              </div>
            ))}
          </div>
          {errores.length > 0 && (
            <div className="kp-alert kp-alert-warning" style={{ margin: "0 14px 10px", fontSize: 12.5, display: "flex", gap: 8 }}>
              <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden /><span>{errores.join(" ")} Tocá <strong>Reglas</strong> para completarlo.</span>
            </div>
          )}
          <details style={{ borderTop: "0.5px solid var(--border-default)" }}>
            <summary style={{ padding: "10px 14px", fontSize: 12.5, cursor: "pointer", color: "var(--text-secondary)" }}>Ver cada gasto</summary>
            {datos.lineas.map(l => (
              <div key={l.movimientoId} style={{ padding: "8px 14px", borderTop: "0.5px solid var(--border-default)", fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{l.concepto}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{gs(l.montoGs)}</span></div>
                <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{l.subcategoria} · {datos.criterios[l.criterio].nombre}</div>
                <div style={{ color: l.error ? "var(--danger-text)" : "var(--text-secondary)", fontSize: 11.5 }}>
                  {l.error ?? l.partes.map(p => `${nombre(p.etapa)} ${p.porcentaje.toLocaleString("es-PY", { maximumFractionDigits: 1 })} % (${gs(p.montoGs)})`).join(" · ")}
                </div>
              </div>
            ))}
          </details>
          <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--border-default)", fontSize: 11.5, color: "var(--text-muted)" }}>
            Animales presentes a fin de mes: {Object.entries(datos.animales).filter(([, v]) => v > 0).map(([e, v]) => `${nombre(e)} ${v.toLocaleString("es-PY")}`).join(" · ") || "—"}.
            {" "}Personal: {Object.entries(datos.personal).map(([e, v]) => `${nombre(e)} ${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })}`).join(" · ") || "—"}.
          </div>
          {datos.puedeRepartir && !cerrado && (
            <div style={{ padding: "0 14px 14px" }}>
              <button type="button" className="btn btn-primary" disabled={pendiente || errores.length > 0} onClick={() => { setMsg(null); iniciar(async () => {
                const r = await repartirMes(mes);
                if (!r.ok) { setMsg({ ok: false, t: r.error }); return; }
                setMsg({ ok: true, t: `Listo: ${r.movimientos.toLocaleString("es-PY")} gastos repartidos entre las etapas.` }); cargar(); router.refresh();
              }); }}>
                {pendiente ? <IconLoader2 size={14} className="animate-spin" aria-hidden /> : <IconArrowsSplit size={14} aria-hidden />} {todoRepartido ? "Volver a repartir" : "Repartir"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EditorReglas({ datos, onGuardado, onError }: { datos: Datos; onGuardado: (t: string) => void; onError: (t: string) => void }) {
  const [pendiente, iniciar] = useTransition();
  const productivas = datos.etapas.filter(e => e.tipo === "PRODUCTIVA");
  const nombreSub = (c: string) => c === "*" ? "Resto de los gastos compartidos" : `${c} · ${datos.subcategorias.find(s => s.codigo === c)?.nombre ?? ""}`;
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-base)", borderBottom: "0.5px solid var(--border-default)" }}>
      {datos.reglas.map(r => <FilaRegla key={r.subcategoriaCodigo} r={r} titulo={nombreSub(r.subcategoriaCodigo)} datos={datos} productivas={productivas} pendiente={pendiente}
        guardar={(nueva) => iniciar(async () => { const x = await guardarReglaReparto(nueva); if (x.ok) onGuardado("Regla guardada."); else onError(x.error); })} />)}
    </div>
  );
}

function FilaRegla({ r, titulo, datos, productivas, pendiente, guardar }: { r: Regla; titulo: string; datos: Datos; productivas: { codigo: string; nombre: string }[]; pendiente: boolean; guardar: (r: Regla) => void }) {
  const [criterio, setCriterio] = useState<Criterio>(r.criterio);
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(Object.entries(r.valores).map(([k, v]) => [k, String(v)])));
  const [etapa, setEtapa] = useState(r.etapaCodigo ?? "");
  const conValores = criterio === "POTENCIA" || criterio === "PORCENTAJE";
  const suma = productivas.reduce((s, e) => s + (nro(valores[e.codigo] ?? "") || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: "0.5px dashed var(--border-default)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="kp-input" value={criterio} onChange={e => setCriterio(e.target.value as Criterio)} style={{ flex: "1 1 200px" }} aria-label={`Criterio de ${titulo}`}>
          {(Object.keys(datos.criterios) as Criterio[]).map(c => <option key={c} value={c}>{datos.criterios[c].nombre}</option>)}
        </select>
        {criterio === "ETAPA" && (
          <select className="kp-input" value={etapa} onChange={e => setEtapa(e.target.value)} style={{ flex: "1 1 160px" }} aria-label="Etapa">
            <option value="">Elegí…</option>{datos.etapas.map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
          </select>
        )}
      </div>
      {conValores && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {productivas.map(e => (
            <label key={e.codigo} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, color: "var(--text-secondary)", flex: "1 1 110px" }}>
              {e.nombre} ({criterio === "POTENCIA" ? "kW" : "%"})
              <InputNumero className="kp-input" inputMode="decimal" value={valores[e.codigo] ?? ""} onChange={ev => setValores(v => ({ ...v, [e.codigo]: ev.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {datos.criterios[criterio].como}{criterio === "PORCENTAJE" ? ` Suma: ${suma.toLocaleString("es-PY")} %.` : criterio === "POTENCIA" ? ` Total: ${suma.toLocaleString("es-PY")} kW.` : ""}
      </div>
      <button type="button" className="btn" style={{ alignSelf: "flex-start" }} disabled={pendiente || (criterio === "ETAPA" && !etapa) || (criterio === "PORCENTAJE" && Math.round(suma * 100) !== 10_000)}
        onClick={() => guardar({ subcategoriaCodigo: r.subcategoriaCodigo, criterio, etapaCodigo: criterio === "ETAPA" ? etapa : null,
          valores: conValores ? Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, nro(v)]).filter(([, v]) => Number(v) > 0)) : {} })}>
        Guardar regla
      </button>
    </div>
  );
}
