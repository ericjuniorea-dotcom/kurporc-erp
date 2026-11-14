"use client";
// «Ayuda y sugerencias» (Fase 15.1): pestaña plegable en el borde derecho, a media altura.
// No tapa botones: se arrastra en vertical, recuerda su lugar y se esconde con el teclado del celular.
// Lo que se manda llega al equipo de KurPorc (panel de plataforma → Buzón).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { avisosBuzon, enviarSugerencia, marcarAvisosBuzonLeidos, misSugerencias, responderComoCliente } from "@/app/acciones/sugerencias";
import { CLAVES_MODULO, MODULOS, moduloDeRuta, type ModuloClave } from "@/lib/modulos";
import { CORREO_SOPORTE } from "@/lib/contacto";

const TIPOS = { PROBLEMA: "Algo no funciona", CONSULTA: "Tengo una duda", SUGERENCIA: "Una idea para mejorar", FUNCION_NUEVA: "Quiero una función nueva" } as const;
const ESTADO: Record<string, string> = { NUEVA: "Recibida", EN_REVISION: "La estamos viendo", EN_DESARROLLO: "La estamos haciendo", HECHA: "Hecha", DESCARTADA: "No la vamos a hacer por ahora" };
type Mia = Awaited<ReturnType<typeof misSugerencias>>[number];

const CLAVE = "kp-ayuda";
const ALTO_PESTANA = 48;
const leer = (): { plegada?: boolean; alto?: number } => { try { return JSON.parse(localStorage.getItem(CLAVE) ?? "{}") ?? {}; } catch { return {}; } };
const guardar = (v: { plegada: boolean; alto: number }) => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin almacenamiento: no pasa nada */ } };
const limitar = (y: number) => Math.min(Math.max(y, 0.06), 0.9);

