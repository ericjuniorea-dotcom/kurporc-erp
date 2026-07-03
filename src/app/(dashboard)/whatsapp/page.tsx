"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IconBrandWhatsapp, IconCheck, IconInfoCircle } from "@tabler/icons-react";

const ALLOWED = [1, 2];
const WA_GREEN = "#25d366";

const flows = [
  { num: "1", name: "Registrar parto",        desc: "Cerda, lechones vivos/muertos, peso total de camada" },
  { num: "2", name: "Registrar muerte lechón", desc: "Cerda, cantidad y causa de muerte" },
  { num: "3", name: "Registrar pesaje",        desc: "Lote de recría, cantidad y peso total" },
];

const commands = [
  { cmd: "MENU o MENÚ", desc: "Muestra el menú principal" },
  { cmd: "CANCELAR",    desc: "Cancela la operación en curso" },
  { cmd: "SI / NO",     desc: "Confirma o rechaza el registro (Regla 6)" },
];

export default function WhatsAppPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && !session.user.roles.some((r) => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;

  return (
    <>
      <Topbar
        title="WhatsApp bot"
        icon={IconBrandWhatsapp}
        iconColor={WA_GREEN}
        actions={
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "var(--success-subtle)", border: "0.5px solid var(--success-border)",
            color: "var(--success-text)", borderRadius: 99,
            fontSize: 11, fontWeight: 500, padding: "3px 10px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: WA_GREEN, display: "inline-block" }} />
            Activo
          </span>
        }
      />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Webhook info */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          background: "var(--info-subtle)", border: "0.5px solid var(--info-border)",
          borderRadius: "var(--radius-lg)", padding: "10px 12px",
        }}>
          <IconInfoCircle size={14} style={{ color: "var(--info)", marginTop: 1, flexShrink: 0 }} aria-hidden />
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--info-text)", marginBottom: 3 }}>
              Configuración del webhook
            </div>
            <div style={{ fontSize: 11, color: "var(--info-text)" }}>
              Webhook URL:{" "}
              <code style={{
                background: "var(--bg-overlay)", borderRadius: 4,
                padding: "1px 6px", fontSize: 10, fontFamily: "monospace",
              }}>/api/whatsapp/webhook</code>
              {" — "}Token:{" "}
              <code style={{
                background: "var(--bg-overlay)", borderRadius: 4,
                padding: "1px 6px", fontSize: 10, fontFamily: "monospace",
              }}>kurporc_verify</code>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Flujos disponibles */}
          <div style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 12px", borderBottom: "0.5px solid var(--border-default)",
              background: "var(--bg-elevated)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)" }}>
                Flujos disponibles
              </span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {flows.map((f) => (
                <div key={f.num} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "7px 12px",
                }}>
                  <span style={{
                    display: "flex", width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    alignItems: "center", justifyContent: "center",
                    background: WA_GREEN, color: "#fff", fontSize: 10, fontWeight: 700,
                  }}>
                    {f.num}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comandos */}
          <div style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 12px", borderBottom: "0.5px solid var(--border-default)",
              background: "var(--bg-elevated)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)" }}>
                Comandos globales
              </span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {commands.map((c) => (
                <div key={c.cmd} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 12px",
                }}>
                  <code style={{
                    background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
                    borderRadius: 4, padding: "2px 6px", fontSize: 10,
                    color: "var(--text-primary)", fontFamily: "monospace", flexShrink: 0,
                  }}>{c.cmd}</code>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.desc}</span>
                </div>
              ))}
            </div>
            <div style={{
              margin: "0 10px 10px",
              display: "flex", alignItems: "flex-start", gap: 6,
              background: "var(--warning-subtle)", border: "0.5px solid var(--warning-border)",
              borderRadius: "var(--radius-md)", padding: "8px 10px",
              fontSize: 11, color: "var(--warning-text)",
            }}>
              <IconCheck size={12} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden />
              <span><strong>Regla 6:</strong> Ningún flujo guarda datos sin confirmación explícita con SI o NO.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
