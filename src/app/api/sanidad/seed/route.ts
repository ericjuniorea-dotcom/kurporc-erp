export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

// Protocolo sanitario KurPorc por defecto
const VACUNAS_DEFAULT = [
  { nombre: "Vacuna E. coli",               enfermedad: "Colibacilosis",               sectorDestino: "lechon",  viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false },
  { nombre: "Hierro Dextrán 200mg",          enfermedad: "Anemia ferropénica",           sectorDestino: "lechon",  viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false, categoria: "SUPLEMENTO" },
  { nombre: "Vacuna Circovirus PCV2",        enfermedad: "Circovirus porcino tipo 2",    sectorDestino: "lechon",  viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false },
  { nombre: "Vacuna Mycoplasma hyopneumoniae", enfermedad: "Neumonía enzoótica",         sectorDestino: "lote",    viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false },
  { nombre: "Vacuna Influenza porcina H1N1", enfermedad: "Influenza porcina",            sectorDestino: "lote",    viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false },
  { nombre: "Parvovirus + Erisipela",        enfermedad: "Parvovirosis / Mal rojo",      sectorDestino: "cerda",   viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: true,
    observaciones: "Obligatoria antes del primer servicio. Bloquea monta si no está al día." },
  { nombre: "Vacuna PRRS",                   enfermedad: "Síndrome reproductivo y respiratorio", sectorDestino: "plantel", viaAplicacion: "IM", dosisMl: 2, criticidad: "alta",  bloqueoServicio: false },
  { nombre: "Vacuna Leptospirosis",          enfermedad: "Leptospirosis",                sectorDestino: "cerda",   viaAplicacion: "IM",   dosisMl: 2,   criticidad: "media", bloqueoServicio: false, intervaloRefuerzo: 180 },
  { nombre: "Vacuna Aujeszky (Pseudo-rabia)", enfermedad: "Enfermedad de Aujeszky",      sectorDestino: "plantel", viaAplicacion: "IM",   dosisMl: 2,   criticidad: "alta",  bloqueoServicio: false, intervaloRefuerzo: 180 },
];

const PROTOCOLOS_DEFAULT = [
  {
    nombre: "Protocolo Maternidad — Lechones",
    fase: "maternidad", tipoAnimal: "lechon",
    descripcion: "Protocolo sanitario estándar para lechones desde el nacimiento hasta el destete",
    items: [
      { vacunaKey: 0, diaCiclo: 1,  disparador: "parto", esObligatorio: true,  bloqueoServicio: false, descripcion: "Vacuna E. coli día 1 post-parto" },
      { vacunaKey: 1, diaCiclo: 3,  disparador: "parto", esObligatorio: true,  bloqueoServicio: false, descripcion: "Hierro dextrán día 3 post-parto" },
      { vacunaKey: 2, diaCiclo: 7,  disparador: "parto", esObligatorio: true,  bloqueoServicio: false, descripcion: "Circovirus PCV2 día 7 post-parto" },
    ],
  },
  {
    nombre: "Protocolo Gestación — Cerdas",
    fase: "gestacion", tipoAnimal: "cerda",
    descripcion: "Protocolo sanitario para cerdas gestantes desde el servicio",
    items: [
      { vacunaKey: 5, diaCiclo: 42, disparador: "servicio", esObligatorio: true, bloqueoServicio: true,  descripcion: "Parvovirus + Erisipela 42 días post-servicio" },
    ],
  },
  {
    nombre: "Protocolo Iniciación — Lotes",
    fase: "iniciacion", tipoAnimal: "lote",
    descripcion: "Protocolo sanitario para lotes de iniciación post-destete",
    items: [
      { vacunaKey: 3, diaCiclo: 21, disparador: "destete", esObligatorio: true,  bloqueoServicio: false, descripcion: "Mycoplasma día 21 post-destete" },
      { vacunaKey: 4, diaCiclo: 28, disparador: "destete", esObligatorio: true,  bloqueoServicio: false, descripcion: "Influenza porcina día 28 post-destete" },
    ],
  },
];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowedRoles = [1, 2, 5];
  if (!session.user.roles.some((r: number) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { tenantId } = session.user;

  // Check existing
  const existingCount = await prisma.productoInventario.count({ where: { tenantId } });
  if (existingCount > 0) {
    return NextResponse.json({ message: "Ya inicializado", vacunas: existingCount });
  }

  // Create vacunas (código V-XXX / S-XXX correlativo por categoría)
  const PREFIJO: Record<string, string> = { VACUNA: "V", SUPLEMENTO: "S", MEDICAMENTO: "M" };
  const seq: Record<string, number> = {};
  const vacunasCreadas: string[] = [];
  for (const v of VACUNAS_DEFAULT) {
    const categoria = (v as { categoria?: string }).categoria ?? "VACUNA";
    const prefijo = PREFIJO[categoria] ?? "V";
    seq[prefijo] = (seq[prefijo] ?? 0) + 1;
    const codigo = `${prefijo}-${String(seq[prefijo]).padStart(3, "0")}`;
    const created = await prisma.productoInventario.create({
      data: { ...v, categoria: categoria as never, tenantId, codigo, dosisMl: v.dosisMl, intervaloRefuerzo: (v as { intervaloRefuerzo?: number }).intervaloRefuerzo ?? null },
    });
    vacunasCreadas.push(created.id);
  }

  // Create protocolos
  for (const p of PROTOCOLOS_DEFAULT) {
    const proto = await prisma.protocoloSanitario.create({
      data: { tenantId, nombre: p.nombre, fase: p.fase, tipoAnimal: p.tipoAnimal, descripcion: p.descripcion },
    });
    for (const item of p.items) {
      await prisma.protocoloItem.create({
        data: {
          tenantId,
          protocoloId:    proto.id,
          vacunaId:       vacunasCreadas[item.vacunaKey],
          diaCiclo:       item.diaCiclo,
          disparador:     item.disparador,
          esObligatorio:  item.esObligatorio,
          bloqueoServicio: item.bloqueoServicio,
          descripcion:    item.descripcion,
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    vacunasCreadas: vacunasCreadas.length,
    protocolosCreados: PROTOCOLOS_DEFAULT.length,
  });
}
