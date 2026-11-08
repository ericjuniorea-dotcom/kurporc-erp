"use client";
// Presupuesto (8.13): grilla categoría × mes con herramientas de la planilla.
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { guardarPresupuesto, herramientaPresupuesto } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";

type Cat = { id: string; nombre: string; tipo: string };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const num = (v: string) => BigInt(v.replace(/\D/g, "") || "0");

export function GrillaPresupuesto({ anio, mesCorte, editable, categorias, valores }: {
  anio: number; mesCorte: number; editable: boolean; categorias: Cat[]; valores: Record<string, string[]>;
}) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string[]>>(() => Object.fromEntries(categorias.map(c => [c.id, valores[c.id] ?? Array(12).fill("")])));
  const [sucias, setSucias] = useState<Set<string>>(new Set());
  const [soloConValores, setSoloConValores] = useState(Object.keys(valores).length > 0);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const set = (cat: string, i: number, texto: string) => {
    setV(x => ({ ...x, [cat]: x[cat].map((y, j) => (j === i ? texto.replace(/\D/g, "") : y)) }));
    setSucias(s => new Set(s).add(`${cat}:${i}`));
  };
  const igualTodos = (cat: string) => {
    const primero = v[cat].find(x => x) ?? "";
    setV(x => ({ ...x, [cat]: Array(12).fill(primero) }));
    setSucias(s => { const n = new Set(s); for (let i = 0; i < 12; i++) n.add(`${cat}:${i}`); return n; });
  };
  const totMes = (tipo: string) => Array.from({ length: 12 }, (_, i) => categorias.filter(c => c.tipo === tipo).reduce((s, c) => s + num(v[c.id][i]), 0n));
  const opMes = useMemo(() => totMes("GASTO"), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const invMes = useMemo(() => totMes("INVERSION"), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const corte = Math.floor(mesCorte / 100) === anio ? (mesCorte % 100) - 1 : Math.floor(mesCorte / 100) > anio ? 11 : -1;
  const acumulado = (cat: string) => v[cat].slice(0, corte + 1).reduce((s, x) => s + num(x), 0n);
  const visibles = categorias.filter(c => !soloConValores || v[c.id].some(x => x));

  function guardar() {
    const cambios = Array.from(sucias).map(k => { const [cat, i] = k.split(":"); return { categoriaId: cat, mes: anio * 100 + Number(i) + 1, montoGs: v[cat][Number(i)] || "0" }; });
    if (!cambios.length) return;
    setMsg(null);
    iniciar(async () => {
      const r = await guardarPresupuesto(cambios);
      if (r.ok) { setSucias(new Set()); setMsg({ tipo: "ok", texto: `Presupuesto guardado (${cambios.length} celdas).` }); router.refresh(); }
      else setMsg({ tipo: "error", texto: r.error });
    });
  }
  function herramienta(accion: "copiar_anio_anterior" | "promedio_real" | "cargas_sociales") {
    if (sucias.size && !confirm("Tenés cambios sin guardar que se van a perder. ¿Seguir?")) return;
    setMsg(null);
    iniciar(async () => {
      const r = await herramientaPresupuesto({ accion, anio });
      if (r.ok) { setMsg({ tipo: "ok", texto: `Listo: ${r.cambios} celdas actualizadas.` }); window.location.reload(); }
      else setMsg({ tipo: "error", texto: r.error });
    });
  }

  return (
    <>
      {editable && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn" disabled={pendiente} onClick={() => herramienta("copiar_anio_anterior")}>Copiar {anio - 1}</button>
          <button type="button" className="btn" disabled={pendiente} onClick={() => herramienta("promedio_real")} title="Para cada categoría con gastos, el promedio real de los últimos 6 meses en todos los meses">Usar el promedio real de 6 meses</button>
          <button type="button" className="btn" disabled={pendiente} onClick={() => herramienta("cargas_sociales")} title="Aguinaldo (1/12 de los sueldos) + IPS patronal sobre los sueldos presupuestados">Calcular cargas sociales</button>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <input type="checkbox" checked={soloConValores} onChange={e => setSoloConValores(e.target.checked)} /> Solo categorías con valores
          </label>
          <button type="button" className="btn btn-primary" disabled={pendiente || sucias.size === 0} onClick={guardar}>
            {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar{sucias.size ? ` (${sucias.size})` : ""}
          </button>
        </div>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1500 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "var(--bg-surface)", minWidth: 200 }}>Categoría</th>
              {MESES.map((m, i) => <th key={m} style={{ textAlign: "right", color: i === corte ? "var(--accent-text)" : undefined }}>{m}</th>)}
              <th style={{ textAlign: "right" }}>Año</th><th style={{ textAlign: "right" }}>Acumulado al corte</th>{editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(["GASTO", "INVERSION"] as const).map(tipo => (
              <Fragment key={tipo}>
                <tr key={`t-${tipo}`}><td colSpan={16} style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", paddingTop: 12 }}>{tipo === "GASTO" ? "Gasto operativo" : "Inversión"}</td></tr>
                {visibles.filter(c => c.tipo === tipo).map(c => (
                  <tr key={c.id}>
                    <td style={{ position: "sticky", left: 0, background: "var(--bg-surface)", color: "var(--text-primary)" }}>{c.nombre}</td>
                    {v[c.id].map((x, i) => (
                      <td key={i} style={{ padding: 2 }}>
                        <input value={x ? Number(x).toLocaleString("es-PY") : ""} onChange={e => set(c.id, i, e.target.value)} disabled={!editable} inputMode="numeric" aria-label={`${c.nombre} ${MESES[i]}`}
                          style={{ width: 92, textAlign: "right", fontSize: 11.5, padding: "4px 6px", border: `0.5px solid ${sucias.has(`${c.id}:${i}`) ? "var(--accent)" : "var(--border-default)"}`, borderRadius: 4, background: "var(--bg-base)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }} />
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(v[c.id].reduce((s, y) => s + num(y), 0n))}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{gs(acumulado(c.id))}</td>
                    {editable && <td><button type="button" className="btn" style={{ height: 24, fontSize: 10.5 }} onClick={() => igualTodos(c.id)} title="Copia el primer valor cargado a los 12 meses">= todos</button></td>}
                  </tr>
                ))}
                <tr key={`s-${tipo}`} style={{ background: "var(--bg-elevated)" }}>
                  <td style={{ position: "sticky", left: 0, background: "var(--bg-elevated)", fontWeight: 600 }}>Subtotal {tipo === "GASTO" ? "gasto operativo" : "inversión"}</td>
                  {(tipo === "GASTO" ? opMes : invMes).map((x, i) => <td key={i} style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{gs(x)}</td>)}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{gs((tipo === "GASTO" ? opMes : invMes).reduce((s, y) => s + y, 0n))}</td><td></td>{editable && <td></td>}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Los subtotales de gasto operativo y de inversión los usa la Proyección de caja. Destildá «Solo categorías con valores» para presupuestar una categoría nueva.
      </div>
    </>
  );
}
