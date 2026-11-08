import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { controlesLibro, evaluarCierre } from "@/lib/finanzas/control";
import { nombreMes } from "@/lib/finanzas/calculos";
import { sumarMeses } from "@/lib/finanzas/planificacion";
import { PanelCierre } from "./panel";

export const metadata = { title: "Cierre de mes · Finanzas · KurPorc" };

export default async function CierrePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, permisos, mesCorte } = await paginaFinanzas("finanzas.cierre.cerrar");
  const sp = await searchParams;
  const mes = /^\d{6}$/.test(sp.mes ?? "") ? Number(sp.mes) : sumarMeses(mesCorte, -1);
  const [pasos, controles, cierres] = await Promise.all([
    evaluarCierre(org, mes), controlesLibro(org),
    prisma.cierreMes.findMany({ where: { organizacionId: org, unidadId: null }, orderBy: { mes: "desc" }, take: 24 }),
  ]);
  const actual = cierres.find(c => c.mes === mes);
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(mesCorte, -i));
  return (
    <PanelCierre
      mes={mes} meses={meses.map(m => ({ mes: m, nombre: nombreMes(m), estado: cierres.find(c => c.mes === m)?.estado ?? "ABIERTO" }))}
      estado={actual?.estado ?? "ABIERTO"} cerradoEn={actual?.cerradoEn?.toISOString() ?? null} motivoReapertura={actual?.motivoReapertura ?? null}
      pasos={pasos} controles={controles} puedeReabrir={puede(permisos, "finanzas.cierre.reabrir")}
    />
  );
}
