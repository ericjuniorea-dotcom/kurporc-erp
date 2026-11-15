"use client";
// Error en cualquier pantalla (ingreso, cuenta, panel, mercado): aviso con recarga en vez de la página en blanco.
import { PantallaError } from "@/components/layout/pantalla-error";

export default function ErrorGeneral(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError {...props} />;
}
