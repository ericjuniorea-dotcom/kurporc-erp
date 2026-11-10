"use client";
// Formularios del panel de plataforma (Fase 11, parte 2).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { decidirVendedor, guardarConfiguracion, guardarIncidente, marcarAprobadoAsesor, publicarDocumento, responderPrivacidad } from "@/app/acciones/admin-plataforma";

type R = { ok: true } | { ok: false; error: string };

function useAccion() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<R>, alTerminar?: () => void) => {
    setError(null);
    iniciar(async () => { const r = await f(); if (r.ok) { alTerminar?.(); router.refresh(); } else setError(r.error); });
  };
  return { error, pendiente, correr };
}

const Error = ({ e }: { e: string | null }) => e ? <div role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{e}</div> : null;
const Cargando = ({ p }: { p: boolean }) => p ? <IconLoader2 size={13} className="animate-spin" aria-hidden /> : null;
const etiqueta: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 };

export function DecisionVendedor({ id, estado }: { id: string; estado: string }) {
  const { error, pendiente, correr } = useAccion();
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {estado !== "VERIFICADA" && <button className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => decidirVendedor(id, "VERIFICADA", ""))}><Cargando p={pendiente} />Aprobar</button>}
        {estado !== "RECHAZADA" && !rechazando && <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => setRechazando(true)}>Rechazar…</button>}
      </div>
      {rechazando && (
        <div style={{ display: "flex", gap: 6 }}>
          <input className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (la tienda lo ve)" maxLength={300} style={{ height: 28, fontSize: 12, flex: 1 }} />
          <button className="btn" style={{ height: 28, fontSize: 12, color: "var(--danger-text)" }} disabled={pendiente} onClick={() => correr(() => decidirVendedor(id, "RECHAZADA", motivo), () => setRechazando(false))}>Confirmar</button>
        </div>
      )}
      <Error e={error} />
    </div>
  );
}

export function RespuestaPrivacidad({ id, respuestaActual }: { id: string; respuestaActual: string | null }) {
  const { error, pendiente, correr } = useAccion();
  const [txt, setTxt] = useState(respuestaActual ?? "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea className="kp-input" value={txt} onChange={e => setTxt(e.target.value)} rows={3} maxLength={4000} placeholder="Respuesta para la persona" style={{ fontSize: 12.5, padding: 8, height: "auto" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => responderPrivacidad(id, "EN_CURSO", txt))}>Marcar en curso</button>
        <button className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => responderPrivacidad(id, "RESPONDIDA", txt))}><Cargando p={pendiente} />Responder y cerrar</button>
        <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => responderPrivacidad(id, "RECHAZADA_CON_MOTIVO", txt))}>Rechazar con motivo</button>
      </div>
      <Error e={error} />
    </div>
  );
}

type Incidente = { id?: string; detectadoEn: string; descripcion: string; datosAfectados: string; personasAfectadas: string; medidas: string; estado: string; notificadoAgenciaEn: string; notificadoTitularesEn: string };
const VACIO: Incidente = { detectadoEn: "", descripcion: "", datosAfectados: "", personasAfectadas: "", medidas: "", estado: "ABIERTO", notificadoAgenciaEn: "", notificadoTitularesEn: "" };

