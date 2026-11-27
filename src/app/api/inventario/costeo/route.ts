// Inventario · costeo por etapa (Fase 4): productos con su costo promedio y valor del stock, etapas, conteos físicos
// y el consumo valorizado por etapa del mes. Solo lectura.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await getPermisos();
  if (!puedeAlguno(permisos, ["stock.items.ver", "finanzas.costos.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const org = session.user.tenantId;
  const hoy = new Date();
  const mesTxt = req.nextUrl.searchParams.get("mes");
  const mes = mesTxt && /^\d{6}$/.test(mesTxt) ? Number(mesTxt) : hoy.getUTCFullYear() * 100 + hoy.getUTCMonth() + 1;
  const desde = new Date(Date.UTC(Math.floor(mes / 100), (mes % 100) - 1, 1));
  const hasta = new Date(Date.UTC(Math.floor(mes / 100), mes % 100, 1));

  const [productos, lotes, etapas, subs, conteos, consumo] = await Promise.all([
    prisma.productoInventario.findMany({ where: { tenantId: org, isActive: true }, orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, codigo: true, categoria: true, unidadMedida: true, costoPromedio: true, etapaConsumoCodigo: true, subcategoriaGastoId: true } }),
    prisma.loteInventario.findMany({ where: { tenantId: org, cantidadActual: { gt: 0 } }, select: { vacunaId: true, cantidadActual: true, costoUnitario: true } }),
    prisma.etapaCosto.findMany({ where: { organizacionId: org, activa: true, codigo: { not: "INV" } }, orderBy: { orden: "asc" }, select: { codigo: true, nombre: true } }),
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true } }),
    prisma.conteoInventario.findMany({ where: { tenantId: org }, orderBy: { fecha: "desc" }, take: 12,
      select: { id: true, fecha: true, valorSistemaGs: true, diferenciaGs: true, items: { select: { diferencia: true } } } }),
    // Salida = costo de la etapa; devolución (entrada no compra) lo resta; ajuste: falta suma, sobra resta
    prisma.$queryRaw<{ etapa: string; gs: number }[]>`select etapa_codigo as etapa, coalesce(sum(case tipo::text when 'SALIDA' then costo_gs when 'ENTRADA' then -costo_gs
        else -sign(cantidad) * costo_gs end), 0)::float8 as gs
      from movimientos_inventario where "tenantId" = ${org} and fecha >= ${desde} and fecha < ${hasta} and etapa_codigo is not null and origen::text <> 'COMPRA'
      group by etapa_codigo`,
  ]);
  const subCodigo = new Map(subs.map(s => [s.id, s.codigo]));
  const stock = new Map<string, { cant: number; sinCosto: boolean }>();
  for (const l of lotes) {
    const s = stock.get(l.vacunaId) ?? { cant: 0, sinCosto: false };
    s.cant += Number(l.cantidadActual); if (l.costoUnitario == null) s.sinCosto = true;
    stock.set(l.vacunaId, s);
  }
  const porEtapa = new Map(consumo.map(c => [c.etapa, Number(c.gs)]));
  return NextResponse.json({
    mes,
    productos: productos.map(p => {
      const s = stock.get(p.id);
      const costo = p.costoPromedio != null ? Number(p.costoPromedio) : null;
      return { id: p.id, nombre: p.nombre, codigo: p.codigo, categoria: p.categoria, unidadMedida: p.unidadMedida, etapa: p.etapaConsumoCodigo,
        sub: p.subcategoriaGastoId ? subCodigo.get(p.subcategoriaGastoId) ?? null : null,
        stock: s?.cant ?? 0, costoPromedio: costo, valorGs: costo != null && s ? Math.round(s.cant * costo) : null, sinCosto: !!s?.sinCosto };
    }),
    etapas,
    conteos: conteos.map(c => ({ id: c.id, fecha: c.fecha.toISOString().slice(0, 10), valorSistemaGs: Number(c.valorSistemaGs), diferenciaGs: Number(c.diferenciaGs),
      productos: c.items.length, conDiferencia: c.items.filter(i => Number(i.diferencia) !== 0).length })),
    consumoPorEtapa: etapas.map(e => ({ codigo: e.codigo, nombre: e.nombre, gs: Math.round(porEtapa.get(e.codigo) ?? 0) })).filter(e => e.gs !== 0),
    puedo: { salida: puede(permisos, "stock.salidas.crear"), valorizar: puede(permisos, "stock.items.editar"), conteo: puede(permisos, "stock.inventario_fisico.crear") },
  }, { headers: { "Cache-Control": "no-store" } });
}
