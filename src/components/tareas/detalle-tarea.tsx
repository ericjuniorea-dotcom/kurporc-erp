"use client";
// Detalle de una orden de trabajo al tocarla: qué pasa, qué hay que hacer, «Ir a corregir» (lleva al lugar exacto:
// ficha de la cerda, lote o módulo) y «Listo» para cerrarla una vez hecha.
import Link from "next/link";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";

export type DestinoTarea = { href: string; etiqueta: string } | null | undefined;

export function DetalleTarea({ descripcion, instrucciones, destino, hecha, onListo, ocupado }: {
  descripcion?: string | null; instrucciones?: string | null; destino: DestinoTarea;
  hecha: boolean; onListo: () => void; ocupado?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 10px 10px 36px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
      {descripcion && <div><strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Qué pasa: </strong>{descripcion}</div>}
      {instrucciones && <div><strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Qué hacer: </strong>{instrucciones}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {destino && (
          <Link href={destino.href} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12.5 }}>
            {destino.etiqueta} <IconArrowRight size={14} aria-hidden />
          </Link>
        )}
        {!hecha && (
          <button type="button" className="btn" disabled={ocupado} onClick={onListo} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <IconCheck size={14} aria-hidden /> Listo, ya lo corregí
          </button>
        )}
      </div>
      {!hecha && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Cuando lo corrijas, tocá «Listo» y la orden se cierra (queda quién la cerró).</span>}
    </div>
  );
}
