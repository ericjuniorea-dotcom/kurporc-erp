"use client";
// Paso del segundo factor al ingresar (TOTP). Lo piden los layouts cuando la
// persona lo tiene activado y la sesión todavía es aal1.
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { MarcoAuth, Aviso } from "@/components/auth/marco-auth";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/sesion-cliente";

export default function SegundoFactorPage() {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function verificar(form: FormData) {
    setError(null);
    const codigo = String(form.get("codigo") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(codigo)) { setError("El código tiene 6 números."); return; }
    iniciar(async () => {
      const supabase = createClient();
      const { data: factores } = await supabase.auth.mfa.listFactors();
      const totp = factores?.totp?.[0];
      if (!totp) { window.location.href = "/dashboard"; return; }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codigo });
      if (error) { setError("Código incorrecto o vencido. Mirá la app y probá con el código nuevo."); return; }
      window.location.href = "/dashboard";
    });
  }

  return (
    <MarcoAuth titulo="Verificación en dos pasos" subtitulo="Ingresá el código de 6 números de tu app de autenticación">
      <form action={verificar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <input name="codigo" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} autoFocus
          placeholder="123456" className="kp-input" style={{ fontSize: 18, letterSpacing: "0.3em", textAlign: "center" }} />
        <button type="submit" disabled={pendiente} className="btn btn-primary" style={{ width: "100%", height: 36, justifyContent: "center" }}>
          {pendiente ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Verificar"}
        </button>
        <button type="button" className="btn" onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ width: "100%", height: 32, justifyContent: "center" }}>
          Salir
        </button>
      </form>
    </MarcoAuth>
  );
}
