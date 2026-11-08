/**
 * Importa la planilla de Administración y Finanzas (Fase 8.29) a una organización y compara con el Anexo H.
 *
 *   PLANILLA=ruta.xlsx PROPIETARIO=correo DESTINO="nueva:KurPorc Granja" npm run db:importar-planilla
 *   PLANILLA=ruta.xlsx PROPIETARIO=correo DESTINO=<id de organización> npm run db:importar-planilla
 *   SOLO_VALIDAR=<id de organización> npm run db:importar-planilla     (solo el informe)
 *
 * Todo corre en una transacción: si algo falla, no queda nada a medias. La organización tiene que estar vacía.
 * Lo que la planilla tenía dudoso (cuentas por pagar que no están en el libro) va a la lista de revisión.
 */
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { columna, fecha as fechaDe, leerLibro, numero, texto, type Hoja } from "@/lib/finanzas/importar/xlsx";
import { fechaISO, gs } from "@/lib/finanzas/calculos";
import { DIETAS, filaSanidad, hojaAlimentacion, hojaCostos, hojaFijosVariables, sumaB, sumaN, type MovHoja, type ParamsHojas, type ProdMes } from "@/lib/finanzas/hojas";
import { flujoReal, puntoEquilibrio, resumenPrestamo, tasaImplicita, tasaAnual, vencimientos } from "@/lib/finanzas/planificacion";

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;
const MEDIOS: Record<string, string> = { transferencia: "TRANSFERENCIA", efectivo: "EFECTIVO", cheque: "CHEQUE", "débito automático": "DEBITO_AUTOMATICO", "debito automatico": "DEBITO_AUTOMATICO", tarjeta: "TARJETA", "crédito de proveedor": "CREDITO_PROVEEDOR" };
const DESTINOS: Record<string, string> = { engorde: "ENGORDE", consumo: "CONSUMO", carneado: "CARNEADO", "reproducción": "REPRODUCCION", reproduccion: "REPRODUCCION", "frigorífico": "FRIGORIFICO", frigorifico: "FRIGORIFICO" };
const CORTE = "2026-09-30";

function tipoCuenta(n: string) { const x = n.toLowerCase(); return x.includes("chica") ? "CAJA_CHICA" : x === "caja" ? "CAJA" : x.includes("cooperativa") ? "COOPERATIVA" : "BANCO"; }

