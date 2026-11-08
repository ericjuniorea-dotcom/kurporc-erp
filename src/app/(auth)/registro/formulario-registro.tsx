"use client";
// Registro (Fase 6): elegir cómo se va a usar KurPorc y crear la cuenta.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconBuildingStore, IconBuildingWarehouse, IconLoader2, IconPig, IconShoppingCart } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { registrarConCorreo } from "@/app/acciones/autenticacion";
import { Aviso } from "@/components/auth/marco-auth";
import { LogoGoogle } from "@/components/auth/logo-google";
import { CasillaContrato } from "@/components/legal/casilla-contrato";

export type Tipo = "COMPRADOR" | "INDIVIDUAL" | "EMPRESA" | "VENDEDOR";

export const TIPOS: { tipo: Tipo; titulo: string; texto: string; icono: typeof IconPig }[] = [
  { tipo: "INDIVIDUAL", titulo: "Mi granja", texto: "La manejo yo: plantel, partos, sanidad y costos.", icono: IconPig },
  { tipo: "EMPRESA", titulo: "Empresa con equipo", texto: "Sumo a mi veterinario y empleados con permisos.", icono: IconBuildingWarehouse },
  { tipo: "VENDEDOR", titulo: "Quiero vender", texto: "Insumos, genética, equipos o servicios en el Mercado.", icono: IconBuildingStore },
  { tipo: "COMPRADOR", titulo: "Solo quiero comprar", texto: "Busco proveedores y precios en el Mercado.", icono: IconShoppingCart },
];

export function FormularioRegistro() {
  const params = useSearchParams();
  const inicial = TIPOS.find(t => t.tipo === params.get("tipo")?.toUpperCase())?.tipo ?? null;
  const [tipo, setTipo] = useState<Tipo | null>(inicial);
  const [acepta, setAcepta] = useState(false);
  const [conCorreo, setConCorreo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [conGoogle, setConGoogle] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const next = `/onboarding${tipo ? `?tipo=${tipo}` : ""}`;

  async function google() {
    setError(null); setConGoogle(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?acepto=1&next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) { setConGoogle(false); setError("No se pudo abrir el ingreso con Google. Probá de nuevo."); }
  }

  function registrar(f: FormData) {
    setError(null);
    const email = String(f.get("email") ?? "");
    iniciar(async () => {
      const r = await registrarConCorreo({
        nombre: String(f.get("nombre") ?? ""), email, clave: String(f.get("clave") ?? ""),
        acepta: acepta as true, tipo: tipo ?? undefined,
      });
      if (r.ok) setEnviado(email); else setError(r.error);
    });
  }

  if (enviado) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Aviso tipo="ok">Te mandamos un correo a <strong>{enviado}</strong>. Abrí el enlace para confirmar tu cuenta y seguir.</Aviso>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          ¿No llegó? Revisá spam. Si ya tenías cuenta con ese correo, <Link href="/login">ingresá</Link> o recuperá tu contraseña.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <Aviso tipo="error">{error}</Aviso>}

      <div role="radiogroup" aria-label="¿Cómo vas a usar KurPorc?" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TIPOS.map(({ tipo: t, titulo, texto, icono: Icono }) => {
          const activo = tipo === t;
          return (
            <button key={t} type="button" role="radio" aria-checked={activo} onClick={() => setTipo(t)}
              style={{
                textAlign: "left", padding: "10px 10px 9px", cursor: "pointer", borderRadius: "var(--radius-md)",
                background: activo ? "var(--accent-subtle, var(--bg-base))" : "var(--bg-base)",
                border: `${activo ? 1 : 0.5}px solid ${activo ? "var(--accent)" : "var(--border-default)"}`,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
              <Icono size={16} aria-hidden style={{ color: activo ? "var(--accent)" : "var(--text-muted)" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</span>
              <span style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--text-muted)" }}>{texto}</span>
            </button>
          );
        })}
      </div>

      <CasillaContrato marcada={acepta} onChange={setAcepta} />

      <button type="button" onClick={google} disabled={conGoogle || !acepta}
        title={acepta ? undefined : "Tildá la casilla de aceptación para continuar"}
        style={{
          width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #DADCE0", borderRadius: "var(--radius-lg)",
          fontSize: 14, fontWeight: 500, cursor: conGoogle || !acepta ? "not-allowed" : "pointer", opacity: conGoogle || !acepta ? 0.55 : 1,
        }}>
        {conGoogle ? <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : <LogoGoogle size={18} />}
        Crear cuenta con Google
      </button>

      {!conCorreo ? (
        <button type="button" className="btn" onClick={() => setConCorreo(true)} style={{ width: "100%", height: 36, justifyContent: "center" }}>
          Usar correo y contraseña
        </button>
      ) : (
        <form action={registrar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label className="kp-label" htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" name="nombre" required maxLength={120} autoComplete="name" className="kp-input" /></div>
          <div><label className="kp-label" htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className="kp-input" /></div>
          <div><label className="kp-label" htmlFor="clave">Contraseña (mínimo 10 caracteres)</label>
            <input id="clave" name="clave" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="kp-input" /></div>
          <button type="submit" className="btn btn-primary" disabled={pendiente || !acepta} style={{ width: "100%", height: 40, justifyContent: "center" }}>
            {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Crear cuenta"}
          </button>
        </form>
      )}

      <p style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
        ¿Ya tenés cuenta? <Link href="/login" style={{ color: "var(--text-primary)", fontWeight: 500 }}>Ingresá</Link>
      </p>
    </div>
  );
}
