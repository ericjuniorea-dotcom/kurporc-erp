/**
 * Prueba de la Fase 8 (parte 2): una venta crea su ingreso en el libro y da de baja los animales.
 *   DATABASE_URL=postgresql://...localhost... npm run prueba:ventas
 */
import { PrismaClient } from "@prisma/client";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { ErrorVenta, registrarVenta } from "@/lib/finanzas/ventas";

const prisma = new PrismaClient();
function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Esta prueba solo corre contra una base local");
  const t = Date.now();
  const u = await prisma.user.create({ data: { id: `pv-${t}`, email: `ventas.${t}@prueba.test`, name: "Ventas" } });
  const { id: org } = await crearOrganizacion(u.id, { tipo: "EMPRESA", nombre: `Ventas ${t}`, departamento: "Misiones", claveCreacion: crypto.randomUUID() });
  const lote = await prisma.nurseryBatch.create({ data: { tenantId: org, batchCode: `R-PRUEBA-${t}`, entryDate: new Date(Date.UTC(2026, 8, 1)), currentCount: 50 } });
  try {
    const r = await prisma.$transaction(tx => registrarVenta(tx, {
      organizacionId: org, creadoPor: u.id, fechaSalida: new Date(Date.UTC(2026, 8, 20)), tipoVenta: "LECHONES",
      cantidad: 20, kgTotales: 500, modoPrecio: "POR_KG", precioGs: 18_000n, destino: "ENGORDE", cliente: "Cliente de prueba",
      loteDesteteId: lote.id, cobro: { fecha: new Date(Date.UTC(2026, 8, 20)), cuentaFondosId: null, medioPago: "EFECTIVO" },
    }));
    check(r.importe === 9_000_000n, "importe = kg × precio");
    const v = await prisma.venta.findUnique({ where: { id: r.ventaId } });
    const m = await prisma.movimiento.findUnique({ where: { id: v!.movimientoId }, include: { categoria: true } });
    check(m?.tipo === "INGRESO" && m.categoria.nombre === "Venta de lechones" && m.origen === "VENTA" && m.origenId === v!.id, "crea el ingreso en el libro con su categoría y origen");
    check(m?.estado === "COBRADO" && m.mes === 202609 && m.signo === 1, "cobrada: queda COBRADO con los automáticos completos");
    check((await prisma.nurseryBatch.findUnique({ where: { id: lote.id } }))?.currentCount === 30, "da de baja los 20 lechones del lote");
    check((await prisma.batchSale.count({ where: { nurseryBatchId: lote.id } })) === 1, "queda la salida en el lote de destete");
    check(v!.edadPromDias === 19, "edad promedio desde la entrada al lote");
    let rechazo = false;
    try {
      await prisma.$transaction(tx => registrarVenta(tx, { organizacionId: org, creadoPor: u.id, fechaSalida: new Date(), tipoVenta: "LECHONES", cantidad: 31, kgTotales: 700, modoPrecio: "POR_KG", precioGs: 18_000n, destino: "ENGORDE", cliente: "Otro", loteDesteteId: lote.id }));
    } catch (e) { rechazo = e instanceof ErrorVenta; }
    check(rechazo, "no deja vender más animales de los que tiene el lote");
    const sinCobrar = await prisma.$transaction(tx => registrarVenta(tx, { organizacionId: org, creadoPor: u.id, fechaSalida: new Date(Date.UTC(2026, 8, 25)), tipoVenta: "MATRIZ_DESCARTE", cantidad: 2, kgTotales: 400, modoPrecio: "POR_CABEZA", precioGs: 2_500_000n, destino: "FRIGORIFICO", cliente: "Frigorífico" }));
    const m2 = await prisma.venta.findUnique({ where: { id: sinCobrar.ventaId } }).then(x => prisma.movimiento.findUnique({ where: { id: x!.movimientoId } }));
    check(sinCobrar.importe === 5_000_000n && m2?.estado === "POR_COBRAR", "precio por cabeza y venta por cobrar");
    console.log("\nOK — ventas verificadas");
  } finally {
    await prisma.batchSale.deleteMany({ where: { tenantId: org } });
    await prisma.nurseryBatch.deleteMany({ where: { tenantId: org } });
    for (const tabla of ["feedType", "healthProtocolConfig"] as const) await (prisma[tabla] as any).deleteMany({ where: { tenantId: org } });
    await prisma.tenant.delete({ where: { id: org } });
    await prisma.user.updateMany({ where: { id: u.id }, data: { tenantId: null } });
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