async function importar(libro: Map<string, Hoja>, userId: string, org: string) {
  const H = (n: string) => { const h = libro.get(n); if (!h) throw new Error(`Falta la hoja ${n}`); return h; };
  const mov = H("MOVIMIENTOS"), par = H("PARAMETROS"), ven = H("VENTAS"), deu = H("DEUDAS Y FINANCIAMIENTO"), pre = H("PRESUPUESTO"), prod = H("PRODUCCION"), san = H("SANIDAD"), cxp = H("CUENTAS POR PAGAR"), ori = H("DATOS ORIGINALES");
  const importacionId = randomUUID();
  const [cats, unidades] = await Promise.all([
    prisma.categoriaFinanciera.findMany({ where: { organizacionId: null } }),
    prisma.unidadNegocio.findMany({ where: { organizacionId: org } }),
  ]);
  const cat = new Map(cats.map(c => [c.nombre.toLowerCase(), c]));
  const granja = unidades.find(u => u.tipo === "GRANJA"), comun = unidades.find(u => u.tipo === "COMUN");
  if (!granja || !comun) throw new Error("La organización no tiene unidades GRANJA y COMUN");

  // Antes de escribir: que todas las categorías existan
  const faltan = new Set<string>();
  for (let f = 7; f <= mov.maxFila; f++) if ((numero(mov, `K${f}`) ?? 0) > 0 && !cat.has(texto(mov, `D${f}`).toLowerCase())) faltan.add(`${f}: ${texto(mov, `D${f}`)}`);
  if (faltan.size) throw new Error(`Categorías que no existen en el catálogo: ${Array.from(faltan).join(" · ")}`);

  const r = { movimientos: 0, automaticos: 0, pagos: 0, ventas: 0, prestamos: 0, cuotasEnlazadas: 0, presupuesto: 0, productos: 0, originales: 0, revision: 0 };
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`select set_config('app.actor_id', ${userId}, true)`;
    // 1 · Parámetros (para reproducir el Anexo H: amortización como la planilla, sanidad por compra)
    const p = (ref: string) => numero(par, ref);
    await tx.parametrosFinancieros.upsert({
      where: { organizacionId: org }, create: { organizacionId: org }, update: {},
    });
    await tx.parametrosFinancieros.update({ where: { organizacionId: org }, data: {
      matricesActivasManual: p("C22") ?? undefined, precioReferenciaLechonGs: BigInt(p("C31") ?? 435000), precioKgVivoGs: BigInt(p("C32") ?? 18500), pesoVentaKg: p("C33") ?? 25,
      lechonesAVenderMes: p("C36") ?? 80, precioEsperadoLechonGs: BigInt(p("C37") ?? 435000), otrosIngresosMesGs: BigInt(p("C38") ?? 0), colchonMesesEgreso: p("C39") ?? 1,
      consumoGestacionKgDia: p("C47") ?? 2.5, consumoLactacionKgDia: p("C48") ?? 8, preInicial1KgLechon: p("C49") ?? 2, preInicial2KgLechon: p("C50") ?? 4, inicialKgLechon: p("C51") ?? 35,
      tasaDescuentoVan: p("C54") ?? 0.12, metaCoberturaDias: p("C55") ?? 30, alertaCoberturaDias: p("C56") ?? 20, metaDesvio: p("C57") ?? 0.05, alertaDesvio: p("C58") ?? 0.1,
      vidaObraAnios: p("C59") ?? 20, vidaEquiposAnios: p("C60") ?? 10, modoAmortizacion: "PLANILLA", imputacionSanidad: "COMPRA",
    } });

    // 2 · Cuentas de fondos (saldo inicial 0: la planilla arranca en cero y el libro explica todo)
    const nombresCuenta = new Set<string>(["Caja", "Banco Continental", "Zeta Banco", "Interfisa"]);
    for (let f = 7; f <= mov.maxFila; f++) { const j = texto(mov, `J${f}`); if (j && (numero(mov, `K${f}`) ?? 0) > 0) nombresCuenta.add(j); }
    const cuenta = new Map<string, string>();
    for (const n of nombresCuenta) {
      const c = await tx.cuentaFondos.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: n } }, create: { organizacionId: org, nombre: n, tipo: tipoCuenta(n) as never }, update: {} });
      cuenta.set(n.toLowerCase(), c.id);
    }
    const chica = p("C18");
    if (chica) await tx.cuentaFondos.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: "Caja chica" } }, create: { organizacionId: org, nombre: "Caja chica", tipo: "CAJA_CHICA", montoAsignadoGs: BigInt(chica) }, update: {} });

    // 3 · Productos sanitarios con su uso del año y su stock (hoja SANIDAD, secciones A y D)
    const producto = new Map<string, string>();
    const mlFrasco = new Map<string, number>();
    for (let f = 110; f <= san.maxFila; f++) { const n = texto(san, `B${f}`); if (n) mlFrasco.set(n.toLowerCase(), numero(san, `D${f}`) ?? 0); }
    for (let f = 9; f <= 100; f++) {
      const nombre = texto(san, `B${f}`);
      if (!nombre || /total/i.test(nombre)) { if (!nombre) break; continue; }
      const tipoTxt = texto(san, `C${f}`).toLowerCase();
      const categoria = tipoTxt.startsWith("vacuna") ? "VACUNA" : tipoTxt.startsWith("suplemento") ? "SUPLEMENTO" : "MEDICAMENTO";
      const pr = await tx.productoInventario.create({ data: { tenantId: org, nombre, enfermedad: "—", sectorDestino: "plantel", categoria, unidadMedida: "ML", dosisMl: 1 } });
      producto.set(nombre.toLowerCase(), pr.id);
      const stock = Math.max(0, numero(san, `L${f}`) ?? 0);
      const lista = numero(san, `G${f}`);
      const lote = await tx.loteInventario.create({ data: { tenantId: org, vacunaId: pr.id, numeroLote: "IMPORTADO", fechaVencimiento: fechaISO("2027-12-31"), fechaIngreso: fechaISO(CORTE), cantidadInicial: stock, cantidadActual: stock, costoUnitario: lista ?? null, observaciones: "Stock teórico importado de la planilla" } });
      // Uso por mes (sección D, columnas N a Y = enero a diciembre)
      const filaD = Array.from({ length: 30 }, (_, i) => 110 + i).find(x => texto(san, `B${x}`).toLowerCase() === nombre.toLowerCase());
      if (filaD) for (let m = 0; m < 12; m++) {
        const ml = numero(san, `${columna(14 + m)}${filaD}`) ?? 0;
        if (ml > 0) await tx.movimientoInventario.create({ data: { tenantId: org, productoId: pr.id, loteId: lote.id, tipo: "SALIDA", cantidad: ml, origen: "AJUSTE_MANUAL", fecha: new Date(Date.UTC(2026, m, 15)) } });
      }
      r.productos++;
    }

    // 4 · Libro de movimientos (manuales 7–862 y las compras automáticas de balanceado 863–1006 con monto)
    const filaAMov = new Map<number, string>();
    for (let f = 7; f <= mov.maxFila; f++) {
      const monto = numero(mov, `K${f}`) ?? 0;
      if (monto <= 0) continue;
      const fechaTxt = fechaDe(mov, `A${f}`);
      if (!fechaTxt) throw new Error(`Fila ${f} de MOVIMIENTOS sin fecha`);
      const c = cat.get(texto(mov, `D${f}`).toLowerCase())!;
      const estadoTxt = texto(mov, `L${f}`).toLowerCase();
      const pagado = estadoTxt === "pagado" || estadoTxt === "cobrado";
      const contraparte = texto(mov, `H${f}`);
      let contraparteId: string | null = null;
      if (contraparte) {
        const cp = await tx.contraparte.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: contraparte } }, create: { organizacionId: org, nombre: contraparte, tipo: c.signo > 0 && c.tipo === "INGRESO" ? "CLIENTE" : c.tipo === "FINANCIAMIENTO" ? "ACREEDOR" : "PROVEEDOR" }, update: {} });
        contraparteId = cp.id;
      }
      const cuentaId = texto(mov, `J${f}`) ? cuenta.get(texto(mov, `J${f}`).toLowerCase()) ?? null : null;
      const medio = MEDIOS[texto(mov, `I${f}`).toLowerCase()] ?? null;
      const prodTxt = texto(mov, `U${f}`).toLowerCase();
      const m = await tx.movimiento.create({ data: {
        organizacionId: org, unidadId: texto(mov, `N${f}`).toUpperCase().startsWith("COM") ? comun.id : granja.id, granjaId: texto(mov, `N${f}`).toUpperCase().startsWith("COM") ? null : granja.granjaId,
        fecha: fechaISO(fechaTxt), tipo: c.tipo, concepto: texto(mov, `C${f}`).slice(0, 200) || c.nombre, categoriaId: c.id, subcategoria: texto(mov, `E${f}`).slice(0, 80) || null,
        cantidad: (numero(mov, `F${f}`) ?? 0) > 0 ? numero(mov, `F${f}`)! : null, unidadMedida: texto(mov, `G${f}`).slice(0, 20) || null,
        contraparteId, medioPago: medio as never, cuentaFondosId: cuentaId, montoGs: BigInt(Math.round(monto)),
        estado: c.signo > 0 ? "POR_COBRAR" : "PENDIENTE", observacion: texto(mov, `M${f}`).slice(0, 500) || null,
        productoSanitarioId: prodTxt ? producto.get(prodTxt) ?? null : null, mlPorUnidad: numero(mov, `V${f}`) ?? null,
        origen: "IMPORTACION", origenId: `MOVIMIENTOS!${f}`, creadoPor: userId,
      }, select: { id: true } });
      filaAMov.set(f, m.id);
      if (pagado) { await tx.pagoMovimiento.create({ data: { movimientoId: m.id, fechaPago: fechaISO(fechaTxt), montoGs: BigInt(Math.round(monto)), cuentaFondosId: cuentaId, medioPago: medio as never, creadoPor: userId } }); r.pagos++; }
      if (f >= 863) r.automaticos++; else r.movimientos++;
    }

    // 5 · Saldos declarados al cierre (PARÁMETROS sección 2)
    const declarados: [string, string][] = [["Caja", "C13"], ["Banco Continental", "C14"], ["Zeta Banco", "C15"], ["Interfisa", "C16"]];
    for (const [n, ref] of declarados) {
      const id = cuenta.get(n.toLowerCase());
      if (id && p(ref) !== null) await tx.saldoDeclarado.create({ data: { organizacionId: org, cuentaFondosId: id, fecha: fechaISO(fechaDe(par, "C7") ?? CORTE), saldoGs: BigInt(Math.round(p(ref)!)), observacion: "Importado de la planilla (PARÁMETROS)", declaradoPor: userId } });
    }

    // 6 · Préstamos y cuotas, enlazando las cuotas ya pagadas con sus movimientos del libro
    const catCuota = cat.get("pago de cuota de préstamo")!;
    const cuotasLibro = Array.from(filaAMov.entries()).filter(([f]) => texto(mov, `D${f}`).toLowerCase() === catCuota.nombre.toLowerCase())
      .map(([f, id]) => ({ f, id, concepto: texto(mov, `C${f}`).toLowerCase(), fecha: fechaDe(mov, `A${f}`)!, cuenta: texto(mov, `J${f}`), medio: texto(mov, `I${f}`).toLowerCase(), usado: false }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (let f = 7; f <= 16; f++) {
      const acreedor = texto(deu, `A${f}`), concepto = texto(deu, `B${f}`);
      if (!acreedor || !concepto || /total/i.test(texto(deu, `B${f}`))) continue;
      const n = numero(deu, `E${f}`) ?? 0, cuota = BigInt(Math.round(numero(deu, `D${f}`) ?? 0)), pagadas = numero(deu, `H${f}`) ?? 0;
      const cp = await tx.contraparte.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: acreedor } }, create: { organizacionId: org, nombre: acreedor, tipo: "ACREEDOR" }, update: {} });
      const propias = cuotasLibro.filter(c => !c.usado && c.concepto.replace(/^cuota\s+/, "").trim() === concepto.toLowerCase().trim());
      const cuentaDebito = propias[0]?.cuenta ? cuenta.get(propias[0].cuenta.toLowerCase()) ?? null : null;
      const pr = await tx.prestamo.create({ data: {
        organizacionId: org, unidadId: comun.id, acreedorId: cp.id, concepto, montoRecibidoGs: BigInt(Math.round(numero(deu, `C${f}`) ?? 0)), cuotaMensualGs: cuota,
        numeroCuotas: n, primerVencimiento: fechaISO(fechaDe(deu, `F${f}`)!), debitoAutomatico: propias.some(c => c.medio.startsWith("débito") || c.medio.startsWith("debito")),
        cuentaDebitoId: cuentaDebito, observacion: texto(deu, `P${f}`).slice(0, 300) || null, creadoPor: userId,
      } });
      const fechas = vencimientos(fechaISO(fechaDe(deu, `F${f}`)!), n);
      for (let i = 0; i < n; i++) {
        const enlace = i < pagadas ? propias[i] : undefined;
        if (enlace) { enlace.usado = true; r.cuotasEnlazadas++; await tx.movimiento.update({ where: { id: enlace.id }, data: { origenId: `prestamo:${pr.id}` } }); }
        await tx.cuotaPrestamo.create({ data: { prestamoId: pr.id, numero: i + 1, vencimiento: fechas[i], montoGs: cuota, movimientoId: enlace?.id ?? null } });
      }
      if (propias.length < pagadas) throw new Error(`${concepto}: la planilla dice ${pagadas} cuotas pagadas y el libro tiene ${propias.length}`);
      r.prestamos++;
    }

    // 7 · Ventas, vinculadas a los ingresos del libro (sin duplicarlos)
    const catVenta = cat.get("venta de lechones")!;
    const ingresos = Array.from(filaAMov.entries()).filter(([f]) => texto(mov, `D${f}`).toLowerCase() === catVenta.nombre.toLowerCase())
      .map(([f, id]) => ({ id, fecha: fechaDe(mov, `A${f}`)!, monto: numero(mov, `K${f}`)! }));
    for (let f = 7; f <= 86; f++) {
      const cant = numero(ven, `D${f}`) ?? 0;
      if (cant <= 0) continue;
      const fv = fechaDe(ven, `A${f}`)!, importe = numero(ven, `H${f}`) ?? 0;
      const destino = ingresos.find(x => x.fecha === fv && x.monto === importe) ?? ingresos.find(x => x.fecha === fv) ?? ingresos.find(x => x.fecha.slice(0, 7) === fv.slice(0, 7)) ?? ingresos[0];
      if (!destino) throw new Error(`Venta de la fila ${f} sin ingreso en el libro`);
      const cliente = texto(ven, `K${f}`) || "Cliente sin nombre";
      const cp = await tx.contraparte.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: cliente } }, create: { organizacionId: org, nombre: cliente, tipo: "CLIENTE" }, update: {} });
      await tx.venta.create({ data: {
        organizacionId: org, unidadId: granja.id, granjaId: granja.granjaId, fechaSalida: fechaISO(fv), tipoVenta: "LECHONES", edadPromDias: numero(ven, `C${f}`) === null ? null : Math.round(numero(ven, `C${f}`)!),
        cantidad: Math.round(cant), kgTotales: numero(ven, `E${f}`) ?? 0, modoPrecio: "POR_KG", precioGsKg: BigInt(Math.round(numero(ven, `G${f}`) ?? 0)), importeGs: BigInt(Math.round(importe)),
        destino: DESTINOS[texto(ven, `J${f}`).toLowerCase()] ?? "ENGORDE", clienteId: cp.id, recibePor: texto(ven, `L${f}`) || null, remitoFactura: texto(ven, `M${f}`) || null,
        movimientoId: destino.id, creadoPor: userId,
      } });
      r.ventas++;
    }

    // 8 · Presupuesto (filas 8–39, columnas D a AA = ene-2026 a dic-2027)
    for (let f = 8; f <= 39; f++) {
      const c = cat.get(texto(pre, `A${f}`).toLowerCase());
      if (!c || (c.tipo !== "GASTO" && c.tipo !== "INVERSION")) continue;
      const unidadId = texto(pre, `C${f}`).toUpperCase().startsWith("COM") ? comun.id : granja.id;
      for (let k = 0; k < 24; k++) {
        const v = numero(pre, `${columna(4 + k)}${f}`) ?? 0;
        if (v > 0) { await tx.presupuesto.create({ data: { organizacionId: org, unidadId, categoriaId: c.id, mes: (2026 + Math.floor(k / 12)) * 100 + (k % 12) + 1, montoGs: BigInt(Math.round(v)) } }); r.presupuesto++; }
      }
    }

    // 9 · Aportes de capital previstos (PARÁMETROS sección 6)
    for (let f = 42; f <= 45; f++) { const mes = numero(par, `B${f}`), v = numero(par, `C${f}`); if (mes && v) await tx.aporteCapitalPrevisto.create({ data: { organizacionId: org, mes, montoGs: BigInt(Math.round(v)), descripcion: texto(par, `A${f}`) } }); }

    // 10 · Producción histórica (hoja PRODUCCIÓN, filas 8–19)
    for (let f = 8; f <= 19; f++) {
      const mes = numero(prod, `A${f}`);
      if (!mes) continue;
      const n = (c: string) => Math.round(numero(prod, `${c}${f}`) ?? 0);
      await tx.produccionMensualImportada.create({ data: { organizacionId: org, mes, servicios: n("C"), partos: n("D"), nacidosTotales: n("E"), nacidosVivos: n("F"), muertosAlNacer: n("G"), destetados: n("H"), muertosLactancia: n("I") } });
    }

    // 11 · Cuentas por pagar: las que no están como pendiente en el libro van a revisión (mejora N° 2)
    const pend = Array.from(filaAMov.keys()).filter(f => texto(mov, `L${f}`).toLowerCase() === "pendiente").map(f => ({ f, prov: texto(mov, `H${f}`).toLowerCase(), monto: numero(mov, `K${f}`)!, usado: false }));
    const revision: Prisma.ImportacionFilaOriginalCreateManyInput[] = [];
    for (let f = 7; f <= 56; f++) {
      const monto = numero(cxp, `E${f}`);
      if (!monto) continue;
      const prov = texto(cxp, `B${f}`).toLowerCase();
      const m = pend.find(x => !x.usado && x.monto === monto && x.prov === prov) ?? pend.find(x => !x.usado && x.monto === monto);
      if (m) { m.usado = true; continue; }
      revision.push({ organizacionId: org, importacionId, archivo: "planilla", hoja: "CUENTAS POR PAGAR · REVISIÓN", fila: f, datos: {
        fecha: fechaDe(cxp, `A${f}`), proveedor: texto(cxp, `B${f}`), concepto: texto(cxp, `C${f}`), categoria: texto(cxp, `D${f}`), montoGs: monto, saldoGs: numero(cxp, `G${f}`),
        vencimiento: fechaDe(cxp, `H${f}`), factura: texto(cxp, `L${f}`), observacion: texto(cxp, `M${f}`),
        motivo: /pagad/i.test(texto(cxp, `M${f}`)) ? "Figura pagada en otra planilla: verificar antes de cargarla" : "No está como pendiente en el libro de movimientos",
      } });
    }
    if (revision.length) await tx.importacionFilaOriginal.createMany({ data: revision });
    r.revision = revision.length;

    // 12 · Copia fiel de DATOS ORIGINALES (no se usa en cálculos)
    const originales: Prisma.ImportacionFilaOriginalCreateManyInput[] = [];
    for (let f = 7; f <= ori.maxFila; f++) {
      const datos: Record<string, string | number | boolean> = {};
      for (let c = 1; c <= 12; c++) { const v = ori.celdas.get(`${columna(c)}${f}`); if (v !== undefined && v !== null) datos[texto(ori, `${columna(c)}6`) || columna(c)] = v; }
      if (Object.keys(datos).length) originales.push({ organizacionId: org, importacionId, archivo: "planilla", hoja: "DATOS ORIGINALES", fila: f, datos });
    }
    for (let i = 0; i < originales.length; i += 500) await tx.importacionFilaOriginal.createMany({ data: originales.slice(i, i + 500) });
    r.originales = originales.length;
  }, { timeout: 900_000, maxWait: 60_000 });
  return { ...r, importacionId };
}

