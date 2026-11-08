import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { conActor } from "@/lib/db/actor";
import { ErrorVenta, registrarVenta } from "@/lib/finanzas/ventas";
import { loteCerrado } from "@/lib/engorde/guardas";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.salidas.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "engorde.salidas.crear" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const cerrado = await loteCerrado(session.user.tenantId, body.growingBatchId);
  if (cerrado) return NextResponse.json({ error: cerrado }, { status: 409 });
  const { growingBatchId, saleDate, buyerName, animalCount, totalWeightKg, pricePerKg, transferGuide, employeeId } = body;

  if (!growingBatchId || !saleDate || !animalCount || !totalWeightKg || !pricePerKg) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const count = Number(animalCount);
  const totalKg = Number(totalWeightKg);
  const precio = Number(pricePerKg);
  const total = Math.round(totalKg * precio * 100) / 100;

  // Una sola carga: la venta de engorde genera también su ingreso en Finanzas (Fase 8)
  let venta;
  try {
    venta = await conActor(session.user.id, async tx => {
      const v = await tx.batchSale.create({
        data: {
          tenantId, growingBatchId, saleDate: new Date(saleDate), animalCount: count, totalWeightKg: totalKg,
          pricePerKg: precio, totalAmount: total, buyerName: buyerName || null, transferGuide: transferGuide || null, employeeId: employeeId || null,
        },
      });
      await tx.growingBatch.update({ where: { id: growingBatchId }, data: { currentCount: { decrement: count }, updatedAt: new Date() } });
      await registrarVenta(tx, {
        organizacionId: tenantId, creadoPor: session.user.id, fechaSalida: new Date(saleDate), tipoVenta: "CERDO_TERMINADO",
        cantidad: count, kgTotales: totalKg, modoPrecio: "POR_KG", precioGs: BigInt(Math.round(precio)), destino: "FRIGORIFICO",
        cliente: (buyerName || "Cliente sin nombre").toString().slice(0, 120), loteEngordeId: growingBatchId,
        guiaTraslado: transferGuide || null, bajaYaHecha: true,
      });
      return v;
    });
  } catch (e) {
    if (e instanceof ErrorVenta) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json(venta, { status: 201 });
}
