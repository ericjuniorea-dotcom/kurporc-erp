// A dónde lleva cada orden de trabajo para hacerla o corregirla: la ficha de la cerda nombrada, el lote o el módulo
// del área («Revisar (Media): MORTANDAD · cerda 73» → ficha de la cerda 73; «BANDAS» → Gestación, etc.).
import "server-only";
import prisma from "@/lib/db/prisma";

export type Destino = { href: string; etiqueta: string };
type T = { id: string; tipo: string; titulo: string; descripcion?: string | null; animalId?: string | null; farrowingId?: string | null; nurseryBatchId?: string | null; growingBatchId?: string | null; sector: string };

const POR_AREA: [RegExp, Destino][] = [
  [/MORTANDAD|PARTOS|DESTETES|LECHONES|ADOPCI/, { href: "/maternidad?tab=ingreso", etiqueta: "Ir a Maternidad → Ingreso de datos" }],
  [/SERVICIOS|BANDAS|DIAGN|CELO/, { href: "/gestacion?tab=ingreso", etiqueta: "Ir a Gestación → Ingreso de datos" }],
  [/SANIDAD|VACUN/, { href: "/sanidad", etiqueta: "Ir a Sanidad y Nutrición" }],
  [/PARAMETROS|PARÁMETROS|METAS/, { href: "/configuracion?modulo=MATERNIDAD&tab=Metas", etiqueta: "Ir a Configuración → Metas" }],
  [/SALIDAS|VENTAS/, { href: "/finanzas/ventas", etiqueta: "Ir a Finanzas → Ventas" }],
  [/ENGORDE/, { href: "/engorde", etiqueta: "Ir a Engorde" }],
  [/INICIACI|RECR/, { href: "/recria", etiqueta: "Ir a Iniciación" }],
  [/PLANTEL|REPRODUCTOR|CERDAS?\b/, { href: "/plantel", etiqueta: "Ir a Plantel reproductivo" }],
];
const POR_SECTOR: Record<string, Destino> = {
  gestacion: { href: "/gestacion", etiqueta: "Ir a Gestación" }, maternidad: { href: "/maternidad", etiqueta: "Ir a Maternidad" },
  iniciacion: { href: "/recria", etiqueta: "Ir a Iniciación" }, engorde: { href: "/engorde", etiqueta: "Ir a Engorde" },
};

/** Primera caravana nombrada en el texto («cerda 73», «cerdas 78 (S-0022) y 79»). */
const caravanaDe = (texto: string) => texto.match(/\bcerdas?\s+(\d{2,6})\b/i)?.[1] ?? null;

export async function destinosTareas(tenantId: string, tareas: T[]): Promise<Map<string, Destino>> {
  const caravanas = Array.from(new Set(tareas.filter(t => !t.animalId).map(t => caravanaDe(`${t.titulo} ${t.descripcion ?? ""}`)).filter((x): x is string => !!x)));
  const sows = caravanas.length ? await prisma.sow.findMany({ where: { tenantId, OR: [{ caravanaCode: { in: caravanas } }, { identCode: { in: caravanas } }] }, select: { id: true, caravanaCode: true, identCode: true } }) : [];
  const porCaravana = new Map<string, string>();
  for (const s of sows) { if (s.caravanaCode) porCaravana.set(s.caravanaCode, s.id); porCaravana.set(s.identCode, s.id); }

  const out = new Map<string, Destino>();
  for (const t of tareas) {
    if (t.animalId) { out.set(t.id, { href: `/plantel?cerda=${t.animalId}`, etiqueta: "Abrir la ficha de la reproductora" }); continue; }
    const c = caravanaDe(`${t.titulo} ${t.descripcion ?? ""}`);
    if (c && porCaravana.has(c)) { out.set(t.id, { href: `/plantel?cerda=${porCaravana.get(c)}`, etiqueta: `Abrir la ficha de la cerda ${c}` }); continue; }
    if (t.nurseryBatchId) { out.set(t.id, { href: `/recria/lotes/${t.nurseryBatchId}`, etiqueta: "Abrir el lote de Iniciación" }); continue; }
    if (t.growingBatchId) { out.set(t.id, { href: `/engorde/lotes/${t.growingBatchId}`, etiqueta: "Abrir el lote de Engorde" }); continue; }
    if (t.farrowingId) { out.set(t.id, { href: "/maternidad", etiqueta: "Ir a Maternidad" }); continue; }
    const area = t.titulo.match(/:\s*([^·]+)/)?.[1]?.toUpperCase() ?? t.titulo.toUpperCase();
    const porArea = POR_AREA.find(([re]) => re.test(area))?.[1];
    if (porArea) { out.set(t.id, porArea); continue; }
    if (POR_SECTOR[t.sector]) out.set(t.id, POR_SECTOR[t.sector]);
  }
  return out;
}