// ── Informe de validación contra el Anexo H (corte 30/09/2026) ──────
async function validar(org: string) {
  const corte = fechaISO(CORTE);
  const anio = 2026, mesSep = 202609, i = 8;
  const [movsRaw, pagos, params, ventas, importada, prestamos, productos, compras, usos, lotes, presup, cuentas, declarados] = await Promise.all([
    prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" } }, include: { categoria: true, pagos: true } }),
    prisma.pagoMovimiento.findMany({ where: { movimiento: { organizacionId: org, estado: { not: "ANULADO" } } }, include: { movimiento: { include: { categoria: true } } } }),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.venta.findMany({ where: { organizacionId: org, estado: "CONFIRMADA" } }),
    prisma.produccionMensualImportada.findMany({ where: { organizacionId: org } }),
    prisma.prestamo.findMany({ where: { organizacionId: org }, include: { cuotas: true } }),
    prisma.productoInventario.findMany({ where: { tenantId: org } }),
    prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" }, productoSanitarioId: { not: null } } }),
    prisma.movimientoInventario.findMany({ where: { tenantId: org, tipo: "SALIDA" } }),
    prisma.loteInventario.findMany({ where: { tenantId: org } }),
    prisma.presupuesto.findMany({ where: { organizacionId: org, mes: { gte: 202601, lte: mesSep } } }),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org } }),
    prisma.saldoDeclarado.findMany({ where: { organizacionId: org } }),
  ]);
  const aMov = (m: (typeof movsRaw)[number]): MovHoja => ({ mes: m.mes, tipo: m.tipo as MovHoja["tipo"], montoGs: m.montoGs, cantidad: m.cantidad === null ? null : Number(m.cantidad), fecha: m.fecha, esInterno: m.esInterno,
    categoria: { id: m.categoria.id, nombre: m.categoria.nombre, naturaleza: m.categoria.naturaleza, area: m.categoria.area, grupoCosto: m.categoria.grupoCosto, dieta: m.categoria.dieta, vidaUtil: m.categoria.vidaUtil } });
  const movs = movsRaw.filter(m => m.mes >= 202601 && m.mes <= 202612).map(aMov);
  const invs = movsRaw.filter(m => m.tipo === "INVERSION" && m.mes <= 202612).map(aMov);
  const prod: ProdMes[] = Array.from({ length: 12 }, (_, k) => {
    const p = importada.find(x => x.mes === anio * 100 + k + 1);
    const vs = ventas.filter(v => v.fechaSalida.getUTCFullYear() === anio && v.fechaSalida.getUTCMonth() === k);
    return { servicios: p?.servicios ?? 0, partos: p?.partos ?? 0, nacidosTotales: p?.nacidosTotales ?? 0, nacidosVivos: p?.nacidosVivos ?? 0, muertosAlNacer: p?.muertosAlNacer ?? 0, destetados: p?.destetados ?? 0, muertosLactancia: p?.muertosLactancia ?? 0,
      entregados: vs.reduce((s, v) => s + v.cantidad, 0), kgEntregados: vs.reduce((s, v) => s + Number(v.kgTotales), 0), ingresosLechonesGs: vs.reduce((s, v) => s + v.importeGs, 0n) };
  });
  const matrices = Array(12).fill(params?.matricesActivasManual ?? 37);
  const P: ParamsHojas = { vidaObraAnios: params?.vidaObraAnios ?? 20, vidaEquiposAnios: params?.vidaEquiposAnios ?? 10, modoAmortizacion: "PLANILLA", amortizarMatrices: false, vidaMatrizMeses: 36, valorDescarteMatrizGs: 2_000_000n, imputacionSanidad: "COMPRA" };
  const al = hojaAlimentacion(movs, prod, matrices);
  const co = hojaCostos(movs.filter(m => m.mes <= mesSep), invs.filter(m => m.mes <= mesSep), prod, matrices, P, anio, undefined, mesSep);
  const fv = hojaFijosVariables(movs.filter(m => m.mes <= mesSep), mesSep);
  const efecto = pagos.reduce((s, p) => s + (p.movimiento.signo > 0 ? p.montoGs : -p.montoGs), 0n);
  const pendientesLibro = movsRaw.filter(m => m.estado === "PENDIENTE").reduce((s, m) => s + m.montoGs - m.pagos.reduce((t, p) => t + p.montoGs, 0n), 0n);
  const flujo = flujoReal(pagos.map(p => ({ fechaPago: p.fechaPago, montoGs: p.montoGs, signo: p.movimiento.signo, tipo: p.movimiento.tipo, categoria: p.movimiento.categoria.nombre, esInterno: p.movimiento.esInterno })), 202511, mesSep, 0n);
  const del2026 = flujo.filter(m => m.mes >= 202601);
  const egresoProm = del2026.length ? del2026.reduce((s, m) => s + Number(m.egresosOperativos), 0) / del2026.length : 0;
  const saldoSep = flujo.at(-1)?.saldoFinal ?? 0n;
  // Sanidad
  const filasSan = productos.map(pr => filaSanidad({
    id: pr.id, nombre: pr.nombre, tipo: pr.categoria, unidadMedida: pr.unidadMedida, dosisMl: Number(pr.dosisMl),
    compradoUnidades: compras.filter(c => c.productoSanitarioId === pr.id).reduce((s, c) => s + Number(c.cantidad ?? 0), 0),
    compradoMl: compras.filter(c => c.productoSanitarioId === pr.id).reduce((s, c) => s + Number(c.mlComprados ?? 0), 0),
    compradoGs: compras.filter(c => c.productoSanitarioId === pr.id).reduce((s, c) => s + c.montoGs, 0n),
    precioListaPorMl: (() => { const l = lotes.filter(x => x.vacunaId === pr.id && x.costoUnitario !== null); return l.length ? Number(l[0].costoUnitario) : null; })(),
    usadoCantidad: usos.filter(u => u.productoId === pr.id).reduce((s, u) => s + Number(u.cantidad), 0),
    stockCantidad: lotes.filter(x => x.vacunaId === pr.id).reduce((s, x) => s + Number(x.cantidadActual), 0), conteoCantidad: null,
  }));
  // Deudas
  const resumenes = prestamos.map(p => ({ p, r: resumenPrestamo(p, p.cuotas.map(c => ({ ...c, pagada: !!c.movimientoId })), corte) }));
  const invTotal = invs.filter(m => m.fecha.getTime() <= corte.getTime()).reduce((s, m) => s + m.montoGs, 0n);
  const unidades = await prisma.unidadNegocio.findMany({ where: { organizacionId: org } });
  const granjaId = unidades.find(u => u.tipo === "GRANJA")?.id;
  const invGranja = movsRaw.filter(m => m.tipo === "INVERSION" && m.unidadId === granjaId && m.fecha.getTime() <= corte.getTime()).reduce((s, m) => s + m.montoGs, 0n);
  const realAcum = movsRaw.filter(m => (m.tipo === "GASTO" || m.tipo === "INVERSION") && m.mes >= 202601 && m.mes <= mesSep).reduce((s, m) => s + m.montoGs, 0n);
  const presAcum = presup.reduce((s, p) => s + p.montoGs, 0n);
  const grupos = new Map<string, bigint>();
  for (const m of movs.filter(x => x.tipo === "GASTO" && x.mes <= mesSep)) { const g = movsRaw.find(r => r.categoria.id === m.categoria.id)?.categoria.grupoTablero ?? "—"; grupos.set(g, (grupos.get(g) ?? 0n) + m.montoGs); }
  const pe = puntoEquilibrio(Number(fv.fijos[i]), Number(fv.variables[i]), prod[i].entregados, Number(params?.precioReferenciaLechonGs ?? 435000n));
  const kgD = (d: string) => sumaN(al.kg[d as (typeof DIETAS)[number]]);

  type Fila = [string, string, number | bigint | null, number | bigint, number?];
  const F: Fila[] = [
    ["Libro", "Filas manuales", movsRaw.filter(m => !/AUTOMÁTICO/.test(m.observacion ?? "")).length, 357],
    ["Libro", "Filas automáticas de balanceado", movsRaw.filter(m => /AUTOMÁTICO/.test(m.observacion ?? "")).length, 20],
    ["Libro", "Σ efecto en caja", efecto, 13_000_000n],
    ["Caja y bancos", "Saldo declarado total", declarados.reduce((s, d) => s + d.saldoGs, 0n), 13_000_000n],
    ["Caja y bancos", "Caja chica asignada", cuentas.find(c => c.tipo === "CAJA_CHICA")?.montoAsignadoGs ?? 0n, 1_000_000n],
    ["Ventas", "Lechones", sumaN(ventas.map(v => v.cantidad)), 79],
    ["Ventas", "Kg", Math.round(sumaN(ventas.map(v => Number(v.kgTotales)))), 1810],
    ["Ventas", "Importe", ventas.reduce((s, v) => s + v.importeGs, 0n), 28_812_650n],
    ["Cuentas por cobrar", "Saldo", movsRaw.filter(m => m.estado === "POR_COBRAR").reduce((s, m) => s + m.montoGs, 0n), 0n],
    ["Cuentas por pagar", "Saldo (el ERP usa el libro; la planilla, una hoja aparte)", pendientesLibro, 40_857_943n],
    ["Producción septiembre", "Nacidos vivos", prod[i].nacidosVivos, 89],
    ["Producción septiembre", "Destetados", prod[i].destetados, 71],
    ["Producción año", "Servicios", sumaN(prod.map(p => p.servicios)), 59],
    ["Producción año", "Nacidos vivos", sumaN(prod.map(p => p.nacidosVivos)), 263],
    ["Alimentación", "Kg del año", Math.round(sumaN(al.totalKg) * 10) / 10, 28459.5, 0.1],
    ["Alimentación", "Kg gestación", Math.round(kgD("GESTACION")), 21467],
    ["Alimentación", "Kg lactación", Math.round(kgD("LACTACION")), 4810],
    ["Alimentación", "Gs del año", sumaB(al.totalGs), 87_075_474n],
    ["Alimentación", "Gs septiembre", al.totalGs[i], 17_806_567n],
    ["Alimentación", "Precio gestación septiembre", Math.round((al.precio.GESTACION[i] ?? 0) * 100) / 100, 2561.69, 0.01],
    ["Alimentación", "Precio lactación septiembre", Math.round((al.precio.LACTACION[i] ?? 0) * 100) / 100, 3046.29, 0.01],
    ["Alimentación", "Alimento por matriz septiembre", Math.round(al.indicadores.porMatriz[i] ?? 0), 481259, 1],
    ["Alimentación", "Alimento por lechón destetado septiembre", Math.round(al.indicadores.porDestetado[i] ?? 0), 105333, 1],
    ["Alimentación", "Alimento por lechón entregado septiembre", Math.round(al.indicadores.porEntregado[i] ?? 0), 225400, 1],
    ["Sanidad", "Comprado (catálogo)", filasSan.reduce((s, f) => s + f.compradoGs, 0n), 13_975_002n],
    ["Sanidad", "Costo de lo usado", filasSan.reduce((s, f) => s + (f.costoUsadoGs ?? 0n), 0n), 2_615_285n, 5],
    ["Sanidad", "Valor del stock", filasSan.reduce((s, f) => s + (f.valorStockGs ?? 0n), 0n), 10_404_717n, 5],
    ["Costos septiembre", "Alimentación", co.subAlim[i], 17_806_567n],
    ["Costos septiembre", "Otros directos", co.subDirectos[i], 6_808_000n],
    ["Costos septiembre", "Estructura", co.subEstructura[i], 2_400_000n],
    ["Costos septiembre", "Amortización", co.amortizacion[i], 1_561_347n, 1],
    ["Costos septiembre", "Total con amortización", co.conAmort[i], 28_575_914n, 1],
    ["Costos septiembre", "Costo por lechón entregado", Math.round(co.unit.costoPorEntregado[i] ?? 0), 361720, 1],
    ["Costos septiembre", "Margen por lechón", Math.round(co.unit.margenPorLechon[i] ?? 0), 2997, 1],
    ["Costos año", "Total sin amortización", sumaB(co.sinAmort), 165_633_476n],
    ["Costos año", "Amortización", sumaB(co.amortizacion), 14_052_123n, 9],
    ["Fijos y variables", "Fijos del año", sumaB(fv.fijos), 53_178_500n],
    ["Fijos y variables", "Variables del año", sumaB(fv.variables), 112_454_976n],
    ["Presupuesto vs real", "Presupuesto acumulado", presAcum, 389_878_574n],
    ["Presupuesto vs real", "Real acumulado", realAcum, 367_455_277n],
    ["Flujo de caja", "Saldo final septiembre", saldoSep, 13_000_000n],
    ["Flujo de caja", "Flujo real acumulado 2026", del2026.reduce((s, m) => s + m.flujoNeto, 0n), -269_793_196n],
    ["Flujo de caja", "Egreso operativo mensual promedio", Math.round(egresoProm), 16785164, 1],
    ["Inversiones", "Total", invTotal, 589_611_072n],
    ["Inversiones", "De la granja", invGranja, 417_761_071n],
    ["Deudas", "Recibido", prestamos.reduce((s, p) => s + p.montoRecibidoGs, 0n), 400_482_917n],
    ["Deudas", "Cuota mensual", prestamos.reduce((s, p) => s + p.cuotaMensualGs, 0n), 13_873_054n],
    ["Deudas", "Saldo pendiente", resumenes.reduce((s, x) => s + x.r.saldo, 0n), 439_509_216n],
    ["Deudas", "Costo financiero", resumenes.reduce((s, x) => s + x.r.costoFinanciero, 0n), 159_340_773n],
    ["Deudas", "Pagado", resumenes.reduce((s, x) => s + x.p.cuotas.filter(c => c.movimientoId).reduce((t, c) => t + c.montoGs, 0n), 0n), 120_314_474n],
    ...prestamos.map(p => ["Deudas", `Tasa anual ${p.concepto}`, Math.round((tasaAnual(tasaImplicita(Number(p.montoRecibidoGs), Number(p.cuotaMensualGs), p.numeroCuotas)) ?? 0) * 10000) / 100, ({ "Préstamo Continental": 17.53, "Préstamo Coop. Universitaria I": 23.65, "Préstamo Itaú I": 22.5, "Préstamo Itaú II": 22.1, "Préstamo Coop. Universitaria II": 31.54 } as Record<string, number>)[p.concepto] ?? 0, 0.01] as Fila),
    ["¿En qué se va la plata?", "Balanceado", grupos.get("BALANCEADO") ?? 0n, 87_075_474n],
    ["¿En qué se va la plata?", "Personal", grupos.get("PERSONAL") ?? 0n, 47_000_000n],
    ["¿En qué se va la plata?", "Sanidad y veterinario", grupos.get("SANIDAD_VET") ?? 0n, 18_345_502n],
    ["Indicadores", "Punto de equilibrio septiembre (lechones)", pe.valor === null ? null : Math.round(pe.valor * 10) / 10, 34.6, 0.1],
  ];
  let ok = 0;
  const lineas = F.map(([hoja, nombre, erp, esperado, tol = 0]) => {
    const dif = erp === null ? null : Number(erp) - Number(esperado);
    const bien = dif !== null && Math.abs(dif) <= tol;
    if (bien) ok++;
    const f = (v: number | bigint | null) => v === null ? "—" : typeof v === "bigint" || Math.abs(Number(v)) >= 1000 ? gs(typeof v === "bigint" ? v : Math.round(Number(v))) : String(v);
    return `${bien ? "✓" : "✗"} ${hoja} · ${nombre}: ERP ${f(erp)} · planilla ${f(esperado)}${bien ? "" : ` · diferencia ${dif === null ? "—" : f(dif)}`}`;
  });
  console.log(`\nInforme de validación contra el Anexo H (corte ${CORTE}): ${ok} de ${F.length} coinciden\n`);
  console.log(lineas.join("\n"));
}

