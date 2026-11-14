"use client";
// Un mensaje del buzón con sus acciones: recategorizar, priorizar, responder, publicar y agrupar.
import { useState, useTransition } from "react";
import { actualizarSugerencia, agruparSugerencia, publicarEnHojaDeRuta } from "@/app/acciones/sugerencias";
import { CLAVES_MODULO, MODULOS } from "@/lib/modulos";

const TIPO: Record<string, string> = { PROBLEMA: "Problema", CONSULTA: "Duda", SUGERENCIA: "Idea", FUNCION_NUEVA: "Función nueva" };
const ESTADO: Record<string, string> = { NUEVA: "Nueva", EN_REVISION: "En revisión", EN_DESARROLLO: "En desarrollo", HECHA: "Hecha", DESCARTADA: "Descartada" };
const COLOR_TIPO: Record<string, string> = { PROBLEMA: "var(--danger-subtle)", CONSULTA: "var(--info-subtle)", SUGERENCIA: "var(--success-subtle)", FUNCION_NUEVA: "var(--warning-subtle)" };

export type S = {
  id: string; tipo: string; modulo: string | null; prioridad: string | null; mensaje: string; titulo: string | null; problema: string | null; comoFuncionaria: string | null;
  pagina: string | null; estado: string; respuesta: string | null; fecha: string; persona: string; email: string | null; organizacion: string | null;
  publica: boolean; tituloPublico: string | null; descripcionPublica: string | null; agrupadaEn: string | null;
};

const chico = { height: 28, fontSize: 12 } as const;

