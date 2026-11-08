"use client";
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { aceptarInvitacion } from "@/app/acciones/equipo";

export function BotonAceptarInvitacion({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button type="button" className="btn btn-primary" disabled={pendiente} style={{ height: 40, justifyContent: "center" }}
        onClick={() => iniciar(async () => {
          const r = await aceptarInvitacion({ token });
          if (r.ok) window.location.href = r.destino; else setError(r.error);
        })}>
        {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Aceptar invitación"}
      </button>
    </>
  );
}
