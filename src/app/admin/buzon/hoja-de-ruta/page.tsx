// Fase 15.4 · Hoja de ruta publicada (vista del panel, igual a la que ven los clientes, sin votar).
import { requireAdmin } from "@/lib/admin/acceso";
import { hojaDeRuta } from "@/app/acciones/sugerencias";
import { HojaDeRuta } from "@/components/buzon/hoja-de-ruta";
import { PestanasBuzon } from "../pestanas";

export const dynamic = "force-dynamic";

export default async function HojaAdmin() {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const items = await hojaDeRuta();
  return (
    <>
      <PestanasBuzon activa="hoja" />
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Así la ven los clientes en «Mi cuenta → Hoja de ruta». Para publicar o retirar una función, abrí el mensaje en la bandeja.
      </div>
      <HojaDeRuta items={items} votar={false} />
    </>
  );
}
