import Link from "next/link";
import { redirect } from "next/navigation";
import { contextoTienda } from "@/lib/mercado/vendedor";
import prisma from "@/lib/db/prisma";
import { datosFormulario } from "../datos";
import { FormularioPublicacion } from "../formulario";

export default async function NuevoProducto() {
  const t = (await contextoTienda())!;
  if (!t.puede("tienda.publicaciones.crear")) redirect("/vendedor/productos");
  const [{ categorias, productos }, tienda] = await Promise.all([datosFormulario(t.org.id), prisma.tienda.findUnique({ where: { organizacionId: t.org.id } })]);
  return (
    <>
      <Link href="/vendedor/productos" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Productos</Link>
      <FormularioPublicacion categorias={categorias} productos={productos} verificada={t.org.verificacion === "VERIFICADA"} inicial={{
        productoCatalogoId: null, categoriaId: "", titulo: "", descripcion: "", marca: "", precioGs: "", unidadVenta: "", unidadBase: "KG", contenidoBase: "",
        pedidoMinimo: "1", stockDisponible: "", plazoEntregaDias: "3", zonasEntrega: tienda?.zonasEntrega ?? [], fotos: [], declaracionSanitaria: false,
      }} />
    </>
  );
}
