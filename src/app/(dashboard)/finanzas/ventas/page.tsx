import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { anioDe, SelectorAnio } from "../tabla-mensual";
import { PanelVentas } from "./panel";

export const metadata = { title: "Ventas · Finanzas · KurPorc" };

export default async function VentasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, permisos, corte } = await paginaFinanzas("ventas.ventas.ver");
  const anio = anioDe(await searchParams);
  const desde = new Date(Date.UTC(anio, 0, 1)), hasta = new Date(Date.UTC(anio + 1, 0, 1));
  const [ventas, lotesDestete, lotesEngorde, clientes, cuentas, ingresosLibro] = await Promise.all([
    prisma.venta.findMany({ where: { organizacionId: org, fechaSalida: { gte: desde, lt: hasta } }, orderBy: { fechaSalida: "desc" } }),
    prisma.nurseryBatch.findMany({ where: { tenantId: org, isActive: true, currentCount: { gt: 0 } }, orderBy: { entryDate: "asc" }, select: { id: true, batchCode: true, currentCount: true } }),
    prisma.growingBatch.findMany({ where: { tenantId: org, isActive: true, currentCount: { gt: 0 } }, orderBy: { batchCode: "asc" }, select: { id: true, batchCode: true, currentCount: true } }),
    prisma.contraparte.findMany({ where: { organizacionId: org, tipo: { in: ["CLIENTE", "AMBOS"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, tipo: true } }),
    // Control (8.5): ventas confirmadas = ingresos por ventas en el libro
    prisma.movimiento.aggregate({ where: { organizacionId: org, origen: "VENTA", estado: { not: "ANULADO" }, fecha: { gte: desde, lt: hasta } }, _sum: { montoGs: true } }),
  ]);
  const nombreCliente = new Map(clientes.map(c => [c.id, c.nombre]));
  const totalVentas = ventas.filter(v => v.estado === "CONFIRMADA").reduce((s, v) => s + v.importeGs, 0n);
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/ventas" />
      <PanelVentas
        hoy={corte.toISOString().slice(0, 10)}
        diferenciaControl={(totalVentas - (ingresosLibro._sum.montoGs ?? 0n)).toString()}
        puedo={{ crear: puede(permisos, "ventas.ventas.crear"), anular: puede(permisos, "ventas.ventas.anular"), cobrar: puede(permisos, "finanzas.cobrar.registrar_cobro") }}
        lotesDestete={lotesDestete} lotesEngorde={lotesEngorde} clientes={clientes.map(c => c.nombre)} cuentas={cuentas}
        ventas={ventas.map(v => ({
          id: v.id, fecha: v.fechaSalida.toISOString().slice(0, 10), tipo: v.tipoVenta, cantidad: v.cantidad, kg: Number(v.kgTotales),
          importeGs: v.importeGs.toString(), destino: v.destino, cliente: nombreCliente.get(v.clienteId) ?? "—", edad: v.edadPromDias,
          remito: v.remitoFactura ?? "", estado: v.estado,
        }))}
      />
    </>
  );
}
