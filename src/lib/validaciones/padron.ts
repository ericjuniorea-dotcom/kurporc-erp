// Consulta del padrón de RUC activos de la DNIT (tabla ruc_dnit, cargada con `npm run db:padron-ruc`).
import "server-only";
import prisma from "@/lib/db/prisma";
import { normalizarRuc } from "./ruc";

export type ResultadoRuc =
  | { valido: false; mensaje: string }
  | { valido: true; ruc: string; activo: true; razonSocial: string }
  | { valido: true; ruc: string; activo: false; mensaje: string };

/** Valida el RUC (dígito verificador) y lo busca entre los contribuyentes activos de la DNIT. */
export async function buscarRuc(texto: string): Promise<ResultadoRuc> {
  const ruc = normalizarRuc(texto);
  if (!ruc) return { valido: false, mensaje: "El RUC no es válido. Escribilo con guion y dígito verificador, ej. 4799016-3." };
  const [numero, dv] = ruc.split("-");
  const fila = await prisma.rucDnit.findUnique({ where: { ruc: Number(numero) } });
  if (fila && fila.dv === Number(dv)) return { valido: true, ruc, activo: true, razonSocial: fila.razonSocial };
  return {
    valido: true, ruc, activo: false,
    mensaje: "No figura como activo en el padrón de la DNIT. Si es nuevo, puede tardar en aparecer: tu tienda funciona igual y se verifica sola cuando figure.",
  };
}
