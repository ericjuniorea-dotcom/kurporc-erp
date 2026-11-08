import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { categoriasDe, unidadesDe } from "@/lib/finanzas/datos";
import { hoyUTC, mesDe } from "@/lib/finanzas/calculos";
import { LibroMovimientos } from "./libro";

export const metadata = { title: "Movimientos · Finanzas · KurPorc" };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, permisos, sp] = await Promise.all([getSession(), getPermisos(), searchParams]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "finanzas.movimientos.ver")) redirect("/finanzas");
  const org = session.user.tenantId;
  const mes = /^\d{6}$/.test(sp.mes ?? "") ? Number(sp.mes) : mesDe(hoyUTC());
  const unidadesPermitidas = permisos.unidades === "TODAS" ? undefined : { in: permisos.unidades };

  const [movs, categorias, cuentas, unidades, productos, contrapartes] = await Promise.all([
    prisma.movimiento.findMany({
      where: { organizacionId: org, mes, ...(unidadesPermitidas ? { unidadId: unidadesPermitidas } : {}) },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, fecha: true, fechaVencimiento: true, tipo: true, concepto: true, subcategoria: true, cantidad: true, unidadMedida: true,
        montoGs: true, estado: true, observacion: true, naturaleza: true, area: true, signo: true, precioUnitarioGs: true, unidadId: true,
        origen: true, motivoAnulacion: true, facturaNumero: true, medioPago: true, cuentaFondosId: true,
        categoria: { select: { nombre: true } }, contraparte: { select: { nombre: true } },
        pagos: { select: { montoGs: true, fechaPago: true } },
      },
    }),
    categoriasDe(org),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, tipo: true } }),
    unidadesDe(org),
    prisma.productoInventario.findMany({ where: { tenantId: org, categoria: { in: ["VACUNA", "MEDICAMENTO"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, categoria: true } }),
    prisma.contraparte.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { nombre: true, tipo: true } }),
  ]);

  // Meses con movimientos (para el selector) + el actual
  const meses = await prisma.movimiento.groupBy({ by: ["mes"], where: { organizacionId: org }, orderBy: { mes: "desc" } });
  const listaMeses = Array.from(new Set([mesDe(hoyUTC()), mes, ...meses.map(m => m.mes)])).sort((a, b) => b - a);

  return (
    <LibroMovimientos
      mes={mes}
      meses={listaMeses}
      hoy={hoyUTC().toISOString().slice(0, 10)}
      puedo={{
        crear: puede(permisos, "finanzas.movimientos.crear"),
        anular: puede(permisos, "finanzas.movimientos.anular"),
        pagar: puede(permisos, "finanzas.pagar.registrar_pago"),
        cobrar: puede(permisos, "finanzas.cobrar.registrar_cobro"),
      }}
      movimientos={movs.map(m => {
        const pagado = m.pagos.reduce((s, p) => s + p.montoGs, 0n);
        return {
          id: m.id, fecha: m.fecha.toISOString().slice(0, 10), vencimiento: m.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
          tipo: m.tipo, concepto: m.concepto, categoria: m.categoria.nombre, subcategoria: m.subcategoria ?? "",
          cantidad: m.cantidad?.toString() ?? null, unidadMedida: m.unidadMedida ?? "", contraparte: m.contraparte?.nombre ?? "",
          montoGs: m.montoGs.toString(), pagadoGs: pagado.toString(), estado: m.estado, observacion: m.observacion ?? "",
          naturaleza: m.naturaleza, area: m.area, signo: m.signo, precioUnitario: m.precioUnitarioGs?.toString() ?? null,
          unidad: unidades.find(u => u.id === m.unidadId)?.codigo ?? "", origen: m.origen, motivoAnulacion: m.motivoAnulacion ?? "",
          factura: m.facturaNumero ?? "", ultimoPago: m.pagos.map(p => p.fechaPago.toISOString().slice(0, 10)).sort().at(-1) ?? null,
        };
      })}
      categorias={categorias.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, subcategorias: c.subcategorias, unidadDefault: c.unidadDefault, signo: c.signo }))}
      cuentas={cuentas}
      unidades={unidades.filter(u => permisos.unidades === "TODAS" || permisos.unidades.includes(u.id)).map(u => ({ id: u.id, codigo: u.codigo, nombre: u.nombre, tipo: u.tipo }))}
      productos={productos}
      contrapartes={contrapartes}
    />
  );
}
