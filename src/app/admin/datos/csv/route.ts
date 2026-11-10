// Exportación a CSV del explorador de datos (Fase 11). Valida nivel, segundo factor y motivo vigente,
// y registra la exportación con la cantidad de filas.
import { NextResponse, type NextRequest } from "next/server";
import { getAdmin, motivoVigente, registrarAcceso } from "@/lib/admin/acceso";
import { aCsv, consultarTodo, esSensible } from "@/lib/admin/explorador";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const a = await getAdmin();
  if (!a || !a.verificado || (a.nivel !== "TOTAL" && a.nivel !== "SOPORTE")) return new NextResponse("No encontrado", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const org = sp.get("org") ?? "", tabla = sp.get("tabla") ?? "";
  const motivo = org ? await motivoVigente(org) : null;
  if (!motivo) return new NextResponse("Elegí el motivo antes de exportar.", { status: 403 });
  try {
    const r = await consultarTodo({ tabla, organizacionId: org, columna: sp.get("col") ?? undefined, valor: sp.get("val") ?? undefined, desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined });
    const mostrar = new Set((sp.get("mostrar") ?? "").split(",").filter(c => c && esSensible(c)));
    await registrarAcceso({ adminId: a.usuario.id, organizacionId: org, seccion: `datos:${tabla}${mostrar.size ? ` (con ${[...mostrar].join(", ")})` : ""}`, motivo: motivo.motivo, detalle: motivo.detalle, exportacion: true, filas: r.filas.length });
    return new NextResponse(aCsv(r.columnas, r.filas, mostrar), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tabla}_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Consulta no permitida.", { status: 400 });
  }
}
