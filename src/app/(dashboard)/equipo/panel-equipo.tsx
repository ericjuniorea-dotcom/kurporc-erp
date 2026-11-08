"use client";
// Pantalla de Equipo (Fase 7.1–7.2).
import { useMemo, useState, useTransition } from "react";
import { IconBrandWhatsapp, IconCopy, IconLoader2, IconUserPlus, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import {
  actualizarMiembro, cambiarEstadoMiembro, crearCuentaGestionada, invitarPersona, quitarMiembro,
  resolverSolicitud, restablecerClaveGestionada, revocarInvitacion,
} from "@/app/acciones/equipo";
import { MatrizPermisos, resumenPermisos, type PermisoUI } from "./matriz-permisos";

type Rol = { id: string; codigo: string; nombre: string; descripcion: string; permisos: string[] };
type Miembro = {
  id: string; nombre: string; email: string; avatarUrl: string | null; userId: string; cargo: string; estado: string;
  esPropietario: boolean; gestionada: boolean; rolId: string | null; rol: string; granjas: string[]; unidades: string[];
  limiteCompraGs: string | null; ajustes: { clave: string; efecto: string }[]; ultimoAcceso: string | null;
};
type Props = {
  yo: string; codigoEmpresa: string;
  puedo: { invitar: boolean; gestionada: boolean; editar: boolean; suspender: boolean; quitar: boolean; solicitudes: boolean; sinLimite: boolean };
  misPermisos: string[] | null; catalogo: PermisoUI[]; roles: Rol[];
  granjas: { id: string; nombre: string }[]; unidades: { id: string; nombre: string; codigo: string }[];
  miembros: Miembro[];
  invitaciones: { id: string; email: string; cargo: string | null; expiraEn: string; rol: string }[];
  solicitudes: { id: string; nombre: string; email: string; mensaje: string; fecha: string }[];
};

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const gs = (v: string | null) => v === null ? "Sin límite" : v === "0" ? "Requiere aprobación" : `Gs ${Number(v).toLocaleString("es-PY")}`;

function copiar(texto: string) { navigator.clipboard?.writeText(texto).catch(() => {}); }

export function PanelEquipo(p: Props) {
  const [pestana, setPestana] = useState<"miembros" | "invitaciones" | "pedidos">("miembros");
  const [formulario, setFormulario] = useState<{ modo: "nuevo" } | { modo: "editar"; miembro: Miembro } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setMsg(null);
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error ?? "Error" });
    });
  };

  const tabs = [
    { id: "miembros", label: `Miembros (${p.miembros.length})` },
    { id: "invitaciones", label: `Invitaciones (${p.invitaciones.length})` },
    { id: "pedidos", label: `Pedidos para unirse (${p.solicitudes.length})` },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Código de empresa: <strong style={{ color: "var(--text-primary)", letterSpacing: "0.08em" }}>{p.codigoEmpresa}</strong>
          <button type="button" onClick={() => copiar(p.codigoEmpresa)} aria-label="Copiar código" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", verticalAlign: -2 }}><IconCopy size={13} /></button>
          <span style={{ color: "var(--text-muted)" }}> · lo usan los operarios para ingresar y quien pida unirse</span>
        </div>
        {(p.puedo.invitar || p.puedo.gestionada) && (
          <button type="button" className="btn btn-primary" onClick={() => { setMsg(null); setFormulario({ modo: "nuevo" }); }} style={{ height: 34 }}>
            <IconUserPlus size={15} aria-hidden /> Agregar persona
          </button>
        )}
      </div>

      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--border-default)", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={pestana === t.id} type="button" onClick={() => setPestana(t.id)}
            style={{ padding: "8px 12px", fontSize: 12.5, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: `2px solid ${pestana === t.id ? "var(--accent)" : "transparent"}`,
              color: pestana === t.id ? "var(--text-primary)" : "var(--text-muted)", fontWeight: pestana === t.id ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {pestana === "miembros" && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                {["Persona", "Rol", "Alcance", "Compras", "Último acceso", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 500, fontSize: 11, borderBottom: "0.5px solid var(--border-default)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.miembros.map(m => {
                const editable = !m.esPropietario && m.userId !== p.yo;
                return (
                  <tr key={m.id} style={{ borderBottom: "0.5px solid var(--border-default)", opacity: m.estado === "SUSPENDIDO" ? 0.55 : 1 }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {m.avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element -- foto de perfil de Google
                          ? <img src={m.avatarUrl} alt="" width={26} height={26} style={{ borderRadius: "50%" }} referrerPolicy="no-referrer" />
                          : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-overlay)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-secondary)" }}>{m.nombre.charAt(0)}</span>}
                        <div>
                          <div style={{ color: "var(--text-primary)" }}>{m.nombre}{m.userId === p.yo && <span style={{ color: "var(--text-muted)" }}> (vos)</span>}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.cargo || m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {m.esPropietario ? "Administrador General" : m.rol}
                      {m.ajustes.length > 0 && <span style={{ color: "var(--accent)", fontSize: 11 }}> · {m.ajustes.length} ajustes</span>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 11.5 }}>
                      {m.granjas.length ? `${m.granjas.length} granja(s)` : "Todas las granjas"}
                      {m.unidades.length ? ` · ${m.unidades.length} unidad(es)` : ""}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 11.5 }}>{m.esPropietario ? "Sin límite" : gs(m.limiteCompraGs)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 11.5 }}>{fecha(m.ultimoAcceso)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: m.estado === "ACTIVO" ? "var(--success-subtle)" : "var(--warning-subtle)", color: m.estado === "ACTIVO" ? "var(--success-text)" : "var(--warning-text)" }}>
                        {m.estado === "ACTIVO" ? "Activo" : "Suspendido"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                      {editable && p.puedo.editar && <button type="button" className="btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => { setMsg(null); setFormulario({ modo: "editar", miembro: m }); }}>Permisos</button>}{" "}
                      {editable && m.gestionada && p.puedo.gestionada && (
                        <button type="button" className="btn" style={{ height: 28, fontSize: 11.5 }} disabled={pendiente}
                          onClick={() => { setMsg(null); iniciar(async () => {
                            const r = await restablecerClaveGestionada({ miembroId: m.id });
                            setMsg(r.ok ? { tipo: "ok", texto: `Contraseña temporal nueva de ${m.nombre}: ${r.clave} (se la va a pedir cambiar al entrar)` } : { tipo: "error", texto: r.error });
                          }); }}>Nueva clave</button>
                      )}{" "}
                      {editable && p.puedo.suspender && (
                        <button type="button" className="btn" style={{ height: 28, fontSize: 11.5 }} disabled={pendiente}
                          onClick={() => correr(() => cambiarEstadoMiembro({ miembroId: m.id, estado: m.estado === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO" }), m.estado === "ACTIVO" ? `${m.nombre} quedó suspendido: ya no puede entrar.` : `${m.nombre} volvió a estar activo.`)}>
                          {m.estado === "ACTIVO" ? "Suspender" : "Reactivar"}
                        </button>
                      )}{" "}
                      {editable && p.puedo.quitar && (
                        <button type="button" className="btn" style={{ height: 28, fontSize: 11.5, color: "var(--danger)" }} disabled={pendiente}
                          onClick={() => { if (confirm(`¿Quitar a ${m.nombre} del equipo?`)) correr(() => quitarMiembro({ miembroId: m.id }), `${m.nombre} ya no es parte del equipo.`); }}>
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pestana === "invitaciones" && (
        <div style={{ ...tarjeta, padding: 4 }}>
          {p.invitaciones.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "var(--text-muted)" }}>No hay invitaciones pendientes.</div> : p.invitaciones.map(i => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "0.5px solid var(--border-default)", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12.5 }}>
                <div style={{ color: "var(--text-primary)" }}>{i.email}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.rol}{i.cargo ? ` · ${i.cargo}` : ""} · vence el {fecha(i.expiraEn)}</div>
              </div>
              {p.puedo.invitar && (
                <button type="button" className="btn" style={{ height: 28, fontSize: 11.5 }} disabled={pendiente}
                  onClick={() => correr(() => revocarInvitacion({ id: i.id }), "Invitación revocada. El enlace ya no sirve.")}>Revocar</button>
              )}
            </div>
          ))}
          <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)" }}>Por seguridad, el enlace solo se muestra al crearlo. Si se perdió, revocá y volvé a invitar.</div>
        </div>
      )}

      {pestana === "pedidos" && (
        <div style={{ ...tarjeta, padding: 4 }}>
          {p.solicitudes.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: "var(--text-muted)" }}>No hay pedidos pendientes. Quien tenga el código de empresa puede pedir unirse desde su cuenta.</div> : p.solicitudes.map(s => (
            <PedidoUnion key={s.id} s={s} roles={p.roles} puede={p.puedo.solicitudes} correr={correr} pendiente={pendiente} />
          ))}
        </div>
      )}

      {formulario && (
        <FormularioPersona
          key={formulario.modo === "editar" ? formulario.miembro.id : "nuevo"}
          props={p}
          miembro={formulario.modo === "editar" ? formulario.miembro : null}
          onCerrar={() => setFormulario(null)}
          onListo={(texto) => { setFormulario(null); setMsg({ tipo: "ok", texto }); }}
        />
      )}
    </div>
  );
}

