// Finanzas · Compra de animales: toda compra de lechones, reproductoras o reproductores a otra granja entra por acá.
// Se registra el gasto y los animales quedan «por recibir» en el módulo elegido, que los acepta.
import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { comprasAnimales } from "@/app/acciones/transferencias";
import { PanelCompraAnimales } from "./panel";

export const metadata = { title: "Compra de animales · Finanzas · KurPorc" };

export default async function CompraAnimalesPage() {
  const { org, permisos, corte } = await paginaFinanzas("finanzas.movimientos.ver");
  const [compras, proveedores, cuentas] = await Promise.all([
    comprasAnimales(),
    prisma.contraparte.findMany({ where: { organizacionId: org, tipo: { in: ["PROVEEDOR", "AMBOS"] } }, orderBy: { nombre: "asc" }, select: { nombre: true }, take: 300 }),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return (
    <PanelCompraAnimales
      hoy={corte.toISOString().slice(0, 10)} compras={compras} proveedores={proveedores.map(p => p.nombre)} cuentas={cuentas}
      puedo={{ crear: puede(permisos, "finanzas.movimientos.crear"), pagar: puede(permisos, "finanzas.pagar.registrar_pago") }}
    />
  );
}
