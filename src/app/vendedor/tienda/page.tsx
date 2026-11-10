// Mi tienda (Fase 12): descripción, zonas de entrega, horario y WhatsApp.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { FormularioTienda } from "./formulario";

export default async function MiTienda() {
  const t = (await contextoTienda())!;
  const tienda = await prisma.tienda.findUnique({ where: { organizacionId: t.org.id } });
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Lo que cargues acá aparece en tu <Link href={`/tienda/${t.org.slug}`}>página pública</Link>. El equipo de la tienda (quién puede cargar productos, cambiar precios o responder) se maneja desde <Link href="/equipo">Equipo</Link> cuando la tienda es tu organización activa.
      </div>
      <FormularioTienda puedeEditar={t.puede("tienda.perfil.editar")} inicial={{
        descripcion: tienda?.descripcion ?? "", zonasEntrega: tienda?.zonasEntrega ?? [], horario: tienda?.horario ?? "", whatsapp: t.org.whatsapp ?? "",
      }} />
    </>
  );
}
