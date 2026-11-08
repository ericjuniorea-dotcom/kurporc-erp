"use client";
// Equipo · pestañas Roles y Actividad, y transferencia de propiedad (Fase 7, parte 2).
import { useMemo, useState, useTransition } from "react";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { eliminarRol, guardarRol, transferirPropiedad } from "@/app/acciones/roles";
import { MatrizPermisos, resumenPermisos, type PermisoUI } from "./matriz-permisos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export type RolFila = { id: string; codigo: string; nombre: string; descripcion: string; permisos: string[]; miembros: number };

// ── Roles ────────────────────────────────────────────────────────────
export function PestanaRoles({ roles, catalogo, puedeEditar, misPermisos }: {
  roles: RolFila[]; catalogo: PermisoUI[]; puedeEditar: boolean; misPermisos: string[] | null;
}) {
  const [editando, setEditando] = useState<RolFila | "nuevo" | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function borrar(r: RolFila) {
    if (!confirm(`¿Eliminar el rol "${r.nombre}"?`)) return;
    setMsg(null);
    iniciar(async () => {
      const x = await eliminarRol(r.id);
      setMsg(x.ok ? { tipo: "ok", texto: "Rol eliminado." } : { tipo: "error", texto: x.error });
    });
  }

  if (editando) {
    return <EditorRol rol={editando === "nuevo" ? null : editando} catalogo={catalogo} misPermisos={misPermisos}
      alTerminar={(texto) => { setEditando(null); if (texto) setMsg({ tipo: "ok", texto }); }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Los roles son puntos de partida: al cambiar uno, cambian los permisos de todas las personas que lo tienen.
        </span>
        {puedeEditar && (
          <button type="button" className="btn" onClick={() => { setMsg(null); setEditando("nuevo"); }} style={{ height: 32 }}>
            <IconPlus size={14} aria-hidden /> Nuevo rol
          </button>
        )}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
              {["Rol", "Permisos", "Personas", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 500, fontSize: 11, borderBottom: "0.5px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map(r => {
              const fijo = r.codigo === "ADMIN_GENERAL";
              return (
                <tr key={r.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: "var(--text-primary)" }}>{r.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 460 }}>{r.descripcion}</div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{fijo ? "Todos" : r.permisos.length}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{r.miembros}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {puedeEditar && !fijo && (
                      <>
                        <button type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => { setMsg(null); setEditando(r); }}>Editar</button>
                        {r.miembros === 0 && (
                          <button type="button" className="btn" aria-label={`Eliminar ${r.nombre}`} disabled={pendiente} onClick={() => borrar(r)} style={{ height: 28, color: "var(--danger)" }}>
                            <IconTrash size={14} aria-hidden />
                          </button>
                        )}
                      </>
                    )}
                    {fijo && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Fijo</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorRol({ rol, catalogo, misPermisos, alTerminar }: {
  rol: RolFila | null; catalogo: PermisoUI[]; misPermisos: string[] | null; alTerminar: (msg?: string) => void;
}) {
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [seleccion, setSeleccion] = useState(() => new Set(rol?.permisos ?? []));
  const base = useMemo(() => new Set(rol?.permisos ?? []), [rol]);
  const permitidos = useMemo(() => misPermisos === null ? null : new Set(misPermisos), [misPermisos]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarRol({ id: rol?.id ?? null, nombre, descripcion, permisos: Array.from(seleccion) });
      if (r.ok) alTerminar(rol ? `Rol "${nombre}" actualizado.` : `Rol "${nombre}" creado.`);
      else setError(r.error);
    });
  }

  return (
    <div style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{rol ? `Editar rol: ${rol.nombre}` : "Nuevo rol"}</div>
      {rol && rol.miembros > 0 && (
        <Aviso tipo="ok">Lo tienen {rol.miembros} persona(s). Los cambios se aplican a todas en su próxima pantalla.</Aviso>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kp-label">Nombre</span>
          <input className="kp-input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} placeholder="Ej: Encargado de galpón" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kp-label">Descripción</span>
          <input className="kp-input" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={200} placeholder="Qué hace esta persona" />
        </label>
      </div>
      <MatrizPermisos catalogo={catalogo} seleccion={seleccion} onChange={setSeleccion} base={base} permitidos={permitidos} />
      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "8px 10px", borderRadius: "var(--radius-md)" }}>
        {resumenPermisos(seleccion, catalogo)}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => alTerminar()} disabled={pendiente}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={pendiente || nombre.trim().length < 2}>
          {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar rol
        </button>
      </div>
    </div>
  );
}

// ── Actividad ────────────────────────────────────────────────────────
export type EventoActividad = { id: string; fecha: string; actor: string; accion: string; entidad: string; detalle: Record<string, unknown>; ip: string | null };

const NOMBRE_ACCION: Record<string, string> = {
  LOGIN: "Entró", LOGIN_FALLIDO: "Intento de ingreso fallido", LOGIN_BLOQUEADO: "Ingreso bloqueado", LOGOUT: "Salió",
  MIEMBRO_INVITADO: "Sumó a una persona", MIEMBRO_SUSPENDIDO: "Suspendió o quitó a una persona", PERMISOS_CAMBIADOS: "Cambió permisos",
  PROPIEDAD_TRANSFERIDA: "Transfirió la organización", DATO_PERSONAL_VISTO: "Vio datos personales", EXPORTACION: "Exportó datos",
  MOVIMIENTO_ANULADO: "Anuló un movimiento", MES_CERRADO: "Cerró un mes", MES_REABIERTO: "Reabrió un mes",
  CONTRATO_ACEPTADO: "Aceptó los términos", ACCESO_PLATAFORMA: "La plataforma vio tus datos (con motivo)", SOLICITUD_PRIVACIDAD: "Pidió algo sobre sus datos", BAJA_SOLICITADA: "Pidió la baja",
};

function resumenDetalle(e: EventoActividad): string {
  const d = e.detalle;
  const partes: string[] = [];
  if (typeof d.tipo === "string") partes.push(d.tipo.replace(/_/g, " "));
  if (typeof d.nombre === "string") partes.push(d.nombre);
  if (typeof d.email === "string") partes.push(d.email);
  if (Array.isArray(d.agregados) && d.agregados.length) partes.push(`+${d.agregados.length} permisos`);
  if (Array.isArray(d.quitados) && d.quitados.length) partes.push(`−${d.quitados.length} permisos`);
  if (typeof d.estado === "string") partes.push(d.estado.toLowerCase());
  return partes.join(" · ");
}

export function PestanaActividad({ eventos }: { eventos: EventoActividad[] }) {
  const [accion, setAccion] = useState("");
  const [persona, setPersona] = useState("");
  const acciones = useMemo(() => Array.from(new Set(eventos.map(e => e.accion))), [eventos]);
  const personas = useMemo(() => Array.from(new Set(eventos.map(e => e.actor))).sort(), [eventos]);
  const visibles = eventos.filter(e => (!accion || e.accion === accion) && (!persona || e.actor === persona));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="kp-input" value={accion} onChange={e => setAccion(e.target.value)} aria-label="Filtrar por acción" style={{ maxWidth: 260 }}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{NOMBRE_ACCION[a] ?? a}</option>)}
        </select>
        <select className="kp-input" value={persona} onChange={e => setPersona(e.target.value)} aria-label="Filtrar por persona" style={{ maxWidth: 260 }}>
          <option value="">Todas las personas</option>
          {personas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>Últimos {eventos.length} eventos. El registro no se puede borrar ni modificar.</span>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 620 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
              {["Cuándo", "Quién", "Qué", "Detalle"].map(h => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 500, fontSize: 11, borderBottom: "0.5px solid var(--border-default)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map(e => (
              <tr key={e.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                <td style={{ padding: "8px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap", fontSize: 11.5 }}>
                  {new Date(e.fecha).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>{e.actor}</td>
                <td style={{ padding: "8px 12px", color: e.accion.includes("FALLIDO") || e.accion.includes("BLOQUEADO") ? "var(--warning-text)" : "var(--text-secondary)" }}>
                  {NOMBRE_ACCION[e.accion] ?? e.accion}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 11.5 }}>{resumenDetalle(e)}</td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>No hay actividad con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Transferir la organización ───────────────────────────────────────
export function TransferirPropiedad({ candidatos, nombreOrg, tieneSegundoFactor }: {
  candidatos: { id: string; nombre: string }[]; nombreOrg: string; tieneSegundoFactor: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        ¿Querés que otra persona sea la propietaria?{" "}
        <button type="button" onClick={() => setAbierto(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>
          Transferir la organización
        </button>
      </div>
    );
  }

  function transferir() {
    setMsg(null);
    iniciar(async () => {
      const r = await transferirPropiedad(destino, confirmacion);
      setMsg(r.ok ? { tipo: "ok", texto: "Listo. Ahora sos Administrador General, pero ya no propietario." } : { tipo: "error", texto: r.error });
    });
  }

  return (
    <div style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10, borderColor: "var(--danger)" }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Transferir la organización</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        La persona elegida pasa a ser la propietaria: va a poder cerrar la organización, cambiar el plan y quitarte. Vos seguís como Administrador General. No se puede deshacer sin que ella te la devuelva.
      </div>
      {!tieneSegundoFactor && (
        <Aviso tipo="error">Primero verificá el segundo factor en <a href="/cuenta/seguridad" style={{ color: "inherit" }}>Cuenta → Seguridad</a>.</Aviso>
      )}
      <select className="kp-input" value={destino} onChange={e => setDestino(e.target.value)} aria-label="Nueva persona propietaria">
        <option value="">Elegí a la nueva persona propietaria</option>
        {candidatos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="kp-label">Para confirmar, escribí <strong>{nombreOrg}</strong></span>
        <input className="kp-input" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} autoComplete="off" />
      </label>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => setAbierto(false)} disabled={pendiente}>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={transferir}
          disabled={pendiente || !destino || !tieneSegundoFactor || confirmacion.trim().toLowerCase() !== nombreOrg.trim().toLowerCase()}
>
          {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Transferir
        </button>
      </div>
    </div>
  );
}