export function FormIncidente({ inicial, titulo }: { inicial?: Incidente; titulo: string }) {
  const { error, pendiente, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState<Incidente>(inicial ?? VACIO);
  const campo = (k: keyof Incidente) => ({ value: d[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value }) });
  if (!abierto) return <button className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => setAbierto(true)}>{titulo}</button>;
  return (
    <form onSubmit={e => { e.preventDefault(); correr(() => guardarIncidente({ ...d, personasAfectadas: d.personasAfectadas ? Number(d.personasAfectadas) : undefined, estado: d.estado as "ABIERTO" | "CONTENIDO" | "CERRADO" }), () => { setAbierto(false); if (!inicial) setD(VACIO); }); }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, padding: 12, border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--bg-subtle)" }}>
      <label style={etiqueta}>Detectado
        <input type="datetime-local" className="kp-input" required {...campo("detectadoEn")} />
      </label>
      <label style={etiqueta}>Estado
        <select className="kp-input" {...campo("estado")}><option value="ABIERTO">Abierto</option><option value="CONTENIDO">Contenido</option><option value="CERRADO">Cerrado</option></select>
      </label>
      <label style={etiqueta}>Personas afectadas
        <input type="number" min={0} className="kp-input" {...campo("personasAfectadas")} />
      </label>
      <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Qué pasó
        <textarea className="kp-input" rows={3} required minLength={10} style={{ height: "auto", padding: 8 }} {...campo("descripcion")} />
      </label>
      <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Datos afectados
        <input className="kp-input" {...campo("datosAfectados")} />
      </label>
      <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Medidas tomadas
        <textarea className="kp-input" rows={2} style={{ height: "auto", padding: 8 }} {...campo("medidas")} />
      </label>
      <label style={etiqueta}>Notificado a la agencia
        <input type="datetime-local" className="kp-input" {...campo("notificadoAgenciaEn")} />
      </label>
      <label style={etiqueta}>Notificado a los titulares
        <input type="datetime-local" className="kp-input" {...campo("notificadoTitularesEn")} />
      </label>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, alignItems: "center" }}>
        <button type="submit" className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente}><Cargando p={pendiente} />Guardar</button>
        <button type="button" className="btn" style={{ height: 30, fontSize: 12 }} onClick={() => setAbierto(false)}>Cancelar</button>
        <Error e={error} />
      </div>
    </form>
  );
}

export function AccionesDocumento({ id, estado, aprobado }: { id: string; estado: string; aprobado: boolean }) {
  const { error, pendiente, correr } = useAccion();
  const [asesor, setAsesor] = useState("");
  if (estado !== "BORRADOR") return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{aprobado ? "Aprobado por el asesor" : "Sin aprobación del asesor"}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 240 }}>
      {!aprobado ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input className="kp-input" value={asesor} onChange={e => setAsesor(e.target.value)} placeholder="Asesor o estudio que lo aprobó" style={{ height: 28, fontSize: 12, flex: 1 }} />
          <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => marcarAprobadoAsesor(id, true, asesor))}>Marcar aprobado</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={pendiente}
            onClick={() => { if (confirm("¿Publicar esta versión? Reemplaza a la vigente y, si exige reaceptación, todas las personas la tendrán que aceptar de nuevo.")) correr(() => publicarDocumento(id)); }}>
            <Cargando p={pendiente} />Publicar
          </button>
          <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => correr(() => marcarAprobadoAsesor(id, false, ""))}>Quitar aprobación</button>
        </div>
      )}
      <Error e={error} />
    </div>
  );
}

type Config = { razonSocial: string; ruc: string; domicilio: string; correoContacto: string; correoPrivacidad: string; whatsappSoporte: string; ciudadJurisdiccion: string };
export function FormConfiguracion({ inicial, puedeEditar }: { inicial: Config; puedeEditar: boolean }) {
  const { error, pendiente, correr } = useAccion();
  const [d, setD] = useState(inicial);
  const [ok, setOk] = useState(false);
  const CAMPOS: [keyof Config, string][] = [
    ["razonSocial", "Razón social"], ["ruc", "RUC"], ["domicilio", "Domicilio"], ["correoContacto", "Correo de contacto"],
    ["correoPrivacidad", "Correo de privacidad"], ["whatsappSoporte", "WhatsApp de soporte"], ["ciudadJurisdiccion", "Ciudad de jurisdicción"],
  ];
  return (
    <form onSubmit={e => { e.preventDefault(); setOk(false); correr(() => guardarConfiguracion(d), () => setOk(true)); }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
      {CAMPOS.map(([k, l]) => (
        <label key={k} style={etiqueta}>{l}
          <input className="kp-input" value={d[k]} disabled={!puedeEditar} onChange={e => setD({ ...d, [k]: e.target.value })} />
        </label>
      ))}
      {puedeEditar && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit" className="btn btn-primary" style={{ height: 32 }} disabled={pendiente}><Cargando p={pendiente} />Guardar</button>
          {ok && <span style={{ fontSize: 12, color: "var(--success-text)" }}>Guardado. Los documentos legales ya muestran estos datos.</span>}
          <Error e={error} />
        </div>
      )}
    </form>
  );
}
