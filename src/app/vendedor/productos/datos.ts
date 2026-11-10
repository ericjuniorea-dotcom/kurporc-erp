// Datos que necesita el formulario de publicación (catálogo y categorías).
import "server-only";
import prisma from "@/lib/db/prisma";

export async function datosFormulario(tiendaId: string) {
  const [cats, productos] = await Promise.all([
    prisma.categoriaMercado.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    prisma.productoCatalogo.findMany({ where: { OR: [{ aprobado: true }, { propuestoPor: tiendaId }] }, orderBy: { nombre: "asc" }, select: { id: true, codigo: true, nombre: true, categoriaId: true, unidadBase: true, requiereReceta: true, aprobado: true } }),
  ]);
  const raices = cats.filter(c => !c.padreId);
  const categorias = raices.flatMap(r => {
    const hijas = cats.filter(c => c.padreId === r.id);
    return hijas.length
      ? hijas.map(h => ({ id: h.id, nombre: `${r.nombre} › ${h.nombre}`, animales: h.requiereVerificacion || r.requiereVerificacion }))
      : [{ id: r.id, nombre: r.nombre, animales: r.requiereVerificacion }];
  });
  return { categorias, productos };
}
