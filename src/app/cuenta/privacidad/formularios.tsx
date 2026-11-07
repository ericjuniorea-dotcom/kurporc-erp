"use client";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/auth/marco-auth";
import { actualizarPerfil, cancelarBaja, crearSolicitud, pedirBaja } from "@/app/acciones/privacidad";
import { TIPOS_SOLICITUD } from "@/lib/legal/privacidad";

type Msg = { tipo: "ok" | "error"; texto: string } | null;
const fila: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 };

const DEPARTAMENTOS = ["Asunción", "Concepción", "San Pedro", "Cordillera", "Guairá", "Caaguazú", "Caazapá", "Itapúa", "Misiones",
  "Paraguarí", "Alto Paraná", "Central", "Ñeembucú", "Amambay", "Canindeyú", "Presidente Hayes", "Boquerón", "Alto Paraguay"];

function useAccion() {
  const [msg, setMsg] = useState<Msg>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok: true; mensaje?: string } | { ok: false; error: string }>) => {
    setMsg(null);
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? { tipo: "ok", texto: r.mensaje ?? "Listo" } : { tipo: "error", texto: r.error });
    });
  };
  return { msg, pendiente, correr };
}

export function FormPerfil({ inicial }: { inicial: { name: string; email: string; phone: string; departamento: string; distrito: string } }) {
  const { msg, pendiente, correr } = useAccion();
  return (
    <form action={(f) => correr(() => actualizarPerfil({
      name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""),
      departamento: String(f.get("departamento") ?? ""), distrito: String(f.get("distrito") ?? ""),
    }))} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={fila}>
        <div><label className="kp-label" htmlFor="name">Nombre</label><input id="name" name="name" defaultValue={inicial.name} required maxLength={120} className="kp-input" /></div>
        <div><label className="kp-label" htmlFor="email">Correo</label><input id="email" value={inicial.email} disabled className="kp-input" /></div>
        <div><label className="kp-label" htmlFor="phone">Teléfono (WhatsApp)</label><input id="phone" name="phone" defaultValue={inicial.phone} placeholder="+595 981 123456" maxLength={20} className="kp-input" /></div>
        <div>
          <label className="kp-label" htmlFor="departamento">Departamento</label>
          <select id="departamento" name="departamento" defaultValue={inicial.departamento} className="kp-input">
            <option value="">—</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div><label className="kp-label" htmlFor="distrito">Distrito</label><input id="distrito" name="distrito" defaultValue={inicial.distrito} maxLength={80} className="kp-input" /></div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ alignSelf: "flex-start", height: 32 }}>Guardar</button>
    </form>
  );
}

export function FormSolicitud() {
  const { msg, pendiente, correr } = useAccion();
  return (
    <form action={(f) => correr(() => crearSolicitud({ tipo: String(f.get("tipo") ?? ""), detalle: String(f.get("detalle") ?? "") }))}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div>
        <label className="kp-label" htmlFor="tipo">¿Qué necesitás?</label>
        <select id="tipo" name="tipo" required defaultValue="" className="kp-input">
          <option value="" disabled>Elegí una opción</option>
          {Object.entries(TIPOS_SOLICITUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="kp-label" htmlFor="detalle">Detalle (opcional)</label>
        <textarea id="detalle" name="detalle" maxLength={2000} rows={3} className="kp-input" style={{ height: "auto", paddingTop: 8 }} />
      </div>
      <button type="submit" className="btn" disabled={pendiente} style={{ alignSelf: "flex-start", height: 32 }}>Enviar solicitud</button>
    </form>
  );
}

export function PanelBaja({ email, pedida }: { email: string; pedida: string | null }) {
  const { msg, pendiente, correr } = useAccion();
  const [confirmacion, setConfirmacion] = useState("");
  if (pedida) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          Pediste la baja el {pedida}. Durante 30 días podés arrepentirte.
        </p>
        <button type="button" className="btn" disabled={pendiente} onClick={() => correr(cancelarBaja)} style={{ alignSelf: "flex-start", height: 32 }}>
          Cancelar el pedido de baja
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
        Tenés 30 días para arrepentirte. Después se borran o anonimizan tus datos personales, salvo lo que la ley obliga a guardar
        (por ejemplo, registros contables y la constancia de lo que aceptaste). Los datos de tus organizaciones no se borran por esto.
      </p>
      <div>
        <label className="kp-label" htmlFor="confirmacion">Para confirmar, escribí tu correo: {email}</label>
        <input id="confirmacion" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} className="kp-input" autoComplete="off" />
      </div>
      <button type="button" className="btn" disabled={pendiente || confirmacion.trim().toLowerCase() !== email.toLowerCase()}
        onClick={() => correr(() => pedirBaja({ confirmacion }))}
        style={{ alignSelf: "flex-start", height: 32, color: "var(--danger)", borderColor: "var(--danger)" }}>
        Pedir la baja de mi cuenta
      </button>
    </div>
  );
}
