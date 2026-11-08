"use client";
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { CasillaContrato } from "@/components/legal/casilla-contrato";
import { aceptarContrato } from "@/app/acciones/legal";
import { signOut } from "@/lib/auth/sesion-cliente";

type Doc = { id: string; hash: string; codigo: string; titulo: string; version: string };

export function FormularioAceptacion({ documentos, destino = "/dashboard" }: { documentos: Doc[]; destino?: string }) {
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function continuar() {
    setError(null);
    iniciar(async () => {
      const r = await aceptarContrato({ acepta, documentos: documentos.map(d => ({ id: d.id, hash: d.hash })) });
      if (r.ok) { window.location.href = destino; return; }
      setError(r.error);
      if (r.recargar) setTimeout(() => window.location.reload(), 2500);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <CasillaContrato marcada={acepta} onChange={setAcepta} />
      <button type="button" className="btn btn-primary" disabled={!acepta || pendiente} onClick={continuar}
        style={{ width: "100%", height: 40, justifyContent: "center" }}>
        {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Aceptar y continuar"}
      </button>
      <button type="button" className="btn" onClick={() => signOut({ callbackUrl: "/login" })}
        style={{ width: "100%", height: 34, justifyContent: "center" }}>
        No acepto, salir
      </button>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Sin aceptar no podés usar KurPorc. Si querés borrar tu cuenta, podés pedirlo desde{" "}
        <a href="/cuenta/privacidad" style={{ color: "var(--text-secondary)" }}>Mi cuenta → Privacidad</a>.
      </p>
    </div>
  );
}
