// Finanzas · costeo por etapa · Fase 1: catálogo inicial (seed) de etapas, categorías y subcategorías de gasto, y
// asignación de los ítems del inventario. Idempotente: lo que ya existe (mismo código) no se pisa ni se duplica.
// Fuente: «Catálogo de costos por etapa - KurPorc» (especificación de costeo, secciones 4.1 a 4.3 y 9).
import "server-only";
import prisma from "@/lib/db/prisma";

export const TIPOS_ETAPA = {
  PRODUCTIVA: "Productiva", APOYO: "Apoyo", ESTRUCTURA: "Estructura", FINANCIERA: "Financiero",
  INVERSION: "Inversión", PENDIENTE_REPARTO: "Pendiente de reparto",
} as const;
export const MODOS = {
  INVENTARIO: "Entra al inventario y se imputa al consumirse", DIRECTO: "Va directo a la etapa",
  REPARTO: "Se reparte con una regla", INVERSION: "Inversión: va a un proyecto",
} as const;

const ETAPAS: [string, string, keyof typeof TIPOS_ETAPA, string, string, string][] = [
  ["GES", "Gestación", "PRODUCTIVA", "Cerdas servidas y gestantes, verraco y extracción de semen, galpón de gestación", "Cerda por año", "Encargado de Gestación"],
  ["MAT", "Maternidad", "PRODUCTIVA", "Cerda lactante y su camada hasta el destete, sala de maternidad", "Lechón destetado", "Encargado de Maternidad"],
  ["DES", "Destete y recría", "PRODUCTIVA", "Del destete a la salida de recría: pre-inicial 1 y 2, inicial", "Lechón salido de recría", "Encargado de Destete"],
  ["ENG", "Engorde", "PRODUCTIVA", "Crecimiento y terminación hasta la venta, incluye lechones comprados", "Cerdo vendido y kg vivo producido", "Jefe de Producción"],
  ["MAN", "Mantenimiento e instalaciones", "APOYO", "Reparaciones, repuestos y taller de uso general", "Plaza o m² de cada etapa", "Jefe de Producción"],
  ["VER", "Áreas verdes", "APOYO", "Corte de pasto, cercos perimetrales y caminos internos", "m² o porcentaje fijo", "Jefe de Producción"],
  ["BIO", "Bioseguridad y limpieza", "APOYO", "Desinfección de uso común, pediluvios, control de plagas", "Horas o animales presentes", "Jefe de Sanidad"],
  ["EST", "Estructura", "ESTRUCTURA", "Administración, comercial, servicios profesionales, impuestos y tasas", "Kg vivos producidos", "Encargado de Administración"],
  ["FIN", "Financieros", "FINANCIERA", "Gastos bancarios e intereses (se informan aparte)", "No se reparte", "Encargado de Administración"],
  ["INV", "Proyectos e inversión", "INVERSION", "Obras, equipos y ampliaciones", "Depreciación mensual", "Dirección General"],
  ["CMP", "Compartido a repartir", "PENDIENTE_REPARTO", "Gasto que sirve a varias etapas (ninguno puede quedar acá al cerrar el mes)", "Según la regla", "Quien carga el gasto"],
];

const CATEGORIAS: [string, string][] = [
  ["ALI", "Alimentación"], ["SAN", "Sanidad"], ["GEN", "Genética y reproducción"], ["ANI", "Animales comprados"],
  ["MOB", "Mano de obra"], ["ENE", "Energía y agua"], ["INS", "Instalaciones y limpieza"], ["LOG", "Logística"],
  ["EST", "Estructura"], ["COM", "Comercial"], ["FIN", "Financieros"], ["INV", "Inversiones"], ["OTR", "Otros"],
];

