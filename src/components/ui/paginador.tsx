"use client";
// Paginador de listas dentro de un recuadro (inconsistencias, alertas…): muestra pocas filas por página para que el
// recuadro mantenga el mismo alto que los demás de la pantalla, con «Anterior / Siguiente».
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export function usePaginas<T>(items: T[], porPagina = 5) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  // Si la lista se achica (se corrigió algo), no quedar en una página vacía
  useEffect(() => { if (pagina > paginas - 1) setPagina(paginas - 1); }, [pagina, paginas]);
  const actual = Math.min(pagina, paginas - 1);
  return { visibles: items.slice(actual * porPagina, actual * porPagina + porPagina), pagina: actual, paginas, setPagina, total: items.length, porPagina };
}

export function Paginador({ pagina, paginas, setPagina, total, porPagina }: { pagina: number; paginas: number; setPagina: (n: number) => void; total: number; porPagina: number }) {
  if (paginas <= 1) return null;
  const desde = pagina * porPagina + 1, hasta = Math.min(total, desde + porPagina - 1);
  const boton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 10px", fontSize: 12, borderRadius: "var(--radius-md)",
    border: "0.5px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer", minHeight: 0 };
  return (
    <nav aria-label="Páginas" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: "0.5px solid var(--border-default)", marginTop: "auto", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{desde}–{hasta} de {total.toLocaleString("es-PY")}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button type="button" style={{ ...boton, opacity: pagina === 0 ? 0.45 : 1 }} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior">
          <IconChevronLeft size={14} aria-hidden /> Anterior
        </button>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{pagina + 1} de {paginas}</span>
        <button type="button" style={{ ...boton, opacity: pagina >= paginas - 1 ? 0.45 : 1 }} disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)} aria-label="Página siguiente">
          Siguiente <IconChevronRight size={14} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
