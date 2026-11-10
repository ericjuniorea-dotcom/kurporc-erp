// Pedir cotización a varias tiendas (Fase 13.2).
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { terminosMercadoPendientes } from "@/lib/pedidos/servidor";
import { FormSolicitud } from "../../componentes";

export default async function NuevaCotizacion({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "compras.cotizaciones.crear")) return <div style={{ fontSize: 13.5 }}>No tenés permiso para pedir cotizaciones en esta organización.</div>;
  const { producto } = await searchParams;
  const [productos, granjas, org, terminos] = await Promise.all([
    prisma.productoCatalogo.findMany({ where: { aprobado: true }, orderBy: { nombre: "asc" }, select: { id: true, codigo: true, nombre: true, unidadBase: true, categoria: { select: { nombre: true } } } }),
    prisma.granja.findMany({ where: { organizacionId: permisos.organizacionId, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, departamento: true } }),
    prisma.tenant.findUnique({ where: { id: permisos.organizacionId }, select: { departamento: true } }),
    terminosMercadoPendientes(session.user.id),
  ]);
  return (
    <FormSolicitud terminosPendientes={!!terminos} granjas={granjas} departamentoDefecto={org?.departamento ?? ""}
      inicial={producto && productos.some(p => p.id === producto) ? producto : null}
      productos={productos.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, unidad: p.unidadBase, categoria: p.categoria.nombre }))} />
  );
}
