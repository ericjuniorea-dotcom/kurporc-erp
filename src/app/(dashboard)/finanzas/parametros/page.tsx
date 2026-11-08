import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PARAMETROS, textoParametro } from "@/lib/finanzas/parametros";
import { FormularioParametros } from "./formulario";

export const metadata = { title: "Parámetros · Finanzas · KurPorc" };

export default async function ParametrosPage() {
  const { org, permisos } = await paginaFinanzas("finanzas.parametros.ver");
  const p = await prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } });
  const valores = Object.fromEntries(PARAMETROS.map(d => [d.clave, textoParametro(d, p ? (p as Record<string, unknown>)[d.clave] : null)]));
  return <FormularioParametros valores={valores} editable={puede(permisos, "finanzas.parametros.editar")} />;
}
