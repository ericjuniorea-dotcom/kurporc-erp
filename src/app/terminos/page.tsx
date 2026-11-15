// Las condiciones viven en una sola página pública: /condiciones
import { redirect } from "next/navigation";

export default function Terminos() { redirect("/condiciones?doc=terminos"); }
