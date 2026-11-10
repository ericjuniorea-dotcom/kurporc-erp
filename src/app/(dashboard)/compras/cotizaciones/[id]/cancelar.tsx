"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarSolicitud } from "@/app/acciones/compras";

export function CancelarSolicitud({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente}
        onClick={() => { if (confirm("¿Cancelar este pedido de cotización? Las tiendas ya no podrán responder.")) iniciar(async () => { const r = await cancelarSolicitud(id); if (r.ok) router.refresh(); else setError(r.error); }); }}>
        Cancelar solicitud
      </button>
      {error && <div style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
    </>
  );
}