function PedidoUnion({ s, roles, puede, correr, pendiente }: {
  s: Props["solicitudes"][number]; roles: Rol[]; puede: boolean; pendiente: boolean;
  correr: (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => void;
}) {
  const [rolId, setRolId] = useState(roles.find(r => r.codigo === "OPERARIO")?.id ?? roles[0]?.id ?? "");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "0.5px solid var(--border-default)", flexWrap: "wrap" }}>
      <div style={{ fontSize: 12.5 }}>
        <div style={{ color: "var(--text-primary)" }}>{s.nombre} <span style={{ color: "var(--text-muted)" }}>· {s.email}</span></div>
        {s.mensaje && <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>“{s.mensaje}”</div>}
      </div>
      {puede && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={rolId} onChange={e => setRolId(e.target.value)} className="kp-input" style={{ height: 30, fontSize: 12, width: "auto" }} aria-label="Rol">
            {roles.filter(r => r.codigo !== "ADMIN_GENERAL").map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <button type="button" className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente}
            onClick={() => correr(() => resolverSolicitud({ id: s.id, aprobar: true, rolId }), `${s.nombre} ya es parte del equipo. Podés ajustar sus permisos en Miembros.`)}>Aprobar</button>
          <button type="button" className="btn" style={{ height: 30, fontSize: 12 }} disabled={pendiente}
            onClick={() => correr(() => resolverSolicitud({ id: s.id, aprobar: false }), "Pedido rechazado.")}>Rechazar</button>
        </div>
      )}
    </div>
  );
}

