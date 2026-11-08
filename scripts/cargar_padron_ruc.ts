/**
 * Carga el padrón de RUC de la DNIT (datos públicos) en la tabla ruc_dnit.
 *
 *   npm run db:padron-ruc
 *
 * 1. Lee la página "Listado de RUC con sus equivalencias" y baja los 10 archivos ruc0.zip … ruc9.zip.
 * 2. Cada línea: RUC|NOMBRE O RAZÓN SOCIAL|DV|RUC ANTERIOR|ESTADO|
 * 3. Carga todo en una tabla de paso y reemplaza ruc_dnit en una sola transacción (las búsquedas nunca ven la tabla vacía).
 * 4. Verifica solas las tiendas que estaban pendientes porque su RUC todavía no figuraba.
 *
 * Conviene correrlo una vez por mes (la DNIT lo actualiza seguido).
 */
import { inflateRawSync } from "zlib";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PAGINA = "https://www.dnit.gov.py/web/portal-institucional/listado-de-ruc-con-sus-equivalencias";
const BASE = "https://www.dnit.gov.py";
const AGENTE = "KurPorc/1.0 (carga del padron publico de RUC)";

/** Extrae el primer archivo de un .zip (formato simple: un archivo, deflate o sin comprimir). */
function primerArchivoZip(zip: Buffer): Buffer {
  // El directorio central tiene los tamaños reales aunque el encabezado local use "data descriptor"
  const fin = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error("No es un .zip válido");
  const inicioDir = zip.readUInt32LE(fin + 16);
  if (zip.readUInt32LE(inicioDir) !== 0x02014b50) throw new Error("Directorio central inválido");
  const metodo = zip.readUInt16LE(inicioDir + 10);
  const comprimido = zip.readUInt32LE(inicioDir + 20);
  const local = zip.readUInt32LE(inicioDir + 42);
  if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error("Encabezado local inválido");
  const datos = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const cuerpo = zip.subarray(datos, datos + comprimido);
  if (metodo === 0) return cuerpo;
  if (metodo === 8) return inflateRawSync(cuerpo);
  throw new Error(`Método de compresión no soportado: ${metodo}`);
}

async function bajar(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": AGENTE } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  const html = (await bajar(PAGINA)).toString("utf8");
  const enlaces = Array.from(new Set(Array.from(html.matchAll(/href="([^"]*\/ruc\d\.zip[^"]*)"/g), m => m[1].replace(/&amp;/g, "&"))));
  if (enlaces.length < 10) throw new Error(`Se esperaban 10 archivos y se encontraron ${enlaces.length}: ¿cambió la página de la DNIT?`);
  console.log(`  ${enlaces.length} archivos en la página de la DNIT`);

  await prisma.$executeRawUnsafe(`drop table if exists ruc_dnit_carga`);
  await prisma.$executeRawUnsafe(`create table ruc_dnit_carga (ruc int primary key, dv smallint not null, razon_social text not null)`);

  let total = 0;
  for (const enlace of enlaces) {
    const url = enlace.startsWith("http") ? enlace : BASE + enlace;
    const texto = primerArchivoZip(await bajar(url)).toString("utf8");
    const filas: [number, number, string][] = [];
    for (const linea of texto.split(/\r?\n/)) {
      const [ruc, nombre, dv, , estado] = linea.split("|");
      if (!ruc || !/^\d{1,9}$/.test(ruc) || !/^\d$/.test(dv ?? "") || !nombre) continue;
      // Solo los activos: alcanza para verificar y ocupa menos de la mitad
      if ((estado ?? "").trim().toUpperCase() !== "ACTIVO") continue;
      filas.push([Number(ruc), Number(dv), nombre.replace(/\s+/g, " ").trim().slice(0, 200)]);
    }
    for (let i = 0; i < filas.length; i += 5000) {
      const lote = filas.slice(i, i + 5000);
      await prisma.$executeRawUnsafe(
        `insert into ruc_dnit_carga (ruc, dv, razon_social)
         select * from unnest($1::int[], $2::smallint[], $3::text[]) on conflict (ruc) do nothing`,
        lote.map(f => f[0]), lote.map(f => f[1]), lote.map(f => f[2]),
      );
    }
    total += filas.length;
    console.log(`  ✓ ${url.match(/ruc\d\.zip/)?.[0]}: ${filas.length.toLocaleString("es-PY")} contribuyentes activos`);
  }
  if (total < 300_000) throw new Error(`Muy pocos contribuyentes activos (${total}): no se reemplaza el padrón`);

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`delete from ruc_dnit`),
    prisma.$executeRawUnsafe(`insert into ruc_dnit (ruc, dv, razon_social) select ruc, dv, razon_social from ruc_dnit_carga`),
    prisma.$executeRawUnsafe(`drop table ruc_dnit_carga`),
  ]);
  console.log(`  ✓ Padrón reemplazado: ${total.toLocaleString("es-PY")} contribuyentes`);

  // Tiendas que se crearon con un RUC que todavía no figuraba: se verifican solas si ahora está activo
  const pendientes = await prisma.tenant.findMany({ where: { tipo: "VENDEDOR", verificacion: "PENDIENTE", ruc: { not: null } }, select: { id: true, ruc: true, farmName: true } });
  for (const t of pendientes) {
    const [numero] = (t.ruc ?? "").split("-");
    const p = await prisma.rucDnit.findUnique({ where: { ruc: Number(numero) } });
    if (p) {
      await prisma.tenant.update({ where: { id: t.id }, data: { verificacion: "VERIFICADA", razonSocial: p.razonSocial } });
      console.log(`  ✓ Tienda verificada: ${t.farmName}`);
    }
  }
  console.log("Listo.");
}

main()
  .catch(e => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