export function AyudaSoporte({ oculto = false }: { oculto?: boolean }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [alto, setAlto] = useState(0.45); // fracción del alto de la ventana
  const [teclado, setTeclado] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPOS>("SUGERENCIA");
  const [mensaje, setMensaje] = useState("");
  const [modulo, setModulo] = useState<ModuloClave>("OTRO");
  const [titulo, setTitulo] = useState("");
  const [problema, setProblema] = useState("");
  const [comoFuncionaria, setComoFuncionaria] = useState("");
  const [sinLeer, setSinLeer] = useState(0);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [mias, setMias] = useState<Mia[] | null>(null);
  const [pendiente, iniciar] = useTransition();
  const pestana = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const arrastre = useRef<{ inicioY: number; inicioAlto: number; movio: boolean } | null>(null);

  // Preferencias guardadas; en celular siempre arranca plegada. ?ayuda=1 la abre (avisos del buzón).
  useEffect(() => {
    const p = leer();
    if (typeof p.alto === "number") setAlto(limitar(p.alto));
    const pide = new URLSearchParams(window.location.search).get("ayuda") === "1";
    if (pide || (p.plegada === false && window.innerWidth >= 768)) setAbierto(true);
  }, []);

  useEffect(() => { setModulo(moduloDeRuta(ruta)); }, [ruta]);
  useEffect(() => { if (!oculto) avisosBuzon().then(setSinLeer).catch(() => {}); }, [oculto, ruta]);
  useEffect(() => { if (abierto && sinLeer > 0) { setSinLeer(0); marcarAvisosBuzonLeidos().catch(() => {}); } }, [abierto, sinLeer]);

  const cambiar = useCallback((abrir: boolean) => {
    setAbierto(abrir);
    guardar({ plegada: !abrir, alto });
    if (!abrir) requestAnimationFrame(() => pestana.current?.focus());
  }, [alto]);

  useEffect(() => { if (abierto) { panel.current?.focus(); if (mias === null) misSugerencias().then(setMias).catch(() => setMias([])); } }, [abierto, mias]);
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") cambiar(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto, cambiar]);

  // Con un campo de texto enfocado fuera del panel (teclado del celular abierto) la pestaña se esconde
  useEffect(() => {
    const revisar = () => {
      const el = document.activeElement as HTMLElement | null;
      const esCampo = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) && !panel.current?.contains(el);
      setTeclado(esCampo && window.innerWidth < 768);
    };
    const salir = () => setTimeout(revisar, 0);
    document.addEventListener("focusin", revisar); document.addEventListener("focusout", salir);
    return () => { document.removeEventListener("focusin", revisar); document.removeEventListener("focusout", salir); };
  }, []);

  if (oculto) return null;

  const abajo = (e: React.PointerEvent<HTMLButtonElement>) => {
    arrastre.current = { inicioY: e.clientY, inicioAlto: alto, movio: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current; if (!a) return;
    const d = e.clientY - a.inicioY;
    if (Math.abs(d) > 4) a.movio = true;
    if (a.movio) setAlto(limitar(a.inicioAlto + d / window.innerHeight));
  };
  const arriba = () => {
    const a = arrastre.current; arrastre.current = null;
    if (!a) return;
    if (a.movio) guardar({ plegada: !abierto, alto });
    else cambiar(true);
  };

  const derecha = "env(safe-area-inset-right, 0px)";
  return (
    <>
      {!abierto && !teclado && (
        <button ref={pestana} type="button" aria-label={sinLeer > 0 ? "Abrir ayuda y sugerencias (tenés una respuesta nueva)" : "Abrir ayuda y sugerencias"} aria-expanded={false} aria-controls="panel-ayuda" title="Ayuda y sugerencias · arrastrá para moverla"
          onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={() => { arrastre.current = null; }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cambiar(true); } }}
          style={{ position: "fixed", right: derecha, top: `max(env(safe-area-inset-top, 0px), calc(${(alto * 100).toFixed(2)}vh - ${ALTO_PESTANA / 2}px))`, zIndex: 60,
            width: 24, height: ALTO_PESTANA, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "grab",
            background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px 0 0 8px" }}>
          <IconChevronLeft size={16} aria-hidden />
          {sinLeer > 0 && <span aria-label="Tenés una respuesta nueva" style={{ position: "absolute", top: 4, left: 4, width: 8, height: 8, borderRadius: 99, background: "#fff", boxShadow: "0 0 0 2px var(--accent)" }} />}
        </button>
      )}
      {abierto && (
        <section id="panel-ayuda" ref={panel} tabIndex={-1} role="dialog" aria-label="Ayuda y sugerencias"
          style={{ position: "fixed", right: `calc(${derecha} + 16px)`, top: `clamp(calc(env(safe-area-inset-top, 0px) + 16px), calc(${(alto * 100).toFixed(2)}vh - 160px), 30vh)`, zIndex: 61,
            width: "min(380px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", outline: "none",
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", boxShadow: "0 10px 30px rgba(0,0,0,.2)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>¿En qué te ayudamos?</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Leemos todo lo que llega y mejoramos KurPorc con lo que nos cuentan.</div>
            </div>
            <button type="button" className="btn" aria-label="Plegar ayuda" style={{ height: 28, padding: "0 6px" }} onClick={() => cambiar(false)}><IconChevronRight size={15} /></button>
          </div>
          <form noValidate onSubmit={e => { e.preventDefault(); setMsg(null);
            const falta = faltaParaEnviar(tipo, { mensaje, titulo, problema, comoFuncionaria });
            if (falta) { setMsg({ tipo: "error", texto: falta }); return; }
            iniciar(async () => {
            const r = await enviarSugerencia(tipo === "FUNCION_NUEVA" ? { tipo, titulo, problema, comoFuncionaria, modulo, pagina: ruta } : { tipo, mensaje, modulo, pagina: ruta });
            if (r.ok) { setMensaje(""); setTitulo(""); setProblema(""); setComoFuncionaria(""); setMias(null); setMsg({ tipo: "ok", texto: "¡Gracias! Lo recibimos. Te respondemos acá mismo." }); }
            else setMsg({ tipo: "error", texto: r.error });
          }); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div role="radiogroup" aria-label="Tipo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map(k => (
                <button key={k} type="button" role="radio" aria-checked={tipo === k} onClick={() => setTipo(k)}
                  className={tipo === k ? "btn btn-primary" : "btn"} style={{ height: 28, fontSize: 12 }}>{TIPOS[k]}</button>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)" }}>
              Sobre qué módulo
              <select className="kp-input" value={modulo} onChange={e => setModulo(e.target.value as ModuloClave)} style={{ height: 32 }}>
                {CLAVES_MODULO.map(k => <option key={k} value={k}>{MODULOS[k].etiqueta}</option>)}
              </select>
            </label>
            {tipo === "FUNCION_NUEVA" ? (
              <>
                <input className="kp-input" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={80} aria-label="Título" placeholder="Título corto (ej.: Alerta de celo por WhatsApp)" style={{ height: 34 }} />
                <Minimo valor={titulo} minimo={5} />
                <textarea className="kp-input" value={problema} onChange={e => setProblema(e.target.value)} maxLength={1500} rows={3}
                  aria-label="¿Qué problema te resuelve?" placeholder="¿Qué problema te resuelve?" style={{ height: "auto", minHeight: 70, padding: 8, resize: "vertical" }} />
                <Minimo valor={problema} minimo={10} />
                <textarea className="kp-input" value={comoFuncionaria} onChange={e => setComoFuncionaria(e.target.value)} maxLength={1500} rows={3}
                  aria-label="¿Cómo querés que funcione?" placeholder="¿Cómo querés que funcione?" style={{ height: "auto", minHeight: 70, padding: 8, resize: "vertical" }} />
                <Minimo valor={comoFuncionaria} minimo={10} />
              </>
            ) : (
              <textarea className="kp-input" value={mensaje} onChange={e => setMensaje(e.target.value)} maxLength={4000} rows={4}
                aria-label="Mensaje" placeholder={tipo === "PROBLEMA" ? "¿Qué estabas haciendo y qué pasó?" : tipo === "CONSULTA" ? "Escribí tu duda" : "¿Qué te gustaría que cambie o que tenga KurPorc?"}
                style={{ height: "auto", minHeight: 90, padding: 8, resize: "vertical" }} />
            )}
            <button type="submit" className="btn btn-primary" disabled={pendiente}>
              {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Enviar
            </button>
            {msg && <div role={msg.tipo === "error" ? "alert" : "status"}><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
          </form>
          <a href="/cuenta/hoja-de-ruta" style={{ fontSize: 12, color: "var(--accent-text)", fontWeight: 500 }}>Ver lo que piden otros →</a>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            También podés escribirnos a <a href={`mailto:${CORREO_SOPORTE}`} style={{ color: "var(--accent-text)", fontWeight: 500 }}>{CORREO_SOPORTE}</a>
          </div>
          {mias && mias.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "0.5px solid var(--border-default)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Lo que nos mandaste</div>
              {mias.map(m => (
                <div key={m.id} style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-base)", borderRadius: 8, padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "var(--text-muted)" }}>{new Date(m.createdAt).toLocaleDateString("es-PY")}</span>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{ESTADO[m.estado] ?? m.estado}</span>
                  </div>
                  <Conversacion m={m} onRespondido={() => setMias(null)} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

/** Qué falta para poder enviar (null = está todo). Se muestra al tocar Enviar, en vez de un botón que no hace nada. */
function faltaParaEnviar(tipo: string, d: { mensaje: string; titulo: string; problema: string; comoFuncionaria: string }): string | null {
  if (tipo !== "FUNCION_NUEVA") return d.mensaje.trim().length < 3 ? "Escribí tu mensaje (al menos 3 letras)." : null;
  const faltas: string[] = [];
  if (d.titulo.trim().length < 5) faltas.push("un título de al menos 5 letras");
  if (d.problema.trim().length < 10) faltas.push("qué problema te resuelve (al menos 10 letras)");
  if (d.comoFuncionaria.trim().length < 10) faltas.push("cómo querés que funcione (al menos 10 letras)");
  return faltas.length ? `Para enviarla falta: ${faltas.join(", ")}.` : null;
}

function Minimo({ valor, minimo }: { valor: string; minimo: number }) {
  const n = valor.trim().length;
  if (n >= minimo) return null;
  return <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -4 }}>{n}/{minimo} letras como mínimo</div>;
}

/** Hilo de un mensaje: lo que mandó la persona, las respuestas de KurPorc y la opción de seguir la conversación. */
function Conversacion({ m, onRespondido }: { m: Mia; onRespondido: () => void }) {
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const hora = (s: string) => new Date(s).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
      <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{m.titulo ?? (m.mensaje.length > 220 ? `${m.mensaje.slice(0, 220)}…` : m.mensaje)}</div>
      {m.mensajes.map(x => (
        <div key={x.id} style={{ alignSelf: x.dePlataforma ? "flex-start" : "flex-end", maxWidth: "92%", padding: "6px 8px", borderRadius: 8,
          background: x.dePlataforma ? "var(--bg-surface)" : "var(--accent-subtle, var(--bg-overlay))", border: "0.5px solid var(--border-default)" }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{x.dePlataforma ? "KurPorc" : "Vos"} · {hora(x.createdAt)}</div>
          <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{x.texto}</div>
        </div>
      ))}
      {!abierta ? (
        <button type="button" onClick={() => setAbierta(true)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--accent-text)", cursor: "pointer", fontWeight: 500 }}>
          Responder
        </button>
      ) : (
        <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => {
          const r = await responderComoCliente(m.id, texto);
          if (r.ok) { setTexto(""); setAbierta(false); onRespondido(); } else setError(r.error);
        }); }} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea className="kp-input" value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={4000} aria-label="Tu respuesta"
            placeholder="Escribí tu respuesta" style={{ height: "auto", minHeight: 52, padding: 8 }} />
          {error && <div role="alert" style={{ fontSize: 11.5, color: "var(--danger-text)" }}>{error}</div>}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => setAbierta(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={pendiente || texto.trim().length < 2}>
              {pendiente && <IconLoader2 size={12} className="animate-spin" aria-hidden />} Enviar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