function FormularioPersona({ props: p, miembro, onCerrar, onListo }: {
  props: Props; miembro: Miembro | null; onCerrar: () => void; onListo: (texto: string) => void;
}) {
  const rolesAsignables = p.roles.filter(r => r.codigo !== "ADMIN_GENERAL" || p.puedo.sinLimite);
  const rolInicial = miembro?.rolId ?? rolesAsignables.find(r => r.codigo === "OPERARIO")?.id ?? rolesAsignables[0]?.id ?? "";
  const [modo, setModo] = useState<"correo" | "gestionada">(p.puedo.invitar ? "correo" : "gestionada");
  const [rolId, setRolId] = useState(rolInicial);
  const base = useMemo(() => new Set(p.roles.find(r => r.id === rolId)?.permisos ?? []), [p.roles, rolId]);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => {
    const s = new Set(p.roles.find(r => r.id === rolInicial)?.permisos ?? []);
    for (const a of miembro?.ajustes ?? []) { if (a.efecto === "PERMITIR") s.add(a.clave); else s.delete(a.clave); }
    return s;
  });
  const [granjas, setGranjas] = useState<string[]>(miembro?.granjas ?? []);
  const [unidades, setUnidades] = useState<string[]>(miembro?.unidades ?? []);
  const [limiteModo, setLimiteModo] = useState<"aprobacion" | "monto" | "sin">(miembro?.limiteCompraGs === null ? "sin" : miembro && miembro.limiteCompraGs !== "0" ? "monto" : "aprobacion");
  const [limite, setLimite] = useState(miembro?.limiteCompraGs && miembro.limiteCompraGs !== "0" ? miembro.limiteCompraGs : "");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tipo: "enlace"; enlace: string; email: string } | { tipo: "gestionada"; usuario: string; codigo: string; clave: string; nombre: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const permitidos = p.misPermisos ? new Set(p.misPermisos) : null;

  function cambiarRol(id: string) {
    setRolId(id);
    setSeleccion(new Set(p.roles.find(r => r.id === id)?.permisos ?? []));
  }

  function datosComunes() {
    const ajustes = [
      ...Array.from(seleccion).filter(c => !base.has(c)).map(clave => ({ clave, efecto: "PERMITIR" as const })),
      ...Array.from(base).filter(c => !seleccion.has(c)).map(clave => ({ clave, efecto: "DENEGAR" as const })),
    ];
    const limiteCompraGs = limiteModo === "sin" ? null : limiteModo === "aprobacion" ? "0" : (limite.replace(/\D/g, "") || "0");
    return { rolId, ajustes, granjas, unidades, limiteCompraGs };
  }

  function guardar(f: FormData) {
    setError(null);
    const cargo = String(f.get("cargo") ?? "");
    iniciar(async () => {
      if (miembro) {
        const r = await actualizarMiembro({ miembroId: miembro.id, cargo, ...datosComunes() });
        if (r.ok) onListo(`Permisos de ${miembro.nombre} actualizados.`); else setError(r.error);
      } else if (modo === "correo") {
        const email = String(f.get("email") ?? "");
        const r = await invitarPersona({ email, cargo, ...datosComunes() });
        if (r.ok) setResultado({ tipo: "enlace", enlace: r.enlace, email }); else setError(r.error);
      } else {
        const nombre = String(f.get("nombre") ?? "");
        const r = await crearCuentaGestionada({ nombre, usuario: String(f.get("usuario") ?? ""), cargo, ...datosComunes() });
        if (r.ok) setResultado({ tipo: "gestionada", usuario: r.usuario, codigo: r.codigo, clave: r.clave, nombre }); else setError(r.error);
      }
    });
  }

  const alternar = (lista: string[], set: (v: string[]) => void, v: string) => set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  return (
    <div role="dialog" aria-modal="true" aria-label={miembro ? `Permisos de ${miembro.nombre}` : "Agregar persona"}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget && !pendiente) onCerrar(); }}>
      <div style={{ ...tarjeta, width: "100%", maxWidth: 720, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>{miembro ? `Permisos de ${miembro.nombre}` : "Agregar persona"}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={18} /></button>
        </div>

        {resultado ? (
          resultado.tipo === "enlace" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
              <Aviso tipo="ok">Invitación creada para {resultado.email}. Vence en 7 días.</Aviso>
              <p style={{ margin: 0 }}>Mandale este enlace. Va a entrar con su cuenta de Google o su correo y aceptar los términos él mismo:</p>
              <code style={{ fontSize: 11.5, wordBreak: "break-all", background: "var(--bg-base)", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)" }}>{resultado.enlace}</code>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => copiar(resultado.enlace)} style={{ height: 32 }}><IconCopy size={14} aria-hidden /> Copiar enlace</button>
                <a className="btn" target="_blank" rel="noopener" style={{ height: 32 }}
                  href={`https://wa.me/?text=${encodeURIComponent(`Te invito a nuestro equipo en KurPorc: ${resultado.enlace}`)}`}>
                  <IconBrandWhatsapp size={14} aria-hidden /> Enviar por WhatsApp
                </a>
                <button type="button" className="btn btn-primary" onClick={() => onListo(`Invitación enviada a ${resultado.email}.`)} style={{ height: 32 }}>Listo</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
              <Aviso tipo="ok">Cuenta creada para {resultado.nombre}. Esta contraseña se muestra una sola vez.</Aviso>
              <div style={{ background: "var(--bg-base)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px", lineHeight: 1.8 }}>
                <div>Entrar en: <strong>www.kurporc.com/login</strong> → pestaña “Usuario de operario”</div>
                <div>Usuario: <strong style={{ color: "var(--text-primary)" }}>{resultado.usuario}</strong></div>
                <div>Código de empresa: <strong style={{ color: "var(--text-primary)" }}>{resultado.codigo}</strong></div>
                <div>Contraseña temporal: <strong style={{ color: "var(--text-primary)" }}>{resultado.clave}</strong></div>
              </div>
              <p style={{ margin: 0, fontSize: 12 }}>Al entrar por primera vez va a tener que aceptar los términos y elegir su propia contraseña.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" style={{ height: 32 }}
                  onClick={() => copiar(`KurPorc — www.kurporc.com/login (Usuario de operario)\nUsuario: ${resultado.usuario}\nCódigo de empresa: ${resultado.codigo}\nContraseña temporal: ${resultado.clave}`)}>
                  <IconCopy size={14} aria-hidden /> Copiar datos
                </button>
                <a className="btn" target="_blank" rel="noopener" style={{ height: 32 }}
                  href={`https://wa.me/?text=${encodeURIComponent(`KurPorc — www.kurporc.com/login (Usuario de operario)\nUsuario: ${resultado.usuario}\nCódigo de empresa: ${resultado.codigo}\nContraseña temporal: ${resultado.clave}`)}`}>
                  <IconBrandWhatsapp size={14} aria-hidden /> Enviar por WhatsApp
                </a>
                <button type="button" className="btn btn-primary" onClick={() => onListo(`${resultado.nombre} ya puede entrar con su usuario.`)} style={{ height: 32 }}>Listo</button>
              </div>
            </div>
          )
        ) : (
          <form action={guardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <Aviso tipo="error">{error}</Aviso>}

            {!miembro && (
              <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>1. ¿Cómo va a entrar?</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.puedo.invitar && <button type="button" onClick={() => setModo("correo")} className="btn" style={{ height: 32, borderColor: modo === "correo" ? "var(--accent)" : undefined }}>Con su correo o Gmail (recomendado)</button>}
                  {p.puedo.gestionada && <button type="button" onClick={() => setModo("gestionada")} className="btn" style={{ height: 32, borderColor: modo === "gestionada" ? "var(--accent)" : undefined }}>Sin correo (operario)</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  {modo === "correo" ? (
                    <div><label className="kp-label" htmlFor="email">Correo</label><input id="email" name="email" type="email" required maxLength={254} className="kp-input" /></div>
                  ) : (
                    <>
                      <div><label className="kp-label" htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required maxLength={120} className="kp-input" /></div>
                      <div><label className="kp-label" htmlFor="usuario">Usuario</label><input id="usuario" name="usuario" required maxLength={30} pattern="[a-zA-Z0-9._\-]{3,30}" autoCapitalize="none" placeholder="ej. jose.maternidad" className="kp-input" /></div>
                    </>
                  )}
                  <div><label className="kp-label" htmlFor="cargo">Cargo (lo ve el equipo)</label><input id="cargo" name="cargo" maxLength={80} placeholder="Ej. Encargado de Maternidad" className="kp-input" /></div>
                </div>
              </section>
            )}
            {miembro && (
              <div><label className="kp-label" htmlFor="cargo">Cargo</label><input id="cargo" name="cargo" defaultValue={miembro.cargo} maxLength={80} className="kp-input" /></div>
            )}

            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{miembro ? "Rol y permisos" : "2. Rol y permisos"}</div>
              <div>
                <label className="kp-label" htmlFor="rol">Rol base</label>
                <select id="rol" value={rolId} onChange={e => cambiarRol(e.target.value)} className="kp-input">
                  {rolesAsignables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{p.roles.find(r => r.id === rolId)?.descripcion}</div>
              </div>
              <MatrizPermisos catalogo={p.catalogo} seleccion={seleccion} onChange={setSeleccion} base={base} permitidos={permitidos} />
              <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-base)", borderRadius: "var(--radius-md)", padding: "8px 10px", lineHeight: 1.5 }}>
                {resumenPermisos(seleccion, p.catalogo)}
              </div>
            </section>

            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{miembro ? "Alcance" : "3. Alcance"}</div>
              {p.granjas.length > 1 && (
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="kp-label">Granjas (sin marcar ninguna = todas)</legend>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {p.granjas.map(g => (
                      <label key={g.id} style={{ fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center" }}>
                        <input type="checkbox" checked={granjas.includes(g.id)} onChange={() => alternar(granjas, setGranjas, g.id)} style={{ accentColor: "var(--accent)" }} />{g.nombre}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {p.unidades.length > 1 && (
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="kp-label">Unidades de negocio para finanzas (sin marcar = todas)</legend>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {p.unidades.map(u => (
                      <label key={u.id} style={{ fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center" }}>
                        <input type="checkbox" checked={unidades.includes(u.id)} onChange={() => alternar(unidades, setUnidades, u.id)} style={{ accentColor: "var(--accent)" }} />{u.nombre}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend className="kp-label">Compras en el Mercado</legend>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
                  <label style={{ display: "inline-flex", gap: 5 }}><input type="radio" checked={limiteModo === "aprobacion"} onChange={() => setLimiteModo("aprobacion")} style={{ accentColor: "var(--accent)" }} />Toda compra requiere aprobación</label>
                  <label style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><input type="radio" checked={limiteModo === "monto"} onChange={() => setLimiteModo("monto")} style={{ accentColor: "var(--accent)" }} />Hasta Gs
                    <input value={limite} onChange={e => { setLimite(e.target.value.replace(/\D/g, "")); setLimiteModo("monto"); }} inputMode="numeric" maxLength={13} className="kp-input" style={{ width: 130, height: 28 }} aria-label="Límite por pedido en guaraníes" /> por pedido</label>
                  {p.puedo.sinLimite && <label style={{ display: "inline-flex", gap: 5 }}><input type="radio" checked={limiteModo === "sin"} onChange={() => setLimiteModo("sin")} style={{ accentColor: "var(--accent)" }} />Sin límite</label>}
                </div>
              </fieldset>
            </section>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={onCerrar} disabled={pendiente} style={{ height: 36 }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={pendiente || !rolId} style={{ height: 36, minWidth: 140, justifyContent: "center" }}>
                {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : miembro ? "Guardar cambios" : modo === "correo" ? "Crear invitación" : "Crear cuenta"}
              </button>
            </div>
          </form>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