// [código, nombre, modo, regla de imputación, etapa por defecto (si es única), nombres anteriores (migración)]
type Sub = [string, string, "INVENTARIO" | "DIRECTO" | "REPARTO" | "INVERSION", string, string | null, string[]];
const SUBCATEGORIAS: Sub[] = [
  ["ALI-01", "Balanceado comprado, por fase", "INVENTARIO", "La etapa que lo consume", null, ["Balanceado de gestación", "Balanceado de lactación", "Vilo Baby", "Pre-inicial 1", "Pre-inicial 2", "Inicial", "Balanceado de crecimiento", "Balanceado de terminación"]],
  ["SAN-01", "Vacunas", "INVENTARIO", "La etapa donde se aplica", null, ["Sanidad"]],
  ["SAN-02", "Medicamentos y antibióticos", "INVENTARIO", "La etapa donde se aplica", null, []],
  ["SAN-03", "Material sanitario", "INVENTARIO", "La etapa donde se usa", null, []],
  ["SAN-04", "Honorarios veterinarios", "DIRECTO", "Etapa atendida; si es general, CMP", null, ["Servicios veterinarios"]],
  ["SAN-05", "Laboratorio y diagnóstico", "DIRECTO", "Etapa del lote analizado", null, []],
  ["GEN-01", "Semen", "INVENTARIO", "Gestación", "GES", ["Genética y reproducción"]],
  ["GEN-02", "Insumos de inseminación", "INVENTARIO", "Gestación", "GES", []],
  ["GEN-03", "Reposición de reproductoras y verraco", "DIRECTO", "Gestación, a costo neto (compra menos valor de descarte)", "GES", ["Reposición de reproductoras", "Matrices y reproductores"]],
  ["ANI-01", "Lechones para engorde", "DIRECTO", "Engorde, como costo de entrada del lote", "ENG", ["Compra de lechones para engorde"]],
  ["MOB-01", "Sueldos y jornales de producción", "REPARTO", "Por horas trabajadas en cada etapa", "CMP", ["Personal producción"]],
  ["MOB-02", "Cargas sociales (IPS)", "REPARTO", "Igual que el sueldo del que proviene", "CMP", ["Cargas sociales (IPS y aguinaldo)"]],
  ["MOB-03", "Aguinaldo y vacaciones (provisión mensual)", "REPARTO", "Igual que el sueldo del que proviene", "CMP", []],
  ["MOB-04", "Horas extra, bonos y viáticos", "DIRECTO", "La etapa donde se trabajó", null, []],
  ["ENE-01", "Energía eléctrica", "REPARTO", "Por medidor; sin medidor, por potencia instalada", "CMP", ["Energía"]],
  ["ENE-02", "Agua (consumo y bombeo)", "REPARTO", "Por medidor; sin medidor, por animales presentes", "CMP", ["Agua"]],
  ["ENE-03", "Gas y calefacción de lechoneras", "DIRECTO", "Maternidad y Destete y recría", null, []],
  ["INS-01", "Mantenimiento y reparaciones", "DIRECTO", "La etapa reparada; si es general, MAN", null, ["Mantenimiento"]],
  ["INS-02", "Repuestos y materiales de taller", "INVENTARIO", "La etapa donde se usa", null, []],
  ["INS-03", "Desinfectantes y productos de limpieza", "INVENTARIO", "La etapa donde se usa; de uso común, BIO", null, ["Limpieza"]],
  ["INS-04", "Áreas verdes", "DIRECTO", "Áreas verdes", "VER", []],
  ["INS-05", "Control de plagas y bioseguridad", "DIRECTO", "Bioseguridad y limpieza", "BIO", []],
  ["LOG-01", "Flete de entrega de lechones y cerdos", "DIRECTO", "La etapa del animal entregado", null, ["Flete de entrega"]],
  ["LOG-02", "Flete de balanceado y otros insumos", "DIRECTO", "Se suma al costo del ítem que llega al inventario", null, []],
  ["LOG-03", "Combustible", "REPARTO", "Camión a Logística; maquinaria a MAN", "CMP", ["Combustible"]],
  ["EST-01", "Sueldos de administración", "DIRECTO", "Estructura", "EST", ["Personal administración"]],
  ["EST-02", "Servicios profesionales", "DIRECTO", "Estructura", "EST", ["Servicios profesionales"]],
  ["EST-03", "Servicios generales", "DIRECTO", "Estructura", "EST", ["Servicios"]],
  ["EST-04", "Impuestos y tasas", "DIRECTO", "Estructura", "EST", ["Impuestos y tasas"]],
  ["COM-01", "Publicidad y marketing", "DIRECTO", "Estructura (comercial)", "EST", ["Comercial y marketing"]],
  ["COM-02", "Comisiones y gastos de venta", "DIRECTO", "Estructura (comercial)", "EST", []],
  ["FIN-01", "Gastos bancarios", "DIRECTO", "Financieros", "FIN", ["Gastos bancarios"]],
  ["FIN-02", "Intereses de préstamos", "DIRECTO", "Financieros", "FIN", ["Intereses y comisiones"]],
  ["INV-01", "Obras y construcciones", "INVERSION", "Proyecto", "INV", ["Obra civil", "Terreno", "Electricidad", "Jaulas"]],
  ["INV-02", "Equipos y maquinaria", "INVERSION", "Proyecto", "INV", ["Equipamiento", "Vehículos", "Otras inversiones"]],
  ["INV-03", "Ampliación del plantel", "INVERSION", "Proyecto", "INV", []],
  ["OTR-01", "Otros gastos a reclasificar", "DIRECTO", "Según el caso (no debería pasar del 3 % del gasto)", null, ["Otros gastos"]],
];

