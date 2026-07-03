"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IconCoin, IconTools } from "@tabler/icons-react";

const ALLOWED = [1, 2, 9];

export default function FinancieroPage() {
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
      <Topbar title="Financiero" icon={IconCoin} iconColor="var(--success)" />
      <div style={{ padding: "16px 20px" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "48px 24px", textAlign: "center",
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "var(--radius-lg)",
            background: "var(--success-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <IconTools size={22} style={{ color: "var(--success)" }} aria-hidden />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Módulo en desarrollo
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.6 }}>
            El módulo Financiero con gestión de ventas, gastos y análisis de rentabilidad
            estará disponible próximamente.
          </div>
        </div>
      </div>
    </>
  );
}
