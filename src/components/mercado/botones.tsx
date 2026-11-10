"use client";
// Botones del detalle de una publicación (Fase 12): favorito y denunciar.
import { useState, useTransition } from "react";
import { IconHeart, IconHeartFilled, IconFlag } from "@tabler/icons-react";
import { alternarFavorito, denunciarPublicacion } from "@/app/acciones/mercado";

export function BotonFavorito({ id, inicial, conSesion, volver }: { id: string; inicial: boolean; conSesion: boolean; volver: string }) {
  const [fav, setFav] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  if (!conSesion) return <a href={`/login?next=${encodeURIComponent(volver)}`} className="btn" style={{ height: 32, fontSize: 12.5 }}><IconHeart size={14} aria-hidden /> Guardar</a>;
  return (
    <button className="btn" style={{ height: 32, fontSize: 12.5 }} disabled={pendiente} aria-pressed={fav}
      onClick={() => iniciar(async () => { const r = await alternarFavorito(id); if (r.ok) setFav(!!r.favorito); })}>
      {fav ? <IconHeartFilled size={14} style={{ color: "var(--danger)" }} aria-hidden /> : <IconHeart size={14} aria-hidden />} {fav ? "Guardado" : "Guardar"}
    </button>
  );
}

const MOTIVOS: [string, string][] = [
  ["ENGANOSA", "Información engañosa"], ["PROHIBIDA", "Producto prohibido o sin registro"], ["PRECIO", "Precio que no se respeta"],
  ["SIN_DOCUMENTACION", "Animales sin documentación sanitaria"], ["OTRO", "Otro"],
];

export function Denunciar({ id, conSesion, volver }: { id: string; conSesion: boolean; volver: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (!conSesion) return <a href={`/login?next=${encodeURIComponent(volver)}`} style={{ fontSize: 12, color: "var(--text-muted)" }}><IconFlag size={12} aria-hidden /> Denunciar</a>;
  if (msg) return <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{msg}</span>;
  if (!abierto) return <button onClick={() => setAbierto(true)} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: 0, cursor: "pointer", padding: 0 }}><IconFlag size={12} aria-hidden /> Denunciar esta publicación</button>;
  return (
    <form onSubmit={e => { e.preventDefault(); iniciar(async () => { const r = await denunciarPublicacion(id, motivo, detalle); setMsg(r.ok ? "Gracias. Moderación la va a revisar." : r.error); }); }}
      style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 }}>
      <select className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} required aria-label="Motivo de la denuncia">
        <option value="">¿Qué pasa con esta publicación?</option>
        {MOTIVOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <textarea className="kp-input" rows={2} value={detalle} onChange={e => setDetalle(e.target.value)} maxLength={1000} placeholder="Detalle (opcional)" style={{ height: "auto", padding: 8 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" className="btn" disabled={pendiente || !motivo} style={{ height: 30, fontSize: 12 }}>Enviar denuncia</button>
        <button type="button" className="btn" onClick={() => setAbierto(false)} style={{ height: 30, fontSize: 12 }}>Cancelar</button>
      </div>
    </form>
  );
}
