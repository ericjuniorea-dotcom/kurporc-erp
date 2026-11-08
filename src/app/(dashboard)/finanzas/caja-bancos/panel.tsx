"use client";
// Caja y bancos (8.4): saldo calculado de cada cuenta, saldo declarado y diferencia a conciliar.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { cambiarEstadoCuenta, crearCuenta, declararSaldo } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";

type Cuenta = {
  id: string; nombre: string; tipo: string; activa: boolean; numero: string; saldoGs: string; montoAsignadoGs: string | null;
  saldoInicialGs: string; fechaSaldoInicial: string | null;
  declarado: { fecha: string; saldoGs: string; diferenciaGs: string } | null;
};
const TIPO: Record<string, string> = { CAJA: "Caja", CAJA_CHICA: "Caja chica", BANCO: "Banco", COOPERATIVA: "Cooperativa", OTRA: "Otra" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function PanelCuentas({ cuentas, sinAsignarGs, hoy, puedo }: {
  cuentas: Cuenta[]; sinAsignarGs: string; hoy: string; puedo: { editar: boolean; declarar: boolean };
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState(false);
  const [declarar, setDeclarar] = useState<Cuenta | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const activas = cuentas.filter(c => c.activa);
  const total = (f: (c: Cuenta) => boolean) => activas.filter(f).reduce((s, c) => s + BigInt(c.saldoGs), 0n);
  const bancos = total(c => c.tipo === "BANCO" || c.tipo === "COOPERATIVA");
  const caja = total(c => c.tipo === "CAJA" || c.tipo === "CAJA_CHICA" || c.tipo === "OTRA");
  const listo = (t: string) => { setMsg({ tipo: "ok", texto: t }); router.refresh(); };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {([["Caja + bancos", bancos + caja + BigInt(sinAsignarGs)], ["En bancos y cooperativas", bancos], ["En caja", caja], ["Pagos sin cuenta asignada", BigInt(sinAsignarGs)]] as const).map(([t, v]) => (
          <div key={t} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: v < 0n ? "var(--danger-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gs(v)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>El saldo se calcula solo: saldo inicial + cobros − pagos registrados en cada cuenta.</span>
        {puedo.editar && !nueva && <button type="button" className="btn" onClick={() => { setMsg(null); setNueva(true); }}><IconPlus size={14} aria-hidden /> Nueva cuenta</button>}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {nueva && <NuevaCuenta onCerrar={() => setNueva(false)} onListo={t => { setNueva(false); listo(t); }} />}
      {declarar && <DeclararSaldo cuenta={declarar} hoy={hoy} onCerrar={() => setDeclarar(null)} onListo={t => { setDeclarar(null); listo(t); }} />}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Cuenta</th><th>Tipo</th><th style={{ textAlign: "right" }}>Saldo calculado</th><th>Último saldo declarado</th><th style={{ textAlign: "right" }}>Diferencia</th><th></th></tr></thead>
          <tbody>
            {cuentas.map(c => {
              const dif = c.declarado ? BigInt(c.declarado.diferenciaGs) : null;
              return (
                <tr key={c.id} style={{ opacity: c.activa ? 1 : 0.5 }}>
                  <td>
                    <div style={{ color: "var(--text-primary)" }}>{c.nombre}{!c.activa && " (archivada)"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {c.numero && `N° ${c.numero} · `}Saldo inicial {gs(c.saldoInicialGs)}{c.fechaSaldoInicial ? ` al ${fecha(c.fechaSaldoInicial)}` : ""}
                      {c.montoAsignadoGs ? ` · asignado ${gs(c.montoAsignadoGs)}` : ""}
                    </div>
                  </td>
                  <td>{TIPO[c.tipo]}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: BigInt(c.saldoGs) < 0n ? "var(--danger-text)" : "var(--text-primary)" }}>{gs(c.saldoGs)}</td>
                  <td>{c.declarado ? `${gs(c.declarado.saldoGs)} al ${fecha(c.declarado.fecha)}` : <span style={{ color: "var(--text-muted)" }}>Sin declarar</span>}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: dif === null ? "var(--text-muted)" : dif === 0n ? "var(--success-text)" : "var(--danger-text)" }}>
                    {dif === null ? "—" : dif === 0n ? "Concilia" : gs(dif)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {puedo.declarar && c.activa && <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} onClick={() => { setMsg(null); setDeclarar(c); }}>Declarar saldo</button>}
                    {puedo.editar && (
                      <button type="button" className="btn" style={{ height: 26, fontSize: 11, marginLeft: 4 }} disabled={pendiente}
                        onClick={() => iniciar(async () => { const r = await cambiarEstadoCuenta(c.id, !c.activa); if (r.ok) listo(c.activa ? "Cuenta archivada." : "Cuenta reactivada."); else setMsg({ tipo: "error", texto: r.error }); })}>
                        {c.activa ? "Archivar" : "Reactivar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Declarar saldo = lo que contaste en la caja o lo que dice el extracto del banco a una fecha. Si no coincide con el calculado, falta cargar algo (o sobra): el mes no se cierra hasta que la diferencia sea cero.
      </div>
    </>
  );
}

function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}><span className="kp-label">{label}</span>{children}</label>;
}

function NuevaCuenta({ onCerrar, onListo }: { onCerrar: () => void; onListo: (t: string) => void }) {
  const [f, setF] = useState({ nombre: "", tipo: "BANCO", numero: "", saldoInicialGs: "0", fechaSaldoInicial: "", montoAsignadoGs: "" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => { const r = await crearCuenta(f as never); if (r.ok) onListo(`Cuenta "${f.nombre}" creada.`); else setError(r.error); }); }}
      style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Nueva cuenta</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Nombre" ancho={200}><input className="kp-input" value={f.nombre} onChange={e => set("nombre", e.target.value)} required maxLength={60} placeholder="Ej: Banco principal" /></Campo>
        <Campo label="Tipo" ancho={140}><select className="kp-input" value={f.tipo} onChange={e => set("tipo", e.target.value)}>{Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo label="N° de cuenta (se guarda cifrado)" ancho={180}><input className="kp-input" value={f.numero} onChange={e => set("numero", e.target.value)} maxLength={40} autoComplete="off" /></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Saldo inicial (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={f.saldoInicialGs} onChange={e => set("saldoInicialGs", e.target.value.replace(/[^\d-]/g, ""))} /></Campo>
        <Campo label="Fecha del saldo inicial" ancho={150}><input type="date" className="kp-input" value={f.fechaSaldoInicial} onChange={e => set("fechaSaldoInicial", e.target.value)} /></Campo>
        {f.tipo === "CAJA_CHICA" && <Campo label="Monto asignado (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={f.montoAsignadoGs} onChange={e => set("montoAsignadoGs", e.target.value.replace(/\D/g, ""))} /></Campo>}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Crear</button>
      </div>
    </form>
  );
}

function DeclararSaldo({ cuenta, hoy, onCerrar, onListo }: { cuenta: Cuenta; hoy: string; onCerrar: () => void; onListo: (t: string) => void }) {
  const [fechaD, setFecha] = useState(hoy);
  const [saldo, setSaldo] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => { const r = await declararSaldo({ cuentaFondosId: cuenta.id, fecha: fechaD, saldoGs: saldo, observacion: obs }); if (r.ok) onListo("Saldo declarado."); else setError(r.error); }); }}
      style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Declarar saldo de {cuenta.nombre}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Fecha" ancho={140}><input type="date" className="kp-input" value={fechaD} max={hoy} onChange={e => setFecha(e.target.value)} required /></Campo>
        <Campo label={cuenta.tipo === "BANCO" || cuenta.tipo === "COOPERATIVA" ? "Saldo del extracto (₲)" : "Lo que contaste (₲)"} ancho={170}>
          <input className="kp-input" inputMode="numeric" value={saldo} onChange={e => setSaldo(e.target.value.replace(/[^\d-]/g, ""))} required />
        </Campo>
        <Campo label="Observación" ancho={200}><input className="kp-input" value={obs} onChange={e => setObs(e.target.value)} maxLength={200} /></Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente || !saldo}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Declarar</button>
      </div>
    </form>
  );
}
