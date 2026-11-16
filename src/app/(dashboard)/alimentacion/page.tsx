// Nutrición ahora es un cuadro dentro de Sanidad y Nutrición: la dirección vieja lleva directo ahí.
import { redirect } from "next/navigation";

export default function NutricionPage() {
  redirect("/sanidad?categoria=nutricion");
}
