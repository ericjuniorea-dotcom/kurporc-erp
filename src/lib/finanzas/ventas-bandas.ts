// Fase 9 · Proyección de ventas en modo CALENDARIO_BANDAS (8.15):
//  - Lechones: de cada cerda servida o gestante, parto = servicio + gestación y venta al destete
//    (parto + lactancia), lechonesPorParto × precio esperado. Más allá de lo que cubre el calendario
//    (los meses sin servicios conocidos) se usa el parámetro "lechones a vender por mes".
//  - Cerdos terminados: cada lote de engorde propio abierto sale el mes en que su curva llega al peso
//    objetivo, presentes × peso objetivo × precio del kg vivo. Los lotes integrados no se cuentan
//    (los paga el integrador según su tarifa).
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC, mesDe } from "./calculos";
import { analizarLote } from "@/lib/engorde/lote";

const DIA = 86_400_000;

export type VentasBandas = { porMes: Map<number, bigint>; lechones: Map<number, number>; cerdos: Map<number, number>; cubreHasta: number; detalle: string };

export async function ventasPorBandas(org: string): Promise<VentasBandas> {
  const hoy = hoyUTC();
  const [params, sows, servicios, partos, lotes, metas] = await Promise.all([
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.sow.findMany({ where: { tenantId: org, isActive: true, plantelState: { in: ["MATED", "PREGNANT", "FARROWING", "LACTATING"] } }, select: { id: true, plantelState: true } }),
    prisma.serviceEvent.findMany({ where: { tenantId: org, serviceDate: { gte: new Date(hoy.getTime() - 130 * DIA) } }, orderBy: { serviceDate: "desc" }, select: { sowId: true, serviceDate: true } }),
    prisma.farrowingEvent.findMany({ where: { tenantId: org, startDatetime: { gte: new Date(hoy.getTime() - 400 * DIA) } }, orderBy: { startDatetime: "desc" }, select: { sowId: true, startDatetime: true, bornAlive: true } }),
    prisma.growingBatch.findMany({ where: { tenantId: org, status: "ACTIVE", modalidad: { not: "INTEGRADO" } }, select: { id: true } }),
    prisma.configMeta.findMany({ where: { tenantId: org }, select: { modulo: true, kpiKey: true, valor: true } }),
  ]);
  const meta = (m: string, k: string, d: number) => { const x = metas.find(v => v.modulo === m && v.kpiKey === k); return x ? Number(x.valor) : d; };
  const gestacion = meta("GESTACION", "dias_gestacion", 115), lactancia = meta("MATERNIDAD", "dias_lactancia", 21);
  const ultimos = partos.slice(0, 10);
  const nv = ultimos.length >= 3 ? ultimos.reduce((s, p) => s + p.bornAlive, 0) / ultimos.length : meta("MATERNIDAD", "nacidos_vivos_meta", 13);
  const porParto = Math.round(nv * (1 - meta("MATERNIDAD", "mortalidad_pct_max", 8) / 100));
  const precioLechon = params?.precioEsperadoLechonGs ?? 0n;
  const precioKg = Number(params?.precioKgVivoGs ?? 0n);

  const lechones = new Map<number, number>(), cerdos = new Map<number, number>(), porMes = new Map<number, bigint>();
  const sumar = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const sumarGs = (k: number, v: bigint) => porMes.set(k, (porMes.get(k) ?? 0n) + v);
  let ultimaVenta = hoy.getTime();

  for (const s of sows) {
    let destete: Date | null = null, cantidad = porParto;
    if (s.plantelState === "LACTATING" || s.plantelState === "FARROWING") {
      const p = partos.find(x => x.sowId === s.id);
      if (p) { destete = new Date(p.startDatetime.getTime() + lactancia * DIA); cantidad = Math.round(p.bornAlive * (1 - meta("MATERNIDAD", "mortalidad_pct_max", 8) / 100)); }
    } else {
      const sv = servicios.find(x => x.sowId === s.id);
      if (sv) destete = new Date(sv.serviceDate.getTime() + (gestacion + lactancia) * DIA);
    }
    if (!destete || destete.getTime() < hoy.getTime()) continue;
    const mes = mesDe(destete);
    sumar(lechones, mes, cantidad);
    sumarGs(mes, BigInt(cantidad) * precioLechon);
    ultimaVenta = Math.max(ultimaVenta, destete.getTime());
  }

  for (const { id } of lotes) {
    const a = await analizarLote(org, id);
    if (!a || a.ind.presentes <= 0) continue;
    const salida = new Date(hoy.getTime() + (a.diasFaltan ?? 0) * DIA);
    const mes = mesDe(salida);
    sumar(cerdos, mes, a.ind.presentes);
    sumarGs(mes, BigInt(Math.round(a.ind.presentes * a.objetivo * precioKg)));
  }

  const cubreHasta = mesDe(new Date(ultimaVenta));
  const totalLech = Array.from(lechones.values()).reduce((s, x) => s + x, 0), totalCerdos = Array.from(cerdos.values()).reduce((s, x) => s + x, 0);
  return {
    porMes, lechones, cerdos, cubreHasta,
    detalle: `${totalLech} lechones de los partos y destetes que vienen (${porParto} por parto) y ${totalCerdos} cerdos terminados de los lotes de engorde según su curva`,
  };
}
