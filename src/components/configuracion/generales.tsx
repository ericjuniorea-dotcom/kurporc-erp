"use client";
// Configuración → Generales: preferencias de cada persona (no cambian lo que ven los demás) y metas de toda la granja.
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { guardarAyudaIndicadores } from "@/app/acciones/preferencias";
import { AyudaIndicador, usePreferencias } from "@/components/indicadores/ayuda";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 };

export function PanelGenerales({ metas }: { metas: React.ReactNode }) {
  const { ayuda, setAyuda } = usePreferencias();
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const cambiar = (v: boolean) => {
    if (v === ayuda) return;
    const antes = ayuda;
    setAyuda(v); setMsg(null);
    iniciar(async () => {
      const r = await guardarAyudaIndicadores(v).catch(() => ({ ok: false as const, error: "No se pudo guardar. Probá de nuevo." }));
      if (!r.ok) { setAyuda(antes); setMsg({ ok: false, texto: r.error }); }
      else setMsg({ ok: true, texto: v ? "Listo: vas a ver la explicación al pasar el mouse." : "Listo: la explicación queda oculta." });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <section style={tarjeta} aria-labelledby="pref-titulo">
        <h3 id="pref-titulo" style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Mis preferencias</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Solo cambian lo que ves vos; cada persona del equipo elige lo suyo.</p>
        <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: "0.5px solid var(--border-default)", paddingTop: 10 }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>Explicar los indicadores al pasar el mouse</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Aparece una nube con cómo se calcula y para qué sirve cada indicador. Probalo acá:{" "}
              <AyudaIndicador clave="mortalidad_predestete"><span style={{ textDecoration: "underline dotted", color: "var(--text-secondary)" }}>Mortalidad predestete</span></AyudaIndicador>
            </div>
          </div>
          <div role="radiogroup" aria-label="Explicar los indicadores al pasar el mouse" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)" }}>
            {[{ v: true, t: "Sí" }, { v: false, t: "No" }].map(o => (
              <button key={o.t} type="button" role="radio" aria-checked={ayuda === o.v} disabled={pendiente} onClick={() => cambiar(o.v)}
                style={{ fontSize: 12.5, padding: "5px 18px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: ayuda === o.v ? "var(--bg-surface)" : "transparent", color: ayuda === o.v ? "var(--text-primary)" : "var(--text-muted)", fontWeight: ayuda === o.v ? 600 : 400 }}>
                {o.t}
              </button>
            ))}
          </div>
        </div>
        {(pendiente || msg) && (
          <div role="status" style={{ fontSize: 12, color: msg && !msg.ok ? "var(--danger-text)" : "var(--success-text)", display: "flex", gap: 6, alignItems: "center" }}>
            {pendiente ? <><IconLoader2 size={13} className="animate-spin" aria-hidden /> Guardando…</> : msg?.texto}
          </div>
        )}
      </section>

      <section style={tarjeta} aria-labelledby="metas-gen-titulo">
        <h3 id="metas-gen-titulo" style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Metas de toda la granja</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Las metas de cada fase están en su módulo (Gestación, Maternidad, Iniciación, Engorde).</p>
        {metas}
      </section>
    </div>
  );
}
