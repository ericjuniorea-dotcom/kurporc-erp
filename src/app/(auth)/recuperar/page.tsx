"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";
import { MarcoAuth, Aviso } from "@/components/auth/marco-auth";
import { recuperarClave } from "@/app/acciones/autenticacion";

export default function RecuperarPage() {
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendiente, iniciar] = useTransition();

  return (
    <MarcoAuth titulo="Recuperar contraseña" subtitulo="Te mandamos un enlace a tu correo para elegir una nueva">
      {enviado ? (
        <Aviso tipo="ok">
          Si el correo está registrado, en unos minutos te llega el enlace. Revisá también la carpeta de spam.
        </Aviso>
      ) : (
        <form
          action={(f) => {
            setError(null);
            iniciar(async () => {
              const r = await recuperarClave({ email: String(f.get("email") ?? "") });
              if (r.ok) setEnviado(true); else setError(r.error);
            });
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div>
            <label className="kp-label" htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="kp-input" />
          </div>
          <button type="submit" disabled={pendiente} className="btn btn-primary" style={{ width: "100%", height: 36, justifyContent: "center" }}>
            {pendiente ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Enviar enlace"}
          </button>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            ¿Entrás con usuario de operario? Pedile a tu administrador que te genere una contraseña nueva.
          </div>
        </form>
      )}
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <Link href="/login" style={{ fontSize: 12, color: "var(--text-secondary)" }}>Volver a ingresar</Link>
      </div>
    </MarcoAuth>
  );
}
