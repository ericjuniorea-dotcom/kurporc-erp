"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { autorizarAdmin, quitarAdmin } from "@/app/acciones/admin";

type Admin = { userId: string; nivel: string; nombre: string; email: string; otorgadoPor: string; desde: string };
const NIVEL: Record<string, string> = {
  TOTAL: "Total: todo, incluido autorizar o quitar administradores",
  SOPORTE: "Soporte: lee los datos de una organización con motivo",
  MODERACION: "Moderación: tiendas, publicaciones y reseñas",
  LECTURA: "Lectura: solo números agregados de la plataforma",
};
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function PanelAdministradores({ admins, yo, puedeGestionar }: { admins: Admin[]; yo: string; puedeGestionar: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nivel, setNivel] = useState("SOPORTE");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setMsg(null);
    iniciar(async () => { const r = await fn(); setMsg(r.ok ? { tipo: "ok", texto: ok } : { tipo: "error", texto: r.error ?? "Error" }); if (r.ok) router.refresh(); });
  };

  return (
    <>
      <div style={{ ...tarjeta, padding: 14, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Nadie puede ser administrador de la plataforma sin que lo autorice un Super Administrador <strong>Total</strong>. La base de datos lo exige
        (no solo esta pantalla), guarda quién lo autorizó y nunca deja la plataforma sin un administrador Total.
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Persona</th><th>Nivel</th><th>Autorizado por</th><th>Desde</th><th></th></tr></thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.userId}>
                <td><div style={{ color: "var(--text-primary)" }}>{a.nombre}{a.userId === yo ? " (vos)" : ""}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.email}</div></td>
                <td>{a.nivel}</td>
                <td>{a.otorgadoPor}</td>
                <td>{a.desde.slice(8, 10)}/{a.desde.slice(5, 7)}/{a.desde.slice(0, 4)}</td>
                <td style={{ textAlign: "right" }}>
                  {puedeGestionar && a.userId !== yo && (
                    <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} disabled={pendiente}
                      onClick={() => { if (confirm(`¿Quitarle el acceso de plataforma a ${a.nombre}?`)) correr(() => quitarAdmin(a.userId), "Acceso de plataforma quitado."); }}>
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {puedeGestionar && (
        <form onSubmit={e => { e.preventDefault(); correr(() => autorizarAdmin({ email, nivel: nivel as "SOPORTE" }), `${email} ahora es administrador ${nivel}.`); }}
          style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Autorizar a otra persona</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tiene que haber creado su cuenta en KurPorc. Para entrar al panel va a necesitar el segundo factor.</div>
          <input className="kp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required aria-label="Correo" />
          <select className="kp-input" value={nivel} onChange={e => setNivel(e.target.value)} aria-label="Nivel">
            {Object.entries(NIVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="submit" className="btn btn-primary" disabled={pendiente || !email} style={{ height: 34, justifyContent: "center" }}>
            {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Autorizar
          </button>
        </form>
      )}
    </>
  );
}