// Ítems genéricos que el inventario no trae (los balanceados, vacunas y medicamentos ya existen y se reutilizan)
const ITEMS_GENERICOS: [string, string, "UNIDAD", string, string | null][] = [
  ["Agujas y jeringas", "SAN-03", "UNIDAD", "Material sanitario", null],
  ["Catéteres y diluyentes", "GEN-02", "UNIDAD", "Insumos de inseminación", "GES"],
  ["Desinfectantes", "INS-03", "UNIDAD", "Limpieza y desinfección", null],
  ["Repuestos y materiales de taller", "INS-02", "UNIDAD", "Taller", null],
];

const MODULO_A_ETAPA: Record<string, string> = { GESTACION: "GES", MATERNIDAD_HEMBRAS: "MAT", MATERNIDAD_LECHONES: "MAT", INICIACION: "DES", ENGORDE: "ENG" };

/** Deja cargado el catálogo sugerido de la organización. Devuelve cuánto creó. */
export async function asegurarCatalogoCostos(org: string) {
  let creados = 0;
  const etapasDb = await prisma.etapaCosto.findMany({ where: { organizacionId: org }, select: { codigo: true } });
  const faltan = ETAPAS.filter(e => !etapasDb.some(x => x.codigo === e[0]));
  if (faltan.length) {
    await prisma.etapaCosto.createMany({ skipDuplicates: true, data: faltan.map(([codigo, nombre, tipo, incluye, unidadCosteo, rolResponsable]) =>
      ({ organizacionId: org, codigo, nombre, tipo, incluye, unidadCosteo, rolResponsable, orden: ETAPAS.findIndex(e => e[0] === codigo) })) });
    creados += faltan.length;
  }
  await prisma.categoriaGasto.createMany({ skipDuplicates: true, data: CATEGORIAS.map(([codigo, nombre], i) => ({ organizacionId: org, codigo, nombre, orden: i })) });
  const cats = new Map((await prisma.categoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true } })).map(c => [c.codigo, c.id]));
  const subsDb = new Set((await prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { codigo: true } })).map(s => s.codigo));
  const nuevas = SUBCATEGORIAS.filter(s => !subsDb.has(s[0]));
  if (nuevas.length) {
    await prisma.subcategoriaGasto.createMany({ skipDuplicates: true, data: nuevas.map(([codigo, nombre, modo, etapaRegla, etapaCodigo, nombresAnteriores]) => ({
      organizacionId: org, categoriaId: cats.get(codigo.slice(0, 3))!, codigo, nombre, modo, etapaRegla, etapaCodigo, nombresAnteriores,
      orden: SUBCATEGORIAS.findIndex(s => s[0] === codigo),
    })) });
    creados += nuevas.length;
  }
  await asignarItems(org);
  return creados;
}

