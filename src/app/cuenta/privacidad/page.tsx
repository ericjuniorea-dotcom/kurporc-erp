// La privacidad no se gestiona dentro de la app: está publicada en /condiciones y los pedidos van a info@kurporc.com
import { redirect } from "next/navigation";

export default function PrivacidadCuenta() { redirect("/condiciones?doc=privacidad"); }
