"use client";
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { MarcoAuth, Aviso } from "@/components/auth/marco-auth";
import { cambiarClave } from "@/app/acciones/autenticacion";

export default function CambiarClavePage() {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <MarcoAuth titulo="Elegí una contraseña nueva" subtitulo="Mínimo 10 caracteres. Mejor una frase que solo vos recuerdes.">
      <form
        action={(f) => {
          setError(null);
          iniciar(async () => {
            const r = await cambiarClave({ clave: String(f.get("clave") ?? ""), repetir: String(f.get("repetir") ?? "") });
            if (r.ok) window.location.href = r.destino ?? "/dashboard"; else setError(r.error);
          });
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div>
          <label className="kp-label" htmlFor="clave">Contraseña nueva</label>
          <input id="clave" name="clave" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="kp-input" />
        </div>
        <div>
          <label className="kp-label" htmlFor="repetir">Repetila</label>
          <input id="repetir" name="repetir" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="kp-input" />
        </div>
        <button type="submit" disabled={pendiente} className="btn btn-primary" style={{ width: "100%", height: 36, justifyContent: "center" }}>
          {pendiente ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Guardar contraseña"}
        </button>
      </form>
    </MarcoAuth>
  );
}
