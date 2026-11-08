export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { MODULOS_FIJOS, computeStockAlertas } from "@/lib/sanidad/vision-general";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.aplicaciones.ver", "sanidad.tratamientos.ver", "sanidad.protocolos.ver", "sanidad.necropsias.ver", "sanidad.botiquin.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7    = new Date(today); in7.setDate(in7.getDate() + 7);
  const ago30  = new Date(today); ago30.setDate(ago30.getDate() - 30);

  const [eventos, aplicacionesVentana, stockAlertas] = await Promise.all([
    prisma.eventoVacunacion.findMany({
      where:  { tenantId, estado: { not: "omitido" } },
      include: { vacuna: { select: { nombre: true } } },
      orderBy: { fecha: "asc" },
    }),
    prisma.aplicacionVacuna.findMany({
      where:  { tenantId, fechaAplicacion: { gte: ago30 } },
      select: { eventoId: true, fechaAplicacion: true },
    }),
    computeStockAlertas(tenantId, "VACUNA"),
  ]);

  const primeraAplicacionPorEvento = new Map<string, Date>();
  for (const a of aplicacionesVentana) {
    const curr = primeraAplicacionPorEvento.get(a.eventoId);
    if (!curr || a.fechaAplicacion < curr) primeraAplicacionPorEvento.set(a.eventoId, a.fechaAplicacion);
  }

  // Recalcular estado para pantalla (igual criterio que /api/sanidad/eventos)
  const eventosVivos = eventos.map(e => {
    let estado = e.estado;
    if (estado === "pendiente" && e.fecha < today) estado = "retrasado";
    return { ...e, estado };
  });

  // ── KPIs ──────────────────────────────────────────────────────────
  const eventosVentana = eventosVivos.filter(e => e.fecha >= ago30 && e.fecha <= today);
  const aTiempo = eventosVentana.filter(e => {
    if (e.estado !== "aplicado") return false;
    const fechaApp = primeraAplicacionPorEvento.get(e.id);
    return !!fechaApp && fechaApp <= e.fecha;
  });
  const cumplimientoPct = eventosVentana.length > 0
    ? Math.round((aTiempo.length / eventosVentana.length) * 100)
    : 100;

  const retrasados = eventosVivos.filter(e => e.estado === "retrasado");
  const promedioAtrasoDias = retrasados.length > 0
    ? Math.round(retrasados.reduce((s, e) => s + Math.floor((today.getTime() - e.fecha.getTime()) / 86400000), 0) / retrasados.length)
    : 0;

  const paraHoyProx7d = eventosVivos.filter(e => e.estado === "pendiente" && e.fecha >= today && e.fecha <= in7);

  const inicioSemanaActual = new Date(today);
  inicioSemanaActual.setDate(today.getDate() - today.getDay());
  const inicioSemanaAnterior = new Date(inicioSemanaActual);
  inicioSemanaAnterior.setDate(inicioSemanaActual.getDate() - 7);

  const aplicadasEstaSemana = aplicacionesVentana.filter(a => a.fechaAplicacion >= inicioSemanaActual).length;
  const aplicadasSemanaAnterior = aplicacionesVentana.filter(a => a.fechaAplicacion >= inicioSemanaAnterior && a.fechaAplicacion < inicioSemanaActual).length;
  const tendencia = aplicadasEstaSemana > aplicadasSemanaAnterior ? "up" : aplicadasEstaSemana < aplicadasSemanaAnterior ? "down" : "same";

  const alertasStockCount = stockAlertas.filter(a => a.alertaStock).length;

  const kpis = {
    cumplimientoPct,
    retrasadas: { count: retrasados.length, promedioAtrasoDias },
    paraHoyProx7d: paraHoyProx7d.length,
    aplicadasEstaSemana: { count: aplicadasEstaSemana, tendencia },
    alertasStock: alertasStockCount,
    estadoGeneral: retrasados.length === 0 && alertasStockCount === 0 ? "al_dia" : "atencion",
  };

  // ── Módulos → vacunas → animales ───────────────────────────────────
  const modulos = MODULOS_FIJOS.map(m => {
    const eventosModulo = eventosVivos.filter(e => e.sector === m.key && e.estado !== "aplicado");
    const retrasadasModulo = eventosModulo.filter(e => e.estado === "retrasado").length;
    const proximasModulo = eventosModulo.filter(e => e.estado === "pendiente" && e.fecha <= in7).length;

    const porVacuna = new Map<string, typeof eventosModulo>();
    for (const e of eventosModulo) {
      if (!porVacuna.has(e.vacunaId)) porVacuna.set(e.vacunaId, []);
      porVacuna.get(e.vacunaId)!.push(e);
    }

    const vacunas = Array.from(porVacuna.entries()).map(([vacunaId, evs]) => ({
      vacunaId,
      nombre: evs[0].vacuna.nombre,
      totalAnimales: evs.length,
      retrasadas: evs.filter(e => e.estado === "retrasado").length,
      animales: evs.map(e => ({
        eventoId:        e.id,
        targetLabel:     e.targetLabel,
        fecha:           e.fecha.toISOString(),
        dosisNecesarias: e.dosisNecesarias,
        estado:          e.estado,
        diasRestantes:   Math.floor((e.fecha.getTime() - today.getTime()) / 86400000),
      })),
    })).sort((a, b) => b.retrasadas - a.retrasadas || b.totalAnimales - a.totalAnimales);

    return {
      key: m.key,
      label: m.label,
      totalPendientes: eventosModulo.length,
      retrasadas: retrasadasModulo,
      proximas: proximasModulo,
      vacunas,
    };
  });

  // Módulo a expandir por defecto: el primero con retrasadas > 0, si no el de más pendientes
  const conRetrasadas = modulos.find(m => m.retrasadas > 0);
  const expandirPorDefecto = conRetrasadas
    ? conRetrasadas.key
    : modulos.reduce((max, m) => (m.totalPendientes > max.totalPendientes ? m : max), modulos[0]).key;

  return NextResponse.json({ kpis, modulos, expandirPorDefecto });
}
