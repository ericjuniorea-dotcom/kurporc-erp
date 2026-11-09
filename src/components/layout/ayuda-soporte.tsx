"use client";
// Botón fijo «Ayuda y sugerencias»: visible en todas las pantallas del panel.
// Lo que se manda llega al equipo de KurPorc (panel de plataforma → Sugerencias).
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { IconLoader2, IconMessageCircleQuestion, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { enviarSugerencia, misSugerencias } from "@/app/acciones/sugerencias";
import { CORREO_SOPORTE } from "@/lib/contacto";

const TIPOS = { SUGERENCIA: "Una idea para mejorar", PROBLEMA: "Algo no funciona", CONSULTA: "Tengo una duda" } as const;
const ESTADO: Record<string, string> = { NUEVA: "Recibida", EN_REVISION: "La estamos viendo", HECHA: "Hecha", DESCARTADA: "No la vamos a hacer por ahora" };
type Mia = Awaited<ReturnType<typeof misSugerencias>>[number];

export function AyudaSoporte() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPOS>("SUGERENCIA");
  const [mensaje, setMensaje] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [mias, setMias] = useState<Mia[] | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => { if (abierto && mias === null) misSugerencias().then(setMias).catch(() => setMias([])); }, [abierto, mias]);
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  return (
    <>
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto} aria-controls="panel-ayuda"
        className="btn btn-primary"
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 60, height: 40, borderRadius: 999, padding: "0 14px", boxShadow: "0 4px 14px rgba(0,0,0,.18)", gap: 6 }}>
        <IconMessageCircleQuestion size={18} aria-hidden /> Ayuda y sugerencias
      </button>
      {abierto && (
        <section id="panel-ayuda" role="dialog" aria-label="Ayuda y sugerencias"
          style={{ position: "fixed", right: 16, bottom: 66, zIndex: 61, width: "min(380px, calc(100vw - 32px))", maxHeight: "min(620px, calc(100vh - 90px))", overflowY: "auto",
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", boxShadow: "0 10px 30px rgba(0,0,0,.2)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>¿En qué te ayudamos?</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Leemos todo lo que llega y mejoramos KurPorc con lo que nos cuentan.</div>
            </div>
            <button type="button" className="btn" aria-label="Cerrar" style={{ height: 28, padding: "0 6px" }} onClick={() => setAbierto(false)}><IconX size={15} /></button>
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
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Lo que nos mandaste</div>
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
