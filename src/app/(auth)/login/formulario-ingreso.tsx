"use client";
// Ingreso (Fase 3): Google, correo y contraseña, o usuario de operario + código de empresa.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import { LogoGoogle } from "@/components/auth/logo-google";
import { CasillaContrato } from "@/components/legal/casilla-contrato";
import { createClient } from "@/lib/supabase/client";
import { ingresarConCorreo, ingresarConUsuario } from "@/app/acciones/autenticacion";
import { Aviso } from "@/components/auth/marco-auth";

type Modo = "correo" | "usuario";

const ERRORES_URL: Record<string, string> = {
  auth: "No se pudo completar el ingreso. Probá de nuevo.",
  inactiva: "Tu cuenta está desactivada. Hablá con el administrador de tu organización.",
};

export function FormularioIngreso() {
  const params = useSearchParams();
  const next = params.get("next");
  const [modo, setModo] = useState<Modo>("correo");
  const [error, setError] = useState<string | null>(ERRORES_URL[params.get("error") ?? ""] ?? null);
  const [verClave, setVerClave] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [conGoogle, setConGoogle] = useState(false);
  // Con Google se puede crear una cuenta nueva: sin aceptar no se habilita (decisión 18)
  const [acepta, setAcepta] = useState(false);

  async function google() {
    setError(null);
    setConGoogle(true);
    const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?acepto=1&next=${encodeURIComponent(destino)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setConGoogle(false);
      setError("No se pudo abrir el ingreso con Google. Probá de nuevo.");
    }
  }

  function enviar(form: FormData) {
    setError(null);
    iniciar(async () => {
      const clave = String(form.get("clave") ?? "");
      const r = modo === "correo"
        ? await ingresarConCorreo({ email: String(form.get("email") ?? ""), clave, next })
        : await ingresarConUsuario({ usuario: String(form.get("usuario") ?? ""), codigo: String(form.get("codigo") ?? ""), clave, next });
      if (r.ok) window.location.href = r.destino ?? "/dashboard";
      else setError(r.error);
    });
  }

  const ocupado = pendiente || conGoogle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <CasillaContrato marcada={acepta} onChange={setAcepta} />

      <button type="button" onClick={google} disabled={ocupado || !acepta} aria-label="Continuar con Google"
        title={acepta ? undefined : "Tildá la casilla de aceptación para continuar"}
        style={{
          width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #DADCE0", borderRadius: "var(--radius-lg)",
          fontSize: 14, fontWeight: 500, cursor: ocupado || !acepta ? "not-allowed" : "pointer", opacity: ocupado || !acepta ? 0.55 : 1,
        }}>
        {conGoogle ? <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : <LogoGoogle size={18} />}
        Continuar con Google
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ flex: 1, height: 0.5, background: "var(--border-default)" }} />
        o
        <span style={{ flex: 1, height: 0.5, background: "var(--border-default)" }} />
      </div>

      <div role="tablist" aria-label="Forma de ingreso" style={{ display: "flex", gap: 4, background: "var(--bg-base)", borderRadius: "var(--radius-md)", padding: 3 }}>
        {([["correo", "Correo"], ["usuario", "Usuario de operario"]] as const).map(([m, etiqueta]) => (
          <button key={m} type="button" role="tab" aria-selected={modo === m}
            onClick={() => { setModo(m); setError(null); }}
            style={{
              flex: 1, height: 30, fontSize: 12, border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)",
              background: modo === m ? "var(--bg-surface)" : "transparent",
              color: modo === m ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: modo === m ? 500 : 400,
            }}>
            {etiqueta}
          </button>
        ))}
      </div>

      <form action={enviar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {modo === "correo" ? (
          <div>
            <label className="kp-label" htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254}
              placeholder="nombre@correo.com" className="kp-input" />
          </div>
        ) : (
          <>
            <div>
              <label className="kp-label" htmlFor="usuario">Usuario</label>
              <input id="usuario" name="usuario" autoComplete="username" required maxLength={40}
                autoCapitalize="none" placeholder="ej. operario.maternidad" className="kp-input" />
            </div>
            <div>
              <label className="kp-label" htmlFor="codigo">Código de empresa</label>
              <input id="codigo" name="codigo" required maxLength={12} autoCapitalize="characters"
                placeholder="Te lo da tu administrador" className="kp-input" style={{ textTransform: "uppercase" }} />
            </div>
          </>
        )}

        <div>
          <label className="kp-label" htmlFor="clave">Contraseña</label>
          <div style={{ position: "relative" }}>
            <input id="clave" name="clave" type={verClave ? "text" : "password"} autoComplete="current-password"
              required maxLength={200} placeholder="••••••••••" className="kp-input" style={{ paddingRight: 36 }} />
            <button type="button" onClick={() => setVerClave(!verClave)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 0 }}>
              {verClave ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={ocupado} className="btn btn-primary"
          style={{ width: "100%", height: 40, justifyContent: "center" }}>
          {pendiente ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> Ingresando…</> : "Ingresar"}
        </button>
      </form>

      {modo === "correo" && (
        <Link href="/recuperar" style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
          Olvidé mi contraseña
        </Link>
      )}
    </div>
  );
}
