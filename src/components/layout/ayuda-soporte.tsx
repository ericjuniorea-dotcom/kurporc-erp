"use client";
// «Ayuda y sugerencias» (Fase 15.1): pestaña plegable en el borde derecho, a media altura.
// No tapa botones: se arrastra en vertical, recuerda su lugar y se esconde con el teclado del celular.
// Lo que se manda llega al equipo de KurPorc (panel de plataforma → Buzón).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { enviarSugerencia, misSugerencias } from "@/app/acciones/sugerencias";
import { CORREO_SOPORTE } from "@/lib/contacto";

const TIPOS = { SUGERENCIA: "Una idea para mejorar", PROBLEMA: "Algo no funciona", CONSULTA: "Tengo una duda" } as const;
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
        <button ref={pestana} type="button" aria-label="Abrir ayuda y sugerencias" aria-expanded={false} aria-controls="panel-ayuda" title="Ayuda y sugerencias · arrastrá para moverla"
          onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={() => { arrastre.current = null; }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cambiar(true); } }}
          style={{ position: "fixed", right: derecha, top: `max(env(safe-area-inset-top, 0px), calc(${(alto * 100).toFixed(2)}vh - ${ALTO_PESTANA / 2}px))`, zIndex: 60,
            width: 24, height: ALTO_PESTANA, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "grab",
            background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px 0 0 8px" }}>
          <IconChevronLeft size={16} aria-hidden />
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
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => {
            const r = await enviarSugerencia({ tipo, mensaje, pagina: ruta });
            if (r.ok) { setMensaje(""); setMias(null); setMsg({ tipo: "ok", texto: "¡Gracias! Lo recibimos. Te respondemos acá mismo." }); }
            else setMsg({ tipo: "error", texto: r.error });
          }); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div role="radiogroup" aria-label="Tipo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map(k => (
                <button key={k} type="button" role="radio" aria-checked={tipo === k} onClick={() => setTipo(k)}
                  className={tipo === k ? "btn btn-primary" : "btn"} style={{ height: 28, fontSize: 12 }}>{TIPOS[k]}</button>
              ))}
            </div>
            <textarea className="kp-input" value={mensaje} onChange={e => setMensaje(e.target.value)} required minLength={3} maxLength={4000} rows={4}
              aria-label="Mensaje" placeholder={tipo === "PROBLEMA" ? "¿Qué estabas haciendo y qué pasó?" : tipo === "CONSULTA" ? "Escribí tu duda" : "¿Qué te gustaría que cambie o que tenga KurPorc?"}
              style={{ height: "auto", minHeight: 90, padding: 8, resize: "vertical" }} />
            <button type="submit" className="btn btn-primary" disabled={pendiente || mensaje.trim().length < 3}>
              {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Enviar
            </button>
          </form>
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
                  <div style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{m.mensaje.length > 160 ? `${m.mensaje.slice(0, 160)}…` : m.mensaje}</div>
                  {m.respuesta && <div style={{ marginTop: 4, color: "var(--text-primary)" }}><strong>KurPorc:</strong> {m.respuesta}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
