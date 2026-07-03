"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IconTruck, IconTools } from "@tabler/icons-react";

const ALLOWED = [1, 2, 3, 7];

export default function LogisticaPage() {
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
      <Topbar title="Logística" icon={IconTruck} iconColor="var(--text-secondary)" />
      <div style={{ padding: "16px 20px" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "48px 24px", textAlign: "center",
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "var(--radius-lg)",
            background: "var(--bg-overlay)", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <IconTools size={22} style={{ color: "var(--text-secondary)" }} aria-hidden />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Módulo en desarrollo
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.6 }}>
            Logística estará disponible en la próxima versión.
            El stock de materias primas está disponible en Balanceado.
          </div>
        </div>
      </div>
    </>
  );
}
