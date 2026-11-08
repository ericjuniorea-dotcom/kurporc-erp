"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { crearPrestamo } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}><span className="kp-label">{label}</span>{children}</label>;
}

export function NuevoPrestamo({ cuentas, hoy }: { cuentas: { id: string; nombre: string }[]; hoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ acreedor: "", concepto: "", montoRecibidoGs: "", cuotaMensualGs: "", numeroCuotas: "", primerVencimiento: "", debitoAutomatico: false, cuentaDebitoId: "", registrarIngreso: true, fechaRecibido: hoy, cuotasYaPagadas: "0", observacion: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }));
  const total = Number(f.cuotaMensualGs || 0) * Number(f.numeroCuotas || 0);
  const solo = (v: string) => v.replace(/\D/g, "");

  if (!abierto) return (
    <div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <button type="button" className="btn btn-primary" onClick={() => { setMsg(null); setAbierto(true); }} style={{ height: 34 }}><IconPlus size={15} aria-hidden /> Cargar préstamo</button>
    </div>
  );
  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => {
      const r = await crearPrestamo({ ...f, numeroCuotas: Number(f.numeroCuotas), cuotasYaPagadas: Number(f.cuotasYaPagadas || 0), cuentaDebitoId: f.cuentaDebitoId || null });
      if (r.ok) { setAbierto(false); setMsg({ tipo: "ok", texto: "Préstamo cargado. Sus cuotas ya están en el calendario y en la proyección." }); router.refresh(); } else setMsg({ tipo: "error", texto: r.error });
    }); }} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Cargar préstamo</div>
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Acreedor (banco, cooperativa…)" ancho={200}><input className="kp-input" value={f.acreedor} onChange={e => set("acreedor", e.target.value)} required maxLength={120} /></Campo>
        <Campo label="Concepto" ancho={200}><input className="kp-input" value={f.concepto} onChange={e => set("concepto", e.target.value)} required maxLength={160} placeholder="Ej: Préstamo para la paridera" /></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Monto recibido (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={f.montoRecibidoGs} onChange={e => set("montoRecibidoGs", solo(e.target.value))} required /></Campo>
        <Campo label="Cuota mensual (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={f.cuotaMensualGs} onChange={e => set("cuotaMensualGs", solo(e.target.value))} required /></Campo>
        <Campo label="N° de cuotas" ancho={100}><input className="kp-input" inputMode="numeric" value={f.numeroCuotas} onChange={e => set("numeroCuotas", solo(e.target.value))} required /></Campo>
        <Campo label="Primer vencimiento" ancho={150}><input type="date" className="kp-input" value={f.primerVencimiento} onChange={e => set("primerVencimiento", e.target.value)} required /></Campo>
      </div>
      {total > 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total a pagar {gs(total)}{f.montoRecibidoGs ? ` · costo financiero ${gs(total - Number(f.montoRecibidoGs))}` : ""}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="¿Débito automático?" ancho={150}><select className="kp-input" value={f.debitoAutomatico ? "1" : "0"} onChange={e => set("debitoAutomatico", e.target.value === "1")}><option value="0">No</option><option value="1">Sí</option></select></Campo>
        <Campo label="Cuenta" ancho={170}><select className="kp-input" value={f.cuentaDebitoId} onChange={e => set("cuentaDebitoId", e.target.value)}><option value="">No aplica</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
        <Campo label="Cuotas ya pagadas" ancho={130}><input className="kp-input" inputMode="numeric" value={f.cuotasYaPagadas} onChange={e => set("cuotasYaPagadas", solo(e.target.value))} /></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Campo label="¿Cargar el ingreso del préstamo en el libro?" ancho={260}><select className="kp-input" value={f.registrarIngreso ? "1" : "0"} onChange={e => set("registrarIngreso", e.target.value === "1")}><option value="1">Sí (si todavía no lo cargaste)</option><option value="0">No, ya está cargado</option></select></Campo>
        {f.registrarIngreso && <Campo label="Fecha en que se recibió" ancho={150}><input type="date" className="kp-input" value={f.fechaRecibido} onChange={e => set("fechaRecibido", e.target.value)} /></Campo>}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => setAbierto(false)} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar préstamo</button>
      </div>
    </form>
  );
}
