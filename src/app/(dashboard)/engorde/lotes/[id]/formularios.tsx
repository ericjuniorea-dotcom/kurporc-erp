"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconChartLine, IconLoader2 } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";
import { Aviso } from "@/components/auth/marco-auth";
import { actualizarLote, registrarTratamientoLote } from "@/app/acciones/engorde";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}><span className="kp-label">{label}</span>{children}</label>;
}

export function EncabezadoEngorde() {
  return <Topbar title="Engorde" icon={IconChartLine} iconColor="var(--accent)" />;
}

type DatosLote = { modalidad: string; integrador: string; pagoIntegracion: string; tarifaIntegracionGs: string; alimentoLoProvee: string; sexo: string; genetica: string; costoIngresoGs: string; targetWeightKg: string; curvaId: string };

export function FormLote({ id, inicial, curvas }: { id: string; inicial: DatosLote; curvas: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof DatosLote, v: string) => setF(x => ({ ...x, [k]: v }));
  const solo = (v: string) => v.replace(/\D/g, "");
  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => { const r = await actualizarLote(id, f as never); setMsg(r.ok ? { tipo: "ok", texto: "Lote actualizado." } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); }}
      style={{ ...tarjeta, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Datos del lote</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Modalidad" ancho={140}><select className="kp-input" value={f.modalidad} onChange={e => set("modalidad", e.target.value)}><option value="PROPIO">Propio</option><option value="INTEGRADO">Integrado</option></select></Campo>
        {f.modalidad === "INTEGRADO" && <>
          <Campo label="Integrador" ancho={180}><input className="kp-input" value={f.integrador} onChange={e => set("integrador", e.target.value)} maxLength={120} /></Campo>
          <Campo label="Cómo paga" ancho={170}><select className="kp-input" value={f.pagoIntegracion} onChange={e => set("pagoIntegracion", e.target.value)}><option value="">Elegí…</option><option value="POR_KG_PRODUCIDO">Por kg producido</option><option value="POR_ANIMAL_DIA">Por animal-día</option><option value="POR_CABEZA">Por cabeza vendida</option></select></Campo>
          <Campo label="Tarifa (₲)" ancho={120}><input className="kp-input" inputMode="numeric" value={f.tarifaIntegracionGs} onChange={e => set("tarifaIntegracionGs", solo(e.target.value))} /></Campo>
        </>}
        <Campo label="El alimento lo pone" ancho={150}><select className="kp-input" value={f.alimentoLoProvee} onChange={e => set("alimentoLoProvee", e.target.value)}><option value="PROPIO">La granja</option><option value="INTEGRADOR">El integrador</option></select></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Sexo" ancho={150}><select className="kp-input" value={f.sexo} onChange={e => set("sexo", e.target.value)}><option value="">—</option><option value="MACHOS_CASTRADOS">Machos castrados</option><option value="HEMBRAS">Hembras</option><option value="MIXTO">Mixto</option></select></Campo>
        <Campo label="Genética" ancho={140}><input className="kp-input" value={f.genetica} onChange={e => set("genetica", e.target.value)} maxLength={80} /></Campo>
        <Campo label="Peso objetivo (kg)" ancho={120}><input className="kp-input" inputMode="decimal" value={f.targetWeightKg} onChange={e => set("targetWeightKg", e.target.value)} /></Campo>
        <Campo label="Curva de crecimiento" ancho={170}><select className="kp-input" value={f.curvaId} onChange={e => set("curvaId", e.target.value)}><option value="">La predeterminada</option>{curvas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
        <Campo label="Lo pagado por los animales (₲)" ancho={190}><input className="kp-input" inputMode="numeric" value={f.costoIngresoGs} onChange={e => set("costoIngresoGs", solo(e.target.value))} placeholder="vacío = precio de referencia" /></Campo>
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar</button></div>
    </form>
  );
}

export function FormTratamiento({ loteId, medicamentos, presentes }: { loteId: string; medicamentos: { id: string; name: string; withdrawalDays: number }[]; presentes: number }) {
  const router = useRouter();
  const hoy = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ medicineId: "", fecha: hoy, animales: String(presentes), mlAplicados: "", costoGs: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const med = medicamentos.find(m => m.id === f.medicineId);
  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => { const r = await registrarTratamientoLote(loteId, { ...f, animales: Number(f.animales) }); setMsg(r.ok ? { tipo: "ok", texto: "Tratamiento registrado." } : { tipo: "error", texto: r.error }); if (r.ok) { setF(x => ({ ...x, medicineId: "", mlAplicados: "", costoGs: "" })); router.refresh(); } }); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-default)" }}>
      <Campo label="Medicamento" ancho={180}><select className="kp-input" value={f.medicineId} onChange={e => setF(x => ({ ...x, medicineId: e.target.value }))} required><option value="">Elegí…</option>{medicamentos.map(m => <option key={m.id} value={m.id}>{m.name} ({m.withdrawalDays} días de carencia)</option>)}</select></Campo>
      <Campo label="Fecha" ancho={130}><input type="date" className="kp-input" value={f.fecha} onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} required /></Campo>
      <Campo label="Animales" ancho={90}><input className="kp-input" inputMode="numeric" value={f.animales} onChange={e => setF(x => ({ ...x, animales: e.target.value.replace(/\D/g, "") }))} required /></Campo>
      <Campo label="ml aplicados" ancho={100}><input className="kp-input" inputMode="decimal" value={f.mlAplicados} onChange={e => setF(x => ({ ...x, mlAplicados: e.target.value }))} /></Campo>
      <Campo label="Costo (₲)" ancho={110}><input className="kp-input" inputMode="numeric" value={f.costoGs} onChange={e => setF(x => ({ ...x, costoGs: e.target.value.replace(/\D/g, "") }))} /></Campo>
      <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ height: 34 }}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Registrar</button>
      {med && med.withdrawalDays > 0 && <div style={{ width: "100%", fontSize: 11.5, color: "var(--warning-text)" }}>Con {med.name}, el lote no se puede vender por {med.withdrawalDays} días desde la fecha del tratamiento.</div>}
      {msg && <div style={{ width: "100%" }}><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
    </form>
  );
}