export function FilaBuzon({ s, pedidas, agrupadas, candidatos }: { s: S; pedidas: number; agrupadas: S[]; candidatos: { id: string; etiqueta: string }[] }) {
  const [respuesta, setRespuesta] = useState(s.respuesta ?? "");
  const [titPub, setTitPub] = useState(s.tituloPublico ?? s.titulo ?? "");
  const [descPub, setDescPub] = useState(s.descripcionPublica ?? "");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); iniciar(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "No se pudo guardar."); }); };
  const cambiar = (d: Parameters<typeof actualizarSugerencia>[0]) => correr(() => actualizarSugerencia(d));

  return (
    <article id={`m-${s.id}`} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: COLOR_TIPO[s.tipo], color: "var(--text-primary)", padding: "1px 8px", borderRadius: 99, fontWeight: 500 }}>{TIPO[s.tipo] ?? s.tipo}</span>
          <span>{s.modulo ? MODULOS[s.modulo as keyof typeof MODULOS]?.etiqueta ?? s.modulo : "Sin módulo"}</span>
          <span>· {s.persona}{s.email && <> · <a href={`mailto:${s.email}`}>{s.email}</a></>}{s.organizacion && <> · {s.organizacion}</>}</span>
        </span>
        <span>{new Date(s.fecha).toLocaleString("es-PY")}{s.pagina && <> · {s.pagina}</>}</span>
      </div>

      {s.tipo === "FUNCION_NUEVA" && s.titulo ? (
        <div style={{ fontSize: 13, color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: 4 }}>
          <strong style={{ fontWeight: 500 }}>{s.titulo}</strong>
          <div style={{ whiteSpace: "pre-wrap" }}><span style={{ color: "var(--text-muted)" }}>Problema: </span>{s.problema}</div>
          <div style={{ whiteSpace: "pre-wrap" }}><span style={{ color: "var(--text-muted)" }}>Cómo debería funcionar: </span>{s.comoFuncionaria}</div>
        </div>
      ) : <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{s.mensaje}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)", alignItems: "center" }}>
        <span>Estado: <strong style={{ fontWeight: 500, color: "var(--text-primary)" }}>{ESTADO[s.estado] ?? s.estado}</strong></span>
        <span>Pedida por <strong style={{ fontWeight: 500, color: "var(--text-primary)" }}>{pedidas}</strong> organización{pedidas === 1 ? "" : "es"}</span>
        {s.publica && <span style={{ color: "var(--success-text)" }}>Publicada en la hoja de ruta</span>}
        {agrupadas.length > 0 && <span>{agrupadas.length} mensaje{agrupadas.length === 1 ? "" : "s"} agrupado{agrupadas.length === 1 ? "" : "s"}</span>}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select aria-label="Tipo" className="kp-input" style={{ ...chico, width: "auto" }} value={s.tipo} disabled={pendiente} onChange={e => cambiar({ id: s.id, tipo: e.target.value as never })}>
          {Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Módulo" className="kp-input" style={{ ...chico, width: "auto" }} value={s.modulo ?? "OTRO"} disabled={pendiente} onChange={e => cambiar({ id: s.id, modulo: e.target.value })}>
          {CLAVES_MODULO.map(k => <option key={k} value={k}>{MODULOS[k].etiqueta}</option>)}
        </select>
        <select aria-label="Prioridad" className="kp-input" style={{ ...chico, width: "auto" }} value={s.prioridad ?? ""} disabled={pendiente} onChange={e => cambiar({ id: s.id, prioridad: e.target.value as never })}>
          <option value="">Sin prioridad</option><option value="ALTA">Prioridad alta</option><option value="MEDIA">Prioridad media</option><option value="BAJA">Prioridad baja</option>
        </select>
      </div>

      <textarea className="kp-input" value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={2} maxLength={4000} aria-label="Respuesta"
        placeholder="Respuesta (la persona la ve en el botón de ayuda y recibe un aviso)" style={{ height: "auto", minHeight: 52, padding: 8 }} />
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["EN_REVISION", "En revisión"], ["EN_DESARROLLO", "En desarrollo"], ["HECHA", "Hecha"], ["DESCARTADA", "Descartar"], ["NUEVA", "Volver a nuevas"]].filter(([k]) => k !== s.estado).map(([k, v]) => (
          <button key={k} type="button" className={k === "HECHA" ? "btn btn-primary" : "btn"} style={chico} disabled={pendiente} onClick={() => cambiar({ id: s.id, estado: k as never, respuesta })}>{v}</button>
        ))}
        {respuesta !== (s.respuesta ?? "") && <button type="button" className="btn" style={chico} disabled={pendiente} onClick={() => cambiar({ id: s.id, respuesta })}>Guardar respuesta</button>}
      </div>

      {!s.agrupadaEn && (
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>Hoja de ruta {s.publica ? "(publicada)" : ""}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Los clientes ven solo este texto, el estado y cuántos la piden. Nunca el mensaje original, el autor ni la organización.</span>
            <input className="kp-input" value={titPub} onChange={e => setTitPub(e.target.value)} maxLength={80} placeholder="Título para los clientes" aria-label="Título público" />
            <textarea className="kp-input" value={descPub} onChange={e => setDescPub(e.target.value)} maxLength={600} rows={2} placeholder="Descripción para los clientes, reescrita" aria-label="Descripción pública" style={{ height: "auto", padding: 8 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-primary" style={chico} disabled={pendiente} onClick={() => correr(() => publicarEnHojaDeRuta({ id: s.id, publica: true, tituloPublico: titPub, descripcionPublica: descPub }))}>{s.publica ? "Actualizar" : "Publicar"}</button>
              {s.publica && <button type="button" className="btn" style={chico} disabled={pendiente} onClick={() => correr(() => publicarEnHojaDeRuta({ id: s.id, publica: false }))}>Retirar</button>}
            </div>
          </div>
        </details>
      )}
      <details style={{ fontSize: 12 }}>
        <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>Agrupar con otro mensaje</summary>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {s.agrupadaEn
            ? <button type="button" className="btn" style={chico} disabled={pendiente} onClick={() => correr(() => agruparSugerencia(s.id, null))}>Desagrupar</button>
            : <>
              <select className="kp-input" aria-label="Mensaje principal" value={destino} onChange={e => setDestino(e.target.value)} style={{ ...chico, width: "auto", maxWidth: "100%" }}>
                <option value="">Elegí el mensaje principal…</option>
                {candidatos.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <button type="button" className="btn" style={chico} disabled={pendiente || !destino} onClick={() => correr(() => agruparSugerencia(s.id, destino))}>Agrupar</button>
            </>}
        </div>
      </details>
      {agrupadas.length > 0 && (
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>Ver los {agrupadas.length} agrupados</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {agrupadas.map(a => <FilaBuzon key={a.id} s={a} pedidas={1} agrupadas={[]} candidatos={[]} />)}
          </div>
        </details>
      )}
    </article>
  );
}
