import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PanelRevision } from "./panel";

export const metadata = { title: "Importación · Finanzas · KurPorc" };

export default async function ImportacionPage() {
  const { org, permisos } = await paginaFinanzas("finanzas.importar.ejecutar");
  const [filas, originales, importados] = await Promise.all([
    prisma.importacionFilaOriginal.findMany({ where: { organizacionId: org, hoja: "CUENTAS POR PAGAR · REVISIÓN" }, orderBy: { fila: "asc" } }),
    prisma.importacionFilaOriginal.count({ where: { organizacionId: org, hoja: "DATOS ORIGINALES" } }),
    prisma.movimiento.count({ where: { organizacionId: org, origen: "IMPORTACION" } }),
  ]);
  return (
    <PanelRevision
      editable={puede(permisos, "finanzas.importar.ejecutar")}
      resumen={{ importados, originales }}
      filas={filas.map(f => ({ id: f.id.toString(), fila: f.fila, datos: f.datos as Record<string, string | number | null> }))}
    />
  );
}
