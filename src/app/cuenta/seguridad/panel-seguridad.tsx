"use client";
// Segundo factor (TOTP), cambio de contraseña y cierre de sesión en todos los dispositivos.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconLoader2, IconShieldCheck, IconShieldOff } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/sesion-cliente";
import { Aviso } from "@/components/auth/marco-auth";

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };

const tarjeta: React.CSSProperties = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-lg)", padding: 18, display: "flex", flexDirection: "column", gap: 12,
};
const tituloTarjeta: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 };
const texto: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 };

export function PanelSeguridad({ esGestionada }: { esGestionada: boolean }) {
  const supabase = createClient();
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [alta, setAlta] = useState<{ id: string; qr: string; secreto: string } | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactores((data?.totp ?? []) as Factor[]);
  }, [supabase]);

  useEffect(() => { cargar(); }, [cargar]);

  async function empezarAlta() {
    setMensaje(null); setOcupado(true);
    // Limpia altas a medio terminar (factores sin verificar)
    const { data: todos } = await supabase.auth.mfa.listFactors();
    for (const f of todos?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `KurPorc ${new Date().toLocaleDateString("es-PY")}` });
    setOcupado(false);
    if (error || !data) { setMensaje({ tipo: "error", texto: "No se pudo empezar la activación. Probá de nuevo." }); return; }
    setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  }

  async function confirmarAlta(form: FormData) {
    if (!alta) return;
    const codigo = String(form.get("codigo") ?? "").replace(/\s/g, "");
    setOcupado(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code: codigo });
    setOcupado(false);
    if (error) { setMensaje({ tipo: "error", texto: "Código incorrecto. Revisá que la hora del celular esté bien y probá con el código nuevo." }); return; }
    setAlta(null);
    setMensaje({ tipo: "ok", texto: "Listo: la verificación en dos pasos quedó activada." });
    cargar();
  }

  async function quitar(id: string) {
    if (!confirm("¿Desactivar la verificación en dos pasos? Tu cuenta va a quedar menos protegida.")) return;
    setOcupado(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setOcupado(false);
    setMensaje(error
      ? { tipo: "error", texto: "Para desactivarla tenés que haber ingresado con el código en esta sesión. Salí y volvé a entrar." }
      : { tipo: "ok", texto: "Verificación en dos pasos desactivada." });
    cargar();
  }

  const activo = (factores ?? []).some(f => f.status === "verified");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <section style={tarjeta}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activo ? <IconShieldCheck size={18} style={{ color: "var(--success)" }} aria-hidden /> : <IconShieldOff size={18} style={{ color: "var(--text-muted)" }} aria-hidden />}
          <h2 style={tituloTarjeta}>Verificación en dos pasos</h2>
        </div>
        <p style={texto}>
          Además de la contraseña, te pide un código de 6 números que cambia cada 30 segundos en una app del celular
          (Google Authenticator, Microsoft Authenticator o similar). Así, aunque alguien sepa tu contraseña, no puede entrar.
          Recomendado para todos, y obligatorio si manejás finanzas, sueldos o el equipo.
        </p>

        {factores === null ? (
          <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} aria-hidden />
        ) : activo ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--success-text, var(--text-primary))" }}>Activada</span>
            <button type="button" className="btn" disabled={ocupado} onClick={() => quitar(factores.find(f => f.status === "verified")!.id)} style={{ height: 30, fontSize: 12 }}>
              Desactivar
            </button>
          </div>
        ) : alta ? (
          <form action={confirmarAlta} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={texto}>1. Abrí la app de autenticación y escaneá este código QR.</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR en data: URI generado por Supabase */}
            <img src={alta.qr} alt="Código QR para la app de autenticación" width={180} height={180}
              style={{ background: "#fff", padding: 8, borderRadius: "var(--radius-md)", alignSelf: "center" }} />
            <p style={{ ...texto, fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>
              ¿No podés escanear? Cargá esta clave a mano: <code>{alta.secreto}</code>
            </p>
            <p style={texto}>2. Escribí el código de 6 números que muestra la app.</p>
            <input name="codigo" inputMode="numeric" autoComplete="one-time-code" required maxLength={7}
              placeholder="123456" className="kp-input" style={{ letterSpacing: "0.3em", textAlign: "center" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={ocupado} style={{ flex: 1, height: 34, justifyContent: "center" }}>Activar</button>
              <button type="button" className="btn" onClick={() => setAlta(null)} style={{ height: 34 }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-primary" disabled={ocupado} onClick={empezarAlta} style={{ alignSelf: "flex-start", height: 32 }}>
            Activar verificación en dos pasos
          </button>
        )}
      </section>

      {!esGestionada && (
        <section style={tarjeta}>
          <h2 style={tituloTarjeta}>Contraseña</h2>
          <p style={texto}>Si entrás con Google, no necesitás contraseña de KurPorc. Si querés tener una igual, la podés crear o cambiar acá.</p>
          <Link href="/cuenta/cambiar-clave" className="btn" style={{ alignSelf: "flex-start", height: 32 }}>Cambiar contraseña</Link>
        </section>
      )}

      <section style={tarjeta}>
        <h2 style={tituloTarjeta}>Sesiones abiertas</h2>
        <p style={texto}>Si usaste KurPorc en un celular o computadora que ya no tenés, o que no es tuyo, cerrá todas las sesiones.</p>
        <button type="button" className="btn" onClick={() => {
          if (confirm("Se va a cerrar tu sesión en todos los dispositivos, incluido este. ¿Seguís?")) signOut({ global: true, callbackUrl: "/login" });
        }} style={{ alignSelf: "flex-start", height: 32 }}>
          Cerrar sesión en todos los dispositivos
        </button>
      </section>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
