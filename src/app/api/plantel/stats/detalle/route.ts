// Detalle de cada cuadro del Plantel (Stock general, Preñadas, Servidas, Disponibles, Reproductores, Cuarentena).
// Misma clasificación que /api/plantel/stats para que la lista coincida con el número del cuadro.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { idsCamadasAbiertas, SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";
import { stockCamada } from "@/lib/auditoria/granja";
import { parametrosParadas } from "@/lib/cerdas-paradas/datos";

const GRUPOS = ["GENERAL", "MATERNIDAD", "PRENADAS", "SERVIDAS", "DISPONIBLES", "REPRODUCTORES", "CUARENTENA"] as const;
type Grupo = (typeof GRUPOS)[number];
const DIA = 86_400_000;
const ESTADO: Record<string, string> = {
  QUARANTINE: "Cuarentena", REPLACEMENT_DEVELOPING: "Cachorra en desarrollo", REPLACEMENT_READY: "Lista para servicio", MATED: "Servida",
  PREGNANT: "Preñada", FARROWING: "Pariendo", LACTATING: "Lactante", EMPTY: "Vacía", ACTIVE: "Activo", RESTING: "En descanso",
};
const CATEGORIA: Record<Exclude<Grupo, "GENERAL">, string> = {
  MATERNIDAD: "Maternidad", PRENADAS: "Preñada", SERVIDAS: "Servida", DISPONIBLES: "Disponible", REPRODUCTORES: "Reproductor", CUARENTENA: "Cuarentena",
};
const dd = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

export type FilaDetalle = {
  id: string; tipo: "cerda" | "verraco"; caravana: string; categoria: string; estado: string; linea: string | null;
  fecha: string | null; dias: number | null; detalle: string;
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "plantel.animales.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "plantel.animales.ver" }, { status: 403 });
  const grupo = req.nextUrl.searchParams.get("grupo") as Grupo | null;
  if (!grupo || !GRUPOS.includes(grupo)) return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  const tenantId = session.user.tenantId;
  const hoy = Date.now();
  const dias = (d: Date) => Math.floor((hoy - d.getTime()) / DIA);

  const [estados, abiertas, sows, p, cfgCuarentena] = await Promise.all([
    getGestacionStates(tenantId),
    idsCamadasAbiertas(tenantId),
    prisma.sow.findMany({ where: { tenantId, isActive: true }, select: { id: true, identCode: true, caravanaCode: true, plantelState: true, breed: true, entryDate: true } }),
    parametrosParadas(tenantId),
    prisma.configProceso.findFirst({ where: { tenantId, modulo: "PLANTEL", procesoKey: "cuarentena_hembras" }, select: { valor: true } }),
  ]);
  const camadas = abiertas.length
    ? await prisma.farrowingEvent.findMany({ where: { id: { in: abiertas } }, select: { sowId: true, startDatetime: true, ...SELECT_STOCK_CAMADA } })
    : [];
  const enMat = new Map(camadas.map(c => [c.sowId, c]));
  const gest = new Map(estados.filter(e => e.estado !== "DISPONIBLE").map(e => [e.sowId, e]));
  const diasCuarentena = Number((cfgCuarentena?.valor as Record<string, unknown> | null)?.dias_cuarentena ?? 30) || 30;

  const filas: FilaDetalle[] = [];
  const quiero = (g: Exclude<Grupo, "GENERAL">) => grupo === "GENERAL" || grupo === g;

  for (const s of sows) {
    const base = { id: s.id, tipo: "cerda" as const, caravana: s.caravanaCode || s.identCode, estado: ESTADO[s.plantelState ?? ""] ?? "—", linea: s.breed };
    const c = enMat.get(s.id);
    const g = gest.get(s.id);
    if (c) {
      if (!quiero("MATERNIDAD")) continue;
      const destete = new Date(c.startDatetime.getTime() + p.lactanciaDias * DIA);
      filas.push({ ...base, categoria: CATEGORIA.MATERNIDAD, fecha: c.startDatetime.toISOString(), dias: dias(c.startDatetime),
        detalle: `${stockCamada(c)} lechones · destete previsto ${dd(destete)}` });
    } else if (g) {
      const k = g.estado === "PRENADA" ? "PRENADAS" : "SERVIDAS";
      if (!quiero(k)) continue;
      const parto = new Date(g.serviceDate.getTime() + p.gestacionDias * DIA);
      const eco = new Date(g.serviceDate.getTime() + 28 * DIA);
      filas.push({ ...base, categoria: CATEGORIA[k], fecha: g.serviceDate.toISOString(), dias: g.diasDesdeServ,
        detalle: k === "PRENADAS" ? `parto previsto ${dd(parto)}` : `${g.checkResult === "NOT_PREGNANT" ? "diagnóstico negativo" : "sin diagnóstico"} · ecografía ${dd(eco)}` });
    } else if (s.plantelState === "QUARANTINE") {
      if (!quiero("CUARENTENA")) continue;
      const faltan = diasCuarentena - dias(s.entryDate);
      filas.push({ ...base, categoria: CATEGORIA.CUARENTENA, fecha: s.entryDate.toISOString(), dias: dias(s.entryDate),
        detalle: faltan > 0 ? `faltan ${faltan} días para el alta` : `cumplió los ${diasCuarentena} días: lista para el alta` });
    } else {
      if (!quiero("DISPONIBLES")) continue;
      filas.push({ ...base, categoria: CATEGORIA.DISPONIBLES, fecha: null, dias: null, detalle: "" });
    }
  }

  // Disponibles: desde el último destete (o el ingreso si nunca parió)
  const disp = filas.filter(f => f.categoria === CATEGORIA.DISPONIBLES);
  if (disp.length) {
    const destetes = await prisma.weaningEvent.findMany({
      where: { tenantId, farrowing: { sowId: { in: disp.map(d => d.id) } } }, orderBy: { weaningDate: "desc" },
      select: { weaningDate: true, farrowing: { select: { sowId: true } } },
    });
    const ultimo = new Map<string, Date>();
    for (const d of destetes) if (!ultimo.has(d.farrowing.sowId)) ultimo.set(d.farrowing.sowId, d.weaningDate);
    const ingreso = new Map(sows.map(s => [s.id, s.entryDate]));
    for (const f of disp) {
      const d = ultimo.get(f.id);
      const desde = d ?? ingreso.get(f.id)!;
      f.fecha = desde.toISOString(); f.dias = dias(desde);
      f.detalle = d ? `${f.dias} días desde el destete` : `${f.dias} días desde el ingreso, sin partos`;
    }
  }

  if (quiero("REPRODUCTORES")) {
    const boars = await prisma.boar.findMany({ where: { tenantId, plantelState: { in: ["ACTIVE", "RESTING"] } }, select: { id: true, identCode: true, caravanaCode: true, plantelState: true, breed: true, entryDate: true } });
    for (const b of boars) filas.push({
      id: b.id, tipo: "verraco", caravana: b.caravanaCode || b.identCode, categoria: CATEGORIA.REPRODUCTORES, estado: ESTADO[b.plantelState ?? ""] ?? "—",
      linea: b.breed, fecha: b.entryDate?.toISOString() ?? null, dias: b.entryDate ? dias(b.entryDate) : null, detalle: "",
    });
  }

  filas.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return NextResponse.json(filas);
}
