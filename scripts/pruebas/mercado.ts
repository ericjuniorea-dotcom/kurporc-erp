/**
 * Prueba de la Fase 12 (criterios de aceptación):
 *  - Precio por unidad base = precio ÷ contenido base.
 *  - "nucleo lactacion" encuentra "Núcleo de lactación" (también en la base, con unaccent).
 *  - Un vendedor no verificado no puede publicar (regla y servidor).
 *  - Solo se ven las publicaciones ACTIVAS de tiendas no rechazadas.
 *   npm run prueba:mercado   (con DATABASE_URL de una base de prueba)
 */
import prisma from "@/lib/db/prisma";
import { coincide, motivoNoPublicable, palabrasBusqueda, precioPorUnidadBase, slugificar, textoPrecioBase } from "@/lib/mercado/calculo";
import { buscarPublicaciones } from "@/lib/mercado/consultas";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }

async function main() {
  console.log("Cálculos");
  check(precioPorUnidadBase(94_000, 40) === 2_350, "Bolsa 40 kg a Gs 94.000 → Gs 2.350/kg");
  check(textoPrecioBase(94_000n, 40, "KG") === "Gs 2.350/kg", "texto «Gs 2.350/kg»");
  check(textoPrecioBase(120_000, 50, "DOSIS") === "Gs 2.400/dosis", "frasco 50 dosis a Gs 120.000 → Gs 2.400/dosis");
  check(precioPorUnidadBase(10_000, 0) === null, "contenido 0 → sin precio por unidad");
  check(coincide("Núcleo de lactación 4 %", "nucleo lactacion"), "«nucleo lactacion» coincide con «Núcleo de lactación»");
  check(!coincide("Núcleo de gestación", "nucleo lactacion"), "«nucleo lactacion» no coincide con «Núcleo de gestación»");
  check(palabrasBusqueda("Núcleo DE Lactación").join(" ") === "nucleo lactacion", "palabras sin acentos ni vacías");
  check(slugificar("Núcleo de Lactación 4% — Bolsa 40kg") === "nucleo-de-lactacion-4-bolsa-40kg", "slug sin acentos");
  check(motivoNoPublicable({ tiendaVerificada: false, categoriaRequiereVerificacion: false, declaracionSanitaria: false, fotos: 1 }) !== null, "tienda no verificada no publica");
  check(motivoNoPublicable({ tiendaVerificada: true, categoriaRequiereVerificacion: true, declaracionSanitaria: false, fotos: 1 }) !== null, "animales sin declaración SENACSA no publican");
  check(motivoNoPublicable({ tiendaVerificada: true, categoriaRequiereVerificacion: true, declaracionSanitaria: true, fotos: 0 }) === null, "verificada + declaración → publica");

  console.log("Base de datos");
  const cat = await prisma.categoriaMercado.findUnique({ where: { slug: "nucleos" } });
  const prod = await prisma.productoCatalogo.findUnique({ where: { codigo: "ALI-NUC-LAC" } });
  check(cat && prod, "semillas: categoría «Núcleos» y producto ALI-NUC-LAC");
  const sufijo = Date.now().toString(36);
  const crear = (verif: "VERIFICADA" | "PENDIENTE" | "RECHAZADA") => prisma.tenant.create({ data: { slug: `prueba-tienda-${verif.toLowerCase()}-${sufijo}`, farmName: `Tienda ${verif} ${sufijo}`, tipo: "VENDEDOR", verificacion: verif } });
  const [ok, pend, rech] = await Promise.all([crear("VERIFICADA"), crear("PENDIENTE"), crear("RECHAZADA")]);
  try {
    for (const t of [ok, pend, rech]) await prisma.tienda.create({ data: { organizacionId: t.id, zonasEntrega: ["Itapúa"] } });
    const pub = (tiendaId: string, titulo: string, estado: "ACTIVA" | "BORRADOR", precio: number) => prisma.publicacion.create({
      data: { slug: `${slugificar(titulo)}-${sufijo}-${Math.random().toString(36).slice(2, 6)}`, tiendaId, productoCatalogoId: prod!.id, categoriaId: cat!.id, titulo, precioGs: BigInt(precio), unidadVenta: "Bolsa 40 kg", unidadBase: "KG", contenidoBase: 40, zonasEntrega: ["Itapúa"], estado },
    });
    const a = await pub(ok.id, `Núcleo de lactación ${sufijo}`, "ACTIVA", 94_000);
    await pub(ok.id, `Núcleo de gestación ${sufijo}`, "ACTIVA", 80_000);
    await pub(pend.id, `Núcleo de lactación borrador ${sufijo}`, "BORRADOR", 90_000);
    await pub(rech.id, `Núcleo de lactación suspendida ${sufijo}`, "ACTIVA", 70_000);

    const r = await buscarPublicaciones({ q: `nucleo lactacion ${sufijo}` });
    check(r.tarjetas.length === 1 && r.tarjetas[0].id === a.id, "la búsqueda «nucleo lactacion» encuentra solo la activa de la tienda no rechazada");
    const precio = await buscarPublicaciones({ q: sufijo, orden: "precio" });
    check(precio.tarjetas.map(t => t.titulo.split(" ")[2]).join(",") === "gestación,lactación", "orden por precio por kg: 2.000 antes que 2.350");
    check((await buscarPublicaciones({ q: sufijo, depto: "Central" })).total === 0, "filtro de zona: nada entrega en Central");
    check((await buscarPublicaciones({ q: sufijo, verificados: true })).total === 2, "solo verificadas");
    check((await buscarPublicaciones({ q: `lactacion ${sufijo}`, orden: "relevancia" })).tarjetas[0]?.id === a.id, "orden por relevancia (pg_trgm) funciona");
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [ok.id, pend.id, rech.id] } } });
  }
  console.log("Todo bien.");
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