async function main() {
  const soloValidar = process.env.SOLO_VALIDAR;
  if (soloValidar) return validar(soloValidar);
  const ruta = process.env.PLANILLA, email = (process.env.PROPIETARIO ?? "").toLowerCase(), destino = process.env.DESTINO ?? "";
  if (!ruta || !email || !destino) throw new Error("Faltan PLANILLA, PROPIETARIO y DESTINO");
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error(`No existe la cuenta ${email}`);
  const libro = leerLibro(readFileSync(ruta));
  let org = destino;
  if (destino.startsWith("nueva:")) {
    const nombre = destino.slice(6).trim();
    const existente = await prisma.tenant.findFirst({ where: { farmName: nombre, miembros: { some: { userId: user.id, esPropietario: true } } } });
    org = existente?.id ?? (await crearOrganizacion(user.id, { tipo: "EMPRESA", nombre, departamento: "Misiones", claveCreacion: randomUUID() })).id;
    console.log(`  Organización: ${nombre} (${org})${existente ? " · ya existía" : " · creada"}`);
  }
  const yaTiene = await prisma.movimiento.count({ where: { organizacionId: org } });
  if (yaTiene) throw new Error(`La organización ya tiene ${yaTiene} movimientos: la importación es para una organización vacía.`);
  const t0 = Date.now();
  const r = await importar(libro, user.id, org);
  console.log(`  ✓ Importado en ${Math.round((Date.now() - t0) / 1000)} s:`, r);
  await validar(org);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
