"use client";
import { useState, useTransition } from "react";
import { guardarCausa } from "@/app/acciones/finanzas";

/** La causa escrita al lado del número: se guarda al salir del campo. */
export function CampoCausa({ categoriaId, mes, inicial, editable }: { categoriaId: string; mes: number; inicial: string; editable: boolean }) {
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [estado, setEstado] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (!editable) return <span style={{ fontSize: 12 }}>{inicial || "—"}</span>;
  return (
    <div>
      <input className="kp-input" value={texto} maxLength={500} placeholder="¿Por qué se desvió?" style={{ height: 30, fontSize: 12, borderColor: !texto ? "var(--danger)" : undefined }}
        onChange={e => setTexto(e.target.value)}
        onBlur={() => {
          if (texto === guardado) return;
          iniciar(async () => {
            const r = await guardarCausa(categoriaId, mes, texto);
            if (r.ok) { setGuardado(texto); setEstado("Guardado"); } else setEstado(r.error);
          });
        }} aria-label="Causa del desvío" />
      {(pendiente || estado) && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{pendiente ? "Guardando…" : estado}</div>}
    </div>
  );
}
