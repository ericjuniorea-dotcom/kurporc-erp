"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListaMaternidad }           from "@/components/maternidad/lista-maternidad";
import { VisionGeneralMaternidad }   from "@/components/maternidad/vision-general";
import { CentralAnalisisMaternidad } from "@/components/maternidad/central-analisis";
import { IngresosDatos }             from "@/components/maternidad/ingreso-datos";
import { TareasModuloPanel }         from "@/components/shared/tareas-modulo-panel";
import { Topbar }                    from "@/components/layout/topbar";
import { IconHeartPlus }             from "@tabler/icons-react";

const ALLOWED      = [1, 2, 3, 4, 5, 10];
const CAN_REGISTER = [1, 2, 3, 4, 5, 10, 13];
const CAN_APPROVE  = [1, 2, 5];

export default function MaternidadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,        setTab]        = useState("vision");
  const [ingresoTab, setIngresoTab] = useState<"partos" | "datos">("partos");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;

  const canRegister           = session.user.roles.some(r => CAN_REGISTER.includes(r));
  const canApproveAdjustments = session.user.roles.some(r => CAN_APPROVE.includes(r));

  return (
    <>
      <Topbar
        title="Maternidad"
        icon={IconHeartPlus}
        iconColor="var(--accent)"
        tabs={[
          { key: "vision",   label: "Visión general"      },
          { key: "analisis", label: "Central de análisis" },
        ]}
        activeTab={tab === "ingreso" ? "" : tab}
        onTabChange={setTab}
        actions={
          canRegister ? (
            <button
              className="btn btn-primary"
              onClick={() => setTab(tab === "ingreso" ? "vision" : "ingreso")}
            >
              Ingreso de datos
            </button>
          ) : undefined
        }
        configHref="/configuracion?modulo=MATERNIDAD&tab=Metas"
      />

      <div style={{ padding: "16px 20px" }}>
        {tab === "vision" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <VisionGeneralMaternidad />
            <TareasModuloPanel sector="maternidad" accentColor="var(--accent)" />
          </div>
        )}

        {tab === "ingreso" && (
          <>
            {/* Header ingreso */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <Link href="/maternidad/nuevo-parto" className="btn btn-primary" style={{ textDecoration: "none" }}>
                + Registrar parto
              </Link>
            </div>

            {/* Sub-tabs ingreso */}
            <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border-default)", marginBottom: 20 }}>
              {[
                { key: "partos", label: "Partos activos"   },
                { key: "datos",  label: "Ingreso de datos" },
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setIngresoTab(st.key as "partos" | "datos")}
                  style={{
                    padding: "7px 16px", fontSize: 12, background: "none", border: "none",
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontWeight: ingresoTab === st.key ? 600 : 400,
                    color:      ingresoTab === st.key ? "var(--accent)"      : "var(--text-muted)",
                    borderBottom: ingresoTab === st.key ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {ingresoTab === "partos" && (
              <ListaMaternidad
                canRegisterEvents={canRegister}
                canApproveAdjustments={canApproveAdjustments}
              />
            )}
            {ingresoTab === "datos" && <IngresosDatos canRegister={canRegister} />}
          </>
        )}

        {tab === "analisis" && <CentralAnalisisMaternidad />}
      </div>
    </>
  );
}
