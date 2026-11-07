/**
 * Fase 4 — Carga los documentos legales de docs/legal/*.md en la base. Idempotente.
 *
 *   npm run db:legales
 *
 * - Cada archivo tiene un encabezado (codigo, version, titulo, resumen) y el texto.
 * - Si la versión ya existe, NO se modifica (un documento publicado es inmutable):
 *   para cambiar un texto, se sube la versión en el archivo (ej. "1.1") y se vuelve a correr.
 * - Las versiones nuevas se publican con requiere_reaceptacion = true, salvo que el
 *   encabezado diga `requiere_reaceptacion: false` (cambios menores).
 * - Datos del operador (opcionales, por variables de entorno): PLATAFORMA_RAZON_SOCIAL,
 *   PLATAFORMA_RUC, PLATAFORMA_DOMICILIO, PLATAFORMA_CORREO, PLATAFORMA_CORREO_PRIVACIDAD,
 *   PLATAFORMA_WHATSAPP, PLATAFORMA_CIUDAD.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CARPETA = join(__dirname, "..", "docs", "legal");

function leer(archivo: string) {
  const texto = readFileSync(join(CARPETA, archivo), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(texto);
  if (!m) throw new Error(`${archivo}: falta el encabezado entre ---`);
  const [, cabecera, cuerpo] = m;
  const campo = (k: string) => /^(\S+):\s*"?([^"\n]*)"?\s*$/m.exec(cabecera.split("\n").find(l => l.startsWith(`${k}:`)) ?? "")?.[2];
  const resumen = /resumen: \|\n((?:  .*\n?)+)/.exec(cabecera + "\n")?.[1].split("\n").map(l => l.replace(/^  /, "")).join("\n").trim();
  const codigo = campo("codigo"), version = campo("version"), titulo = campo("titulo");
  if (!codigo || !version || !titulo || !resumen) throw new Error(`${archivo}: faltan codigo, version, titulo o resumen`);
  return {
    codigo, version, titulo, resumen,
    contenidoMd: cuerpo.trim() + "\n",
    requiereReaceptacion: campo("requiere_reaceptacion") !== "false",
    resumenCambios: campo("resumen_cambios") ?? null,
  };
}

async function main() {
  console.log("Documentos legales\n");
  for (const archivo of readdirSync(CARPETA).filter(f => f.endsWith(".md")).sort()) {
    const d = leer(archivo);
    const hash = createHash("sha256").update(d.contenidoMd, "utf8").digest("hex");
    const existente = await prisma.documentoLegal.findUnique({ where: { codigo_version: { codigo: d.codigo, version: d.version } } });
    if (existente) {
      const aviso = existente.hashSha256 !== hash ? "  ⚠ el archivo cambió pero la versión ya está publicada: subí la versión para publicarlo" : "";
      console.log(`  • ${d.codigo} ${d.version}: ya está (${existente.estado})${aviso}`);
      continue;
    }
    await prisma.documentoLegal.create({
      data: {
        codigo: d.codigo, version: d.version, titulo: d.titulo, resumen: d.resumen,
        contenidoMd: d.contenidoMd, hashSha256: hash,
        requiereReaceptacion: d.requiereReaceptacion, resumenCambios: d.resumenCambios,
        // Decisión del dueño (07/11/2026): se publica la versión preliminar mientras la revisa el abogado.
        estado: "PUBLICADO", aprobadoPorAsesor: false, vigenteDesde: new Date(),
      },
    });
    console.log(`  ✓ ${d.codigo} ${d.version}: publicado`);
  }

  const env = process.env;
  const datos = {
    razonSocial: env.PLATAFORMA_RAZON_SOCIAL, ruc: env.PLATAFORMA_RUC, domicilio: env.PLATAFORMA_DOMICILIO,
    correoContacto: env.PLATAFORMA_CORREO, correoPrivacidad: env.PLATAFORMA_CORREO_PRIVACIDAD ?? env.PLATAFORMA_CORREO,
    whatsappSoporte: env.PLATAFORMA_WHATSAPP, ciudadJurisdiccion: env.PLATAFORMA_CIUDAD,
  };
  const definidos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v));
  const actual = await prisma.configuracionPlataforma.findUnique({ where: { id: 1 } });
  if (Object.keys(definidos).length) {
    await prisma.configuracionPlataforma.upsert({
      where: { id: 1 },
      create: { razonSocial: "", ruc: "", domicilio: "", correoContacto: "", correoPrivacidad: "", ...definidos },
      update: definidos,
    });
    console.log(`\n  ✓ Datos del operador actualizados: ${Object.keys(definidos).join(", ")}`);
  } else if (!actual) {
    console.log("\n  • Sin datos del operador: los documentos muestran \"[a completar]\" donde van razón social, RUC, domicilio y correos.");
  }
}

main()
  .catch(e => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
