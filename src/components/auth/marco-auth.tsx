// Marco común de las pantallas de acceso: logo, tarjeta y pie.
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import { CORREO_SOPORTE } from "@/lib/contacto";

export function MarcoAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: 16 }}>
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 28 }}>
          <KurPorcLogo size="lg" showTagline />
        </div>
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 4px" }}>{titulo}</h1>
            {subtitulo && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{subtitulo}</div>}
          </div>
          {children}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
          KurPorc · Inteligencia para la producción porcina
          <div style={{ marginTop: 4 }}>¿Necesitás ayuda? <a href={`mailto:${CORREO_SOPORTE}`} style={{ color: "var(--accent-text)" }}>{CORREO_SOPORTE}</a></div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "ok"; children: React.ReactNode }) {
  return (
    <div className={`kp-alert ${tipo === "error" ? "kp-alert-danger" : "kp-alert-info"}`} role={tipo === "error" ? "alert" : "status"} style={{ marginBottom: 14 }}>
      {tipo === "error" ? <IconAlertTriangle size={13} aria-hidden /> : <IconCircleCheck size={13} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}
