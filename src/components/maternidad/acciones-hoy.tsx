"use client";
// Maternidad · «Acciones para hoy»: lo que hay que hacer, bien a la vista (destetes con aviso previo, partos, recepciones).
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconBabyCarriage, IconClockHour4, IconHeartPlus, IconPackageImport } from "@tabler/icons-react";
import type { AccionMaternidad } from "@/lib/maternidad/acciones";

const ESTILO = {
  atrasado: { fondo: "var(--danger-subtle)", borde: "var(--danger)", texto: "var(--danger-text)", chip: "Atrasado" },
  hoy: { fondo: "var(--warning-subtle)", borde: "var(--warning)", texto: "var(--warning-text)", chip: "Hoy" },
  pronto: { fondo: "var(--info-subtle)", borde: "var(--info)", texto: "var(--info-text)", chip: "Próximo" },
} as const;
const ICONO = { destete: IconBabyCarriage, parto: IconHeartPlus, recibir: IconPackageImport };

export function AccionesHoyMaternidad() {
  const [acciones, setAcciones] = useState<AccionMaternidad[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const cargar = () => fetch("/api/maternidad/acciones", { cache: "no-store" }).then(r => r.ok ? r.json() : []).then(a => { if (vivo) setAcciones(a); }).catch(() => {});
    cargar();
    const id = setInterval(() => { if (document.visibilityState === "visible") cargar(); }, 5 * 60_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  if (!acciones) return null;
  if (acciones.length === 0) return (
    <div className="kp-alert kp-alert-ok" style={{ fontSize: 13 }}><IconClockHour4 size={15} aria-hidden /> No hay destetes ni partos en los próximos días.</div>
  );
  return (
    <section aria-labelledby="acc-mat" style={{ background: "var(--bg-surface)", border: "1px solid var(--accent-border, var(--border-strong))", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconAlertTriangle size={18} style={{ color: "var(--accent)" }} aria-hidden />
        <h3 id="acc-mat" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Acciones para hoy y los próximos días</h3>
        <span className="badge badge-danger" style={{ marginLeft: "auto" }}>{acciones.length}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
        {acciones.map(a => {
          const e = ESTILO[a.nivel]; const I = ICONO[a.tipo];
          return (
            <article key={a.id} style={{ background: e.fondo, borderLeft: `4px solid ${e.borde}`, borderRadius: "var(--radius-md)", padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <I size={22} style={{ color: e.texto, flexShrink: 0, marginTop: 1 }} aria-hidden />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: e.texto }}>{e.chip}</span>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{a.titulo}</strong>
                </div>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{a.detalle}</span>
                {a.tipo === "destete" && <Link href="/maternidad?tab=ingreso" style={{ fontSize: 12, color: e.texto, fontWeight: 600 }}>Registrar destete →</Link>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
