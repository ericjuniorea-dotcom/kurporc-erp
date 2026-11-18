"use client";
// Sanidad y Nutrición · plan de alimentación: en cada módulo, qué balanceado se come y cuántos kg por animal por día
// (vacío = a gusto). Se pueden agregar balanceados nuevos a cualquier módulo.
import { useCallback, useEffect, useState, useTransition } from "react";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { cargarPlanSugerido, guardarTipoBalanceado, planAlimentacion, quitarTipoBalanceado } from "@/app/acciones/nutricion";
import { MODULOS_NUTRICION, ORDEN_MODULOS, type ModuloNutricion } from "@/lib/nutricion/plan";

type Plan = Awaited<ReturnType<typeof planAlimentacion>>;
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function PlanAlimentacion({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cargar = useCallback(() => { planAlimentacion().then(setPlan).catch(() => setMsg("No se pudo cargar. Recargá la página.")); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const correr = (fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) => {
    setMsg(null);
    iniciar(async () => {
      const r: { ok: boolean; error?: string; aviso?: string } = await fn().catch(() => ({ ok: false, error: "No se pudo. Recargá la página." }));
      if (!r.ok) setMsg(r.error ?? "No se pudo."); else { if (r.aviso) setMsg(r.aviso); cargar(); }
    });
  };
  if (!plan) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg ?? "Cargando…"}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", flex: "1 1 360px", lineHeight: 1.5 }}>
          Elegí qué balanceado se come en cada módulo y cuántos kg por animal por día. Con eso KurPorc calcula el consumo teórico;
          el operador carga lo real y se descuenta del inventario. Dejá los kg vacíos si se come a gusto.
        </p>
        {puedeConfigurar && (
          <button type="button" className="btn" disabled={pendiente} onClick={() => correr(cargarPlanSugerido)} style={{ height: 32, fontSize: 12 }}>
            {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Cargar plan sugerido
          </button>
        )}
      </div>
      {msg && <div role="status" style={{ fontSize: 12.5, color: "var(--warning-text)" }}>{msg}</div>}
      {ORDEN_MODULOS.map(m => <Modulo key={m} modulo={m} plan={plan} puedeConfigurar={puedeConfigurar} correr={correr} pendiente={pendiente} />)}
    </div>
  );
}

function Modulo({ modulo, plan, puedeConfigurar, correr, pendiente }: {
  modulo: ModuloNutricion; plan: Plan; puedeConfigurar: boolean; pendiente: boolean;
  correr: (fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) => void;
}) {
  const info = MODULOS_NUTRICION[modulo];
  const tipos = plan.tipos.filter(t => t.modulo === modulo);
  const [nuevoProd, setNuevoProd] = useState("");
  const [nuevoKg, setNuevoKg] = useState("");
  const unidad = info.por === "TOTAL" ? "kg por animal por día (vacío = a gusto)" : info.por === "LECHON" ? "kg por lechón en toda la fase (meta)" : `kg por ${info.animal} por día`;
  return (
    <section style={{ ...tarjeta, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }} aria-label={info.etiqueta}>
      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{info.etiqueta}</h3>
      {tipos.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin balanceado elegido.</span>}
      {tipos.map(t => <FilaTipo key={t.id} t={t} modulo={modulo} plan={plan} unidad={unidad} puedeConfigurar={puedeConfigurar} correr={correr} pendiente={pendiente} />)}
      {puedeConfigurar && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 4, borderTop: "0.5px dashed var(--border-default)" }}>
          <select className="kp-input" aria-label={`Agregar balanceado a ${info.etiqueta}`} value={nuevoProd} onChange={e => setNuevoProd(e.target.value)} style={{ height: 30, width: "auto", minWidth: 200 }}>
            <option value="">Agregar balanceado…</option>
            {plan.productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input className="kp-input" inputMode="decimal" aria-label="kg por animal por día" placeholder={info.por === "TOTAL" ? "a gusto" : info.por === "LECHON" ? "kg/fase" : "kg/día"} value={nuevoKg} onChange={e => setNuevoKg(e.target.value)} style={{ height: 30, width: 100 }} />
          <button type="button" className="btn" style={{ height: 30, fontSize: 12, gap: 4 }} disabled={pendiente || !nuevoProd}
            onClick={() => { correr(() => guardarTipoBalanceado({ modulo, productoId: nuevoProd, kgPorAnimal: nuevoKg ? Number(nuevoKg.replace(",", ".")) : null })); setNuevoProd(""); setNuevoKg(""); }}>
            <IconPlus size={13} aria-hidden /> Agregar
          </button>
          {plan.productos.length === 0 && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>No hay balanceados en el inventario: creálos en Inventario → Nuevo producto o tocá «Cargar plan sugerido».</span>}
        </div>
      )}
    </section>
  );
}

function FilaTipo({ t, modulo, plan, unidad, puedeConfigurar, correr, pendiente }: {
  t: Plan["tipos"][number]; modulo: ModuloNutricion; plan: Plan; unidad: string; puedeConfigurar: boolean; pendiente: boolean;
  correr: (fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) => void;
}) {
  const [kgTxt, setKgTxt] = useState(t.kgPorAnimal != null ? String(t.kgPorAnimal) : "");
  const [prod, setProd] = useState(t.productoId ?? "");
  const cambio = kgTxt !== (t.kgPorAnimal != null ? String(t.kgPorAnimal) : "") || prod !== (t.productoId ?? "");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select className="kp-input" aria-label="Balanceado" value={prod} disabled={!puedeConfigurar} onChange={e => setProd(e.target.value)} style={{ height: 30, width: "auto", minWidth: 200 }}>
        {!t.productoId && <option value="">{t.nombre} (sin producto)</option>}
        {plan.productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <input className="kp-input" inputMode="decimal" aria-label={unidad} value={kgTxt} disabled={!puedeConfigurar} onChange={e => setKgTxt(e.target.value)} placeholder="a gusto" style={{ height: 30, width: 100 }} />
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{unidad}</span>
      {puedeConfigurar && cambio && prod && (
        <button type="button" className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={pendiente}
          onClick={() => correr(() => guardarTipoBalanceado({ id: t.id, modulo, productoId: prod, kgPorAnimal: kgTxt ? Number(kgTxt.replace(",", ".")) : null }))}>Guardar</button>
      )}
      {puedeConfigurar && (
        <button type="button" aria-label={`Quitar ${t.nombre}`} title="Quitar de este módulo" disabled={pendiente} onClick={() => { if (window.confirm(`¿Quitar «${t.nombre}» de este módulo?`)) correr(() => quitarTipoBalanceado(t.id)); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex" }}><IconTrash size={14} /></button>
      )}
    </div>
  );
}