/** Ítems del inventario: subcategoría y etapa por defecto (solo los que todavía no tienen); crea los genéricos que falten. */
async function asignarItems(org: string) {
  const subs = new Map((await prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true } })).map(s => [s.codigo, s.id]));
  const [productos, tipos] = await Promise.all([
    prisma.productoInventario.findMany({ where: { tenantId: org }, select: { id: true, nombre: true, categoria: true, codigo: true, subcategoriaGastoId: true, etapaConsumoCodigo: true } }),
    prisma.feedType.findMany({ where: { tenantId: org }, select: { productoBalanceadoId: true, modulo: true } }),
  ]);
  const etapaBalanceado = new Map(tipos.filter(t => t.productoBalanceadoId).map(t => [t.productoBalanceadoId!, MODULO_A_ETAPA[t.modulo ?? ""] ?? null]));
  for (const p of productos) {
    if (p.subcategoriaGastoId) continue;
    const codigo = p.categoria === "BALANCEADO" ? "ALI-01" : p.categoria === "VACUNA" ? "SAN-01" : p.categoria === "EQUIPAMIENTO" ? "INS-02" : "SAN-02";
    await prisma.productoInventario.update({ where: { id: p.id }, data: {
      subcategoriaGastoId: subs.get(codigo) ?? null,
      etapaConsumoCodigo: p.etapaConsumoCodigo ?? (p.categoria === "BALANCEADO" ? etapaBalanceado.get(p.id) ?? null : null),
    } });
  }
  const usados = productos.filter(p => p.codigo?.startsWith("E-")).reduce((m, p) => Math.max(m, Number(p.codigo?.split("-")[1]) || 0), 0);
  let n = usados;
  for (const [nombre, sub, unidad, enfermedad, etapa] of ITEMS_GENERICOS) {
    if (productos.some(p => p.nombre.trim().toLowerCase() === nombre.toLowerCase())) continue;
    n++;
    await prisma.productoInventario.create({ data: {
      tenantId: org, nombre, enfermedad, categoria: "EQUIPAMIENTO", unidadMedida: unidad, sectorDestino: "plantel",
      codigo: `E-${String(n).padStart(3, "0")}`, subcategoriaGastoId: subs.get(sub) ?? null, etapaConsumoCodigo: etapa,
    } });
  }
}

/** Todo lo que muestra la pantalla de catálogos. */
export async function catalogoCostos(org: string) {
  const [etapas, categorias, proyectos, items, granjas] = await Promise.all([
    prisma.etapaCosto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" } }),
    prisma.categoriaGasto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" }, include: { subcategorias: { orderBy: { orden: "asc" } } } }),
    prisma.proyectoInversion.findMany({ where: { organizacionId: org }, orderBy: [{ activo: "desc" }, { fechaInicio: "desc" }] }),
    prisma.productoInventario.findMany({ where: { tenantId: org, isActive: true }, orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
      select: { id: true, codigo: true, nombre: true, categoria: true, unidadMedida: true, subcategoriaGastoId: true, etapaConsumoCodigo: true } }),
    prisma.granja.findMany({ where: { organizacionId: org, activa: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  return {
    etapas, granjas, items,
    categorias: categorias.map(c => ({ ...c, subcategorias: c.subcategorias })),
    proyectos: proyectos.map(p => ({ ...p, presupuestoGs: p.presupuestoGs?.toString() ?? null, fechaInicio: p.fechaInicio.toISOString().slice(0, 10), fechaFin: p.fechaFin?.toISOString().slice(0, 10) ?? null })),
  };
}
export type CatalogoCostos = Awaited<ReturnType<typeof catalogoCostos>>;
