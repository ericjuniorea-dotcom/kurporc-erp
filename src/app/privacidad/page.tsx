// Las políticas viven en una sola página pública: /condiciones
import { redirect } from "next/navigation";

export default function Privacidad() { redirect("/condiciones?doc=privacidad"); }
