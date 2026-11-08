"use client";
// Evaluación de nueva inversión (8.18): pensar una compra ANTES de hacerla.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { cambiarEstadoEvaluacion, crearEvaluacion } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";
import { cuotaFrancesa } from "@/lib/finanzas/planificacion";

type Ev = { id: string; fecha: string; concepto: string; categoria: string; montoGs: string; formaPago: string; financiamientoGs: string; plazo: number; tasa: number | null; cuota: number; contado: number; margen: number; margenPlanilla: number; estado: string };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const ESTADO: Record<string, string> = { EN_EVALUACION: "En evaluación", APROBADA: "Aprobada (en el presupuesto)", DESCARTADA: "Descartada", EJECUTADA: "Ejecutada (en el libro)" };
function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}><span className="kp-label">{label}</span>{children}</label>;
}

export function PanelEvaluaciones(p: { evaluaciones: Ev[]; categorias: { id: string; nombre: string }[]; flujoPromedio: string; cuotaActual: string; hoy: string; puedo: { evaluar: boolean; ejecutar: boolean } }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(p.evaluaciones.length === 0);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = (id: string, estado: "APROBADA" | "DESCARTADA" | "EJECUTADA", ok: string) => { setMsg(null); iniciar(async () => { const r = await cambiarEstadoEvaluacion(id, estado); setMsg(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); };

  return (
    <>
      <div style={{ ...tarjeta, padding: 12, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Flujo operativo mensual promedio proyectado (sin aportes de capital y antes de cuotas): <strong>{gs(p.flujoPromedio)}</strong> · cuotas de préstamos actuales: <strong>{gs(p.cuotaActual)}</strong> por mes.
        Una inversión «entra en la caja» si después de pagar las cuotas actuales y la nueva queda plata.
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {p.puedo.evaluar && (abierto
        ? <Formulario {...p} onCerrar={() => setAbierto(false)} onListo={t => { setAbierto(false); setMsg({ tipo: "ok", texto: t }); router.refresh(); }} />
        : <div><button type="button" className="btn btn-primary" onClick={() => setAbierto(true)} style={{ height: 34 }}><IconPlus size={15} aria-hidden /> Evaluar una compra</button></div>)}
      {p.evaluaciones.map(e => (
        <div key={e.id} style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 8, opacity: e.estado === "DESCARTADA" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{e.concepto}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{e.categoria} · prevista para {e.fecha.split("-").reverse().join("/")} · {ESTADO[e.estado]}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{gs(e.montoGs)}</div>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5 }}>
            <span>Forma de pago: <strong>{e.formaPago === "CONTADO" ? "Contado" : e.formaPago === "FINANCIADO" ? "Financiado" : "Mixto"}</strong></span>
            {e.formaPago !== "CONTADO" && <span>Financiado {gs(e.financiamientoGs)} en {e.plazo} meses{e.tasa !== null ? ` al ${(e.tasa * 100).toLocaleString("es-PY")} % anual` : " (sin tasa: cuota simple)"}</span>}
            <span>Cuota nueva: <strong>{gs(e.cuota)}</strong></span>
            {e.contado > 0 && <span>Pago de contado: <strong>{gs(e.contado)}</strong></span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: e.margen >= 0 ? "var(--success-text)" : "var(--danger-text)" }}>
            {e.margen >= 0 ? `✓ Entra en la caja: margen de seguridad ${gs(e.margen)} por mes.` : `✗ La inversión no entra en la caja: faltan ${gs(-e.margen)} por mes.`}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Con el cálculo de la planilla (que restaba dos veces las cuotas actuales) daría {gs(e.margenPlanilla)}.</div>
          {e.estado === "EN_EVALUACION" || e.estado === "APROBADA" ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.puedo.evaluar && e.estado === "EN_EVALUACION" && <button type="button" className="btn" disabled={pendiente} onClick={() => cambiar(e.id, "APROBADA", "Aprobada: quedó en el presupuesto del mes previsto.")}>Aprobar</button>}
              {p.puedo.ejecutar && <button type="button" className="btn" disabled={pendiente} onClick={() => cambiar(e.id, "EJECUTADA", "Ejecutada: quedó en el libro como inversión pendiente de pago.")}>Ejecutar</button>}
              {p.puedo.evaluar && <button type="button" className="btn" disabled={pendiente} onClick={() => cambiar(e.id, "DESCARTADA", "Descartada.")}>Descartar</button>}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}

function Formulario(p: Parameters<typeof PanelEvaluaciones>[0] & { onCerrar: () => void; onListo: (t: string) => void }) {
  const [f, setF] = useState({ fechaPrevista: p.hoy, concepto: "", categoriaId: "", cantidad: "1", montoTotalGs: "", formaPago: "CONTADO", financiamientoGs: "", plazoMeses: "", tasaAnual: "" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));
  const fin = f.formaPago === "CONTADO" ? 0 : Number(f.financiamientoGs || 0);
  const cuota = Math.round(cuotaFrancesa(fin, Number(f.plazoMeses || 0), f.tasaAnual ? Number(f.tasaAnual.replace(",", ".")) / 100 : null));
  const margen = Number(p.flujoPromedio) - Number(p.cuotaActual) - cuota;
  return (
    <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => {
      const r = await crearEvaluacion({ ...f, formaPago: f.formaPago as "CONTADO", plazoMeses: Number(f.plazoMeses || 0), financiamientoGs: f.formaPago === "CONTADO" ? "0" : f.financiamientoGs || "0" });
      if (r.ok) p.onListo("Evaluación guardada."); else setError(r.error);
    }); }} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Evaluar una compra</div>
        <button type="button" onClick={p.onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Fecha prevista" ancho={140}><input type="date" className="kp-input" value={f.fechaPrevista} onChange={e => set("fechaPrevista", e.target.value)} required /></Campo>
        <Campo label="Concepto" ancho={220}><input className="kp-input" value={f.concepto} onChange={e => set("concepto", e.target.value)} required maxLength={160} placeholder="Ej: 10 jaulas de maternidad" /></Campo>
        <Campo label="Categoría" ancho={170}><select className="kp-input" value={f.categoriaId} onChange={e => set("categoriaId", e.target.value)} required><option value="">Elegí…</option>{p.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Cantidad" ancho={90}><input className="kp-input" inputMode="decimal" value={f.cantidad} onChange={e => set("cantidad", e.target.value)} required /></Campo>
        <Campo label="Monto total (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={f.montoTotalGs} onChange={e => set("montoTotalGs", e.target.value.replace(/\D/g, ""))} required /></Campo>
        <Campo label="Forma de pago" ancho={140}><select className="kp-input" value={f.formaPago} onChange={e => set("formaPago", e.target.value)}><option value="CONTADO">Contado</option><option value="FINANCIADO">Financiado</option><option value="MIXTO">Mixto</option></select></Campo>
        {f.formaPago !== "CONTADO" && <>
          <Campo label="Financiado (₲)" ancho={140}><input className="kp-input" inputMode="numeric" value={f.financiamientoGs} onChange={e => set("financiamientoGs", e.target.value.replace(/\D/g, ""))} /></Campo>
          <Campo label="Plazo (meses)" ancho={100}><input className="kp-input" inputMode="numeric" value={f.plazoMeses} onChange={e => set("plazoMeses", e.target.value.replace(/\D/g, ""))} /></Campo>
          <Campo label="Tasa anual % (opcional)" ancho={130}><input className="kp-input" inputMode="decimal" value={f.tasaAnual} onChange={e => set("tasaAnual", e.target.value)} /></Campo>
        </>}
      </div>
      {f.montoTotalGs && (
        <div style={{ fontSize: 12.5, color: margen >= 0 ? "var(--success-text)" : "var(--danger-text)" }}>
          Cuota nueva {gs(cuota)} · {margen >= 0 ? `entra en la caja con ${gs(margen)} de margen por mes` : `no entra en la caja: faltan ${gs(-margen)} por mes`}
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={p.onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar evaluación</button>
      </div>
    </form>
  );
}
