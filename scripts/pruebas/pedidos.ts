/**
 * Prueba de la Fase 13 (criterios de aceptación):
 *  - Una cotización a 3 tiendas produce la comparativa (menor total, menor plazo, mejor precio por unidad).
 *  - Un ayudante con límite Gs 5.000.000 no envía un pedido de Gs 6.000.000 sin aprobación.
 *  - Al recibir, el stock sube lo recibido y aparece el gasto en Finanzas (pendiente → Cuentas por pagar).
 *  - Ningún cambio de estado sin pedido_evento (lo garantiza la base) y el evento no se borra.
 *   npm run prueba:pedidos   (con DATABASE_URL de una base de prueba; NODE_OPTIONS=--conditions=react-server)
 */
import prisma from "@/lib/db/prisma";
import { accionesPosibles, compararRespuestas, requiereAprobacion, unidadesParaCubrir, validarTransicion } from "@/lib/pedidos/reglas";
import { conActorYNota, siguienteNumero, tiendasParaCotizar } from "@/lib/pedidos/servidor";
import { ejecutarRecepcion } from "@/lib/pedidos/recepcion";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
async function falla(p: Promise<unknown>) { try { await p; return null; } catch (e) { return e instanceof Error ? e.message : String(e); } }

async function main() {
  console.log("Reglas");
  check(requiereAprobacion(6_000_000n, 5_000_000n, false), "ayudante con límite 5 M y pedido de 6 M → necesita aprobación");
  check(!requiereAprobacion(4_000_000n, 5_000_000n, false), "pedido de 4 M con límite 5 M → sale directo");
  check(!requiereAprobacion(60_000_000n, null, false) && !requiereAprobacion(6_000_000n, 0n, true), "sin límite o propietario → directo");
  check(requiereAprobacion(1n, 0n, false), "límite 0 → toda compra se aprueba");
  check(validarTransicion("ENVIADO", "CONFIRMADO", "VENDEDOR", null) === null, "la tienda confirma un pedido enviado");
  check(validarTransicion("ENVIADO", "CONFIRMADO", "COMPRADOR", null) !== null, "el comprador no puede confirmar");
  check(validarTransicion("ENVIADO", "RECHAZADO", "VENDEDOR", "") !== null, "rechazar exige motivo");
  check(validarTransicion("RECIBIDO", "CANCELADO", "COMPRADOR", "x".repeat(5)) !== null, "un pedido recibido no se cancela");
  check(accionesPosibles("PENDIENTE_APROBACION", "APROBADOR").join(",") === "ENVIADO,BORRADOR", "el aprobador aprueba o devuelve a borrador");
  check(unidadesParaCubrir(1000, 40) === 25 && unidadesParaCubrir(1001, 40) === 26 && unidadesParaCubrir(10, 40, 2) === 2, "bolsas necesarias para cubrir los kg (y el mínimo)");

  const hoy = new Date("2026-11-10T00:00:00Z"), valida = new Date("2026-11-20T00:00:00Z");
  const it = (itemId: string, precio: number, contenido: number, cantidad: number) => ({ itemId, descripcion: itemId, precioUnitarioGs: precio, unidadVenta: "u", contenidoBase: contenido, cantidad });
  const c = compararRespuestas(["maiz", "nucleo"], [
    { id: "A", tiendaId: "a", tienda: "A", items: [it("maiz", 70_000, 40, 25), it("nucleo", 300_000, 25, 4)], costoEnvioGs: 150_000, plazoDias: 5, validaHasta: valida },
    { id: "B", tiendaId: "b", tienda: "B", items: [it("maiz", 66_000, 40, 25), it("nucleo", 320_000, 25, 4)], costoEnvioGs: 100_000, plazoDias: 2, validaHasta: valida },
    { id: "C", tiendaId: "c", tienda: "C", items: [it("maiz", 60_000, 40, 25)], costoEnvioGs: 0, plazoDias: 1, validaHasta: valida },
  ], hoy);
  // A: 1.750.000 + 1.200.000 + 150.000 = 3.100.000 · B: 1.650.000 + 1.280.000 + 100.000 = 3.030.000 · C solo cotiza maíz
  check(c.columnas.map(x => x.total).join(",") === "3100000,3030000,1500000", "totales por tienda (con envío)");
  check(c.menorTotal === "B", "menor total entre las que cotizan todo: B");
  check(c.menorPlazo === "B", "menor plazo entre las que cotizan todo: B (C no cotiza todo)");
  check(c.mejorPorItem.maiz === "C" && c.mejorPorItem.nucleo === "A", "mejor precio por kg: maíz en C, núcleo en A");

  console.log("Base de datos");
  const sufijo = Date.now().toString(36);
  const usuario = await prisma.user.findFirst({ select: { id: true } });
  check(usuario, "hay un usuario para actuar");
  const granja = await prisma.tenant.create({ data: { slug: `prueba-granja-${sufijo}`, farmName: `Granja prueba ${sufijo}`, tipo: "INDIVIDUAL" } });
  const vend = await prisma.tenant.create({ data: { slug: `prueba-vend-${sufijo}`, farmName: `Tienda prueba ${sufijo}`, tipo: "VENDEDOR", verificacion: "VERIFICADA" } });
  const productoStock: string[] = [];
  try {
    await prisma.tienda.create({ data: { organizacionId: vend.id, zonasEntrega: ["Itapúa"] } });
    const unidad = await prisma.unidadNegocio.create({ data: { organizacionId: granja.id, codigo: "GRANJA-PRUEBA", nombre: "Granja", tipo: "GRANJA" } });
    const nuc = await prisma.productoCatalogo.findUniqueOrThrow({ where: { codigo: "ALI-NUC-LAC" } });
    const vac = await prisma.productoCatalogo.findUniqueOrThrow({ where: { codigo: "SAN-VAC-CIRCO-MHYO" } });
    const stockNuc = await prisma.productoInventario.create({ data: { tenantId: granja.id, nombre: "Núcleo lactación", enfermedad: "—", sectorDestino: "cerda", categoria: "BALANCEADO", unidadMedida: "KG" } });
    const stockVac = await prisma.productoInventario.create({ data: { tenantId: granja.id, nombre: "Vacuna PCV2", enfermedad: "Circovirus", sectorDestino: "cerda", categoria: "VACUNA", unidadMedida: "DOSIS" } });
    productoStock.push(stockNuc.id, stockVac.id);

    // Selección de tiendas para cotizar: verificada, publica el producto y entrega en el departamento
    const catNuc = await prisma.categoriaMercado.findUniqueOrThrow({ where: { slug: "nucleos" } });
    await prisma.publicacion.create({ data: { slug: `prueba-nuc-${sufijo}`, tiendaId: vend.id, productoCatalogoId: nuc.id, categoriaId: catNuc.id, titulo: "Núcleo", precioGs: 94_000n, unidadVenta: "Bolsa 40 kg", unidadBase: "KG", contenidoBase: 40, zonasEntrega: ["Itapúa"], estado: "ACTIVA" } });
    check((await tiendasParaCotizar([nuc.id], "Itapúa", granja.id)).includes(vend.id), "la tienda que publica el núcleo y entrega en Itapúa recibe la cotización");
    check(!(await tiendasParaCotizar([nuc.id], "Central", granja.id)).includes(vend.id), "no recibe si no entrega en Central");
    check(!(await tiendasParaCotizar([nuc.id], "Itapúa", vend.id)).includes(vend.id), "una tienda no se cotiza a sí misma");

    // Pedido: 10 bolsas de núcleo (40 kg, Gs 94.000) + 2 frascos de vacuna (50 dosis, Gs 120.000) + envío Gs 50.000
    const p = await conActorYNota(usuario!.id, null, async tx => tx.pedido.create({
      data: {
        numero: await siguienteNumero(tx), compradorId: usuario!.id, organizacionId: granja.id, tiendaId: vend.id, estado: "ENVIADO",
        subtotalGs: 1_180_000n, envioGs: 50_000n, totalGs: 1_230_000n, metodoPago: "TRANSFERENCIA",
        items: { create: [
          { productoCatalogoId: nuc.id, descripcion: "Núcleo lactación · Bolsa 40 kg", unidadVenta: "Bolsa 40 kg", unidadBase: "KG", cantidad: 10, contenidoBase: 40, precioUnitarioGs: 94_000n, subtotalGs: 940_000n },
          { productoCatalogoId: vac.id, descripcion: "Vacuna PCV2 · Frasco 50 dosis", unidadVenta: "Frasco 50 dosis", unidadBase: "DOSIS", cantidad: 2, contenidoBase: 50, precioUnitarioGs: 120_000n, subtotalGs: 240_000n },
        ] },
      },
      include: { items: true },
    }));
    check(/^PED-\d{4}-\d{6}$/.test(p.numero), `número de pedido ${p.numero}`);
    check((await prisma.pedidoEvento.count({ where: { pedidoId: p.id, estado: "ENVIADO" } })) === 1, "crear el pedido deja su evento ENVIADO");

    const sinActor = await falla(prisma.pedido.update({ where: { id: p.id }, data: { estado: "CONFIRMADO" } }));
    check(sinActor && /sin actor/.test(sinActor), "cambiar el estado sin actor lo rechaza la base");
    await conActorYNota(usuario!.id, "Sale el jueves", tx => tx.pedido.update({ where: { id: p.id }, data: { estado: "CONFIRMADO" } }));
    const ev = await prisma.pedidoEvento.findFirst({ where: { pedidoId: p.id, estado: "CONFIRMADO" } });
    check(ev?.nota === "Sale el jueves" && ev.actorId === usuario!.id, "el evento guarda actor y nota");
    check(await falla(prisma.pedidoEvento.delete({ where: { id: ev!.id } })), "pedido_evento no se borra");

    // Sanidad sin lote → error
    const nucItem = p.items.find(i => i.unidadBase === "KG")!, vacItem = p.items.find(i => i.unidadBase === "DOSIS")!;
    const base = { pedidoId: p.id, fecha: "2026-11-10", unidadId: unidad.id, pagado: false };
    const sinLote = await falla(ejecutarRecepcion(granja.id, usuario!.id, { ...base, items: [
      { itemId: nucItem.id, cantidadRecibida: 10, productoInventarioId: stockNuc.id, cantidadStock: 400 },
      { itemId: vacItem.id, cantidadRecibida: 2, productoInventarioId: stockVac.id, cantidadStock: 100 },
    ] }));
    check(sinLote && /lote y el vencimiento/.test(sinLote), "vacuna sin lote ni vencimiento no se recibe");

    // Recepción con faltante: 8 de 10 bolsas
    const { nota } = await ejecutarRecepcion(granja.id, usuario!.id, { ...base, vencimientoPago: "2026-11-25", items: [
      { itemId: nucItem.id, cantidadRecibida: 8, productoInventarioId: stockNuc.id, cantidadStock: 320 },
      { itemId: vacItem.id, cantidadRecibida: 2, productoInventarioId: stockVac.id, cantidadStock: 100, lote: "L-PCV-01", vencimiento: "2027-06-30" },
    ] });
    check(/faltantes/.test(nota), "la nota registra el faltante");
    const lotes = await prisma.loteInventario.findMany({ where: { tenantId: granja.id }, orderBy: { numeroLote: "asc" } });
    check(lotes.length === 2 && Number(lotes.find(l => l.vacunaId === stockNuc.id)!.cantidadActual) === 320 && Number(lotes.find(l => l.vacunaId === stockVac.id)!.cantidadActual) === 100, "stock: +320 kg de núcleo y +100 dosis de vacuna");
    check(Number(lotes.find(l => l.vacunaId === stockNuc.id)!.costoUnitario) === 2_350, "costo del kg de núcleo = Gs 2.350");
    const movs = await prisma.movimiento.findMany({ where: { organizacionId: granja.id, origen: "PEDIDO_MERCADO" }, include: { categoria: { select: { nombre: true } } } });
    const porCat = Object.fromEntries(movs.map(m => [m.categoria.nombre, Number(m.montoGs)]));
    // Núcleo: 8 × 94.000 = 752.000 + envío 50.000 (va a la categoría con más monto) · Sanidad: 240.000
    check(porCat["Balanceado de lactación"] === 802_000 && porCat["Sanidad"] === 240_000, "Finanzas: Gs 802.000 en Balanceado de lactación (con envío) y Gs 240.000 en Sanidad");
    check(movs.every(m => m.estado === "PENDIENTE" && m.fechaVencimiento?.toISOString().startsWith("2026-11-25")), "sin pagar → pendientes con vencimiento (Cuentas por pagar)");
    const cp = await prisma.contraparte.findFirst({ where: { organizacionId: granja.id } });
    check(cp?.tiendaId === vend.id && movs.every(m => m.contraparteId === cp.id), "proveedor = la tienda");
    const fin = await prisma.pedido.findUnique({ where: { id: p.id }, include: { eventos: { orderBy: { createdAt: "asc" } } } });
    check(fin?.estado === "RECIBIDO" && fin.eventos.map(e => e.estado).join(",") === "ENVIADO,CONFIRMADO,RECIBIDO", "pedido RECIBIDO con todos sus eventos");
    check(await prisma.stockItemCatalogo.count({ where: { organizacionId: granja.id } }) === 2, "queda aprendido qué producto de stock es cada producto del catálogo");

    // Reseña → calificación de la tienda
    await prisma.resena.create({ data: { pedidoId: p.id, tiendaId: vend.id, autorId: usuario!.id, calificacion: 4 } });
    const t = await prisma.tienda.findUnique({ where: { organizacionId: vend.id } });
    check(Number(t?.calificacion) === 4 && t?.totalResenas === 1, "la reseña actualiza la calificación de la tienda");
  } finally {
    await prisma.movimientoInventario.deleteMany({ where: { tenantId: granja.id } });
    await prisma.loteInventario.deleteMany({ where: { tenantId: granja.id } });
    await prisma.productoInventario.deleteMany({ where: { id: { in: productoStock } } });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${usuario!.id}, true)`;
      await tx.tenant.deleteMany({ where: { id: { in: [granja.id, vend.id] } } });
    });
  }
  console.log("Todo bien.");
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
