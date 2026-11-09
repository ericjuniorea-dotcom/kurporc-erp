// Fase 10 · Cerdas paradas desde Gestación: días y acciones; con guaraníes solo si además ve Finanzas.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { detalleCerda, resumenParadas } from "@/lib/cerdas-paradas/datos";
import { VistaParadas } from "@/components/cerdas-paradas/vista";
import { EncabezadoParadas } from "./encabezado";

export const metadata = { title: "Cerdas paradas · Gestación · KurPorc" };

export default async function CerdasParadasGestacion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puedeAlguno(permisos, ["gestacion.cerdas_paradas.ver", "finanzas.cerdas_paradas.ver"])) redirect("/gestacion");
  const org = session.user.tenantId, sp = await searchParams;
  const [r, detalle] = await Promise.all([resumenParadas(org), sp.cerda ? detalleCerda(org, sp.cerda) : null]);
  return (
    <>
      <EncabezadoParadas />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1280 }}>
        <VistaParadas r={r} conMontos={puede(permisos, "finanzas.cerdas_paradas.ver")} base="/gestacion/cerdas-paradas" puedeTarea={puede(permisos, "tareas.tareas.crear")} detalle={detalle} />
      </div>
    </>
  );
}
