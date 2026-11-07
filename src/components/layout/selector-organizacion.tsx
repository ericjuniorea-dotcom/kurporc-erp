"use client";
// Selector de perfil activo (OrgSwitcher, Fase 3): cambia de granja o empresa sin volver a ingresar.
import { useTransition } from "react";
import type { Membresia } from "@/lib/auth/config";
import { cambiarOrganizacion } from "@/app/acciones/organizacion";

export function SelectorOrganizacion({ activa, membresias }: { activa: string; membresias: Membresia[] }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <select
      aria-label="Organización activa"
      value={activa}
      disabled={pendiente}
      onChange={(e) => {
        const id = e.target.value;
        iniciar(async () => {
          const r = await cambiarOrganizacion(id);
          if (r.ok) window.location.href = "/dashboard";
          else alert(r.error ?? "No se pudo cambiar de organización");
        });
      }}
      style={{
        width: "100%", maxWidth: 190, fontSize: 11, color: "var(--text-secondary)",
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-md)", padding: "3px 6px", cursor: "pointer",
      }}
    >
      {membresias.map((m) => (
        <option key={m.organizacionId} value={m.organizacionId}>
          {m.nombre}{m.rol ? ` · ${m.rol}` : ""}
        </option>
      ))}
    </select>
  );
}
