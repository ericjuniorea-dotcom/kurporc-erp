"use client";
// Campanita de avisos: cuántas órdenes de trabajo y recepciones de animales esperan en los módulos de la persona.
// Se actualiza al abrir, cada 90 segundos con la pestaña visible y al volver a la app.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell, IconTruckDelivery, IconPackageImport, IconBabyCarriage, IconHeartPlus } from "@tabler/icons-react";
import { misAvisos, type Aviso } from "@/app/acciones/avisos";

type Datos = { total: number; avisos: Aviso[] };
// Las dos campanitas (barra del celular y menú de la computadora) comparten el mismo pedido
let enCurso: { t: number; p: Promise<Datos> } | null = null;
function pedir(): Promise<Datos> {
  if (enCurso && Date.now() - enCurso.t < 15_000) return enCurso.p;
  const p = misAvisos().catch(() => ({ total: 0, avisos: [] }));
  enCurso = { t: Date.now(), p };
  return p;
}

export function CampanaAvisos({ className }: { className?: string }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos>({ total: 0, avisos: [] });
  const [abierta, setAbierta] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 60, left: 8, width: 320 });
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cargar = useCallback((forzar = false) => { if (forzar) enCurso = null; pedir().then(setDatos); }, []);
  useEffect(() => {
    cargar();
    const id = setInterval(() => { if (document.visibilityState === "visible") cargar(true); }, 90_000);
    const alVolver = () => { if (document.visibilityState === "visible") cargar(true); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, [cargar]);
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierta(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    document.addEventListener("pointerdown", fuera); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierta]);

  const abrir = () => {
    const r = boton.current?.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
    setAbierta(a => !a);
    cargar(true);
  };
  const etiqueta = datos.total ? `Avisos: ${datos.total} pendiente${datos.total === 1 ? "" : "s"}` : "Avisos: no hay pendientes";

  return (
    <span className={className} style={{ position: "relative", display: "inline-flex" }}>
      <button ref={boton} type="button" onClick={abrir} aria-label={etiqueta} title={etiqueta} aria-expanded={abierta} className="mobile-topbar-btn kp-campana">
        <IconBell size={19} aria-hidden />
        {datos.total > 0 && (
          <span aria-hidden style={{ position: "absolute", top: 2, right: 2, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: "var(--danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            {datos.total > 99 ? "99+" : datos.total}
          </span>
        )}
      </button>
      {abierta && (
        <div ref={panel} role="dialog" aria-label="Avisos" style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: "70vh", overflowY: "auto", zIndex: 200,
          background: "var(--bg-surface)", border: "0.5px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "0 12px 32px rgba(0,0,0,.18)" }}>
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Avisos {datos.total > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {datos.total} pendiente{datos.total === 1 ? "" : "s"}</span>}
          </div>
          {datos.avisos.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No tenés nada pendiente. 👍</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {datos.avisos.map(a => {
                const Icono = a.tipo === "enviar" ? IconTruckDelivery : a.tipo === "destete" ? IconBabyCarriage : a.tipo === "parto" ? IconHeartPlus : IconPackageImport;
                return (
                  <li key={a.id} style={{ borderTop: "0.5px solid var(--border-default)" }}>
                    <button type="button" onClick={() => { setAbierta(false); router.push(a.href); }} className="kp-fila-link"
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", color: "inherit" }}>
                      <Icono size={17} aria-hidden style={{ color: a.tipo === "enviar" || a.tipo === "parto" ? "var(--warning)" : "var(--danger)", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{a.titulo}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.detalle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
