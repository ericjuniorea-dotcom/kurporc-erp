"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { FormNuevoServicio } from "@/components/gestacion/form-nuevo-servicio";
import { IconHeart, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

const ALLOWED = [1, 2, 3, 4, 5, 11, 13];

export default function NuevoServicioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/gestacion");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;

  return (
    <>
      <Topbar
        title="Gestación"
        icon={IconHeart}
        iconColor="var(--success)"
        actions={
          <Link
            href="/gestacion"
            className="btn"
            style={{ textDecoration: "none", fontSize: 12 }}
          >
            <IconArrowLeft size={13} /> Volver
          </Link>
        }
      />

      <div style={{ padding: "24px 32px", maxWidth: 640 }}>
        {/* Encabezado de sección */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Registrar servicio / inseminación
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Inseminación artificial o monta natural
          </p>
        </div>

        <FormNuevoServicio />
      </div>
    </>
  );
}
