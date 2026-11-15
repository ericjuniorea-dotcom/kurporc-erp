"use client";
// Último recurso: error en el layout raíz. Tiene que traer su propio <html> y <body>.
import { PantallaError } from "@/components/layout/pantalla-error";

export default function ErrorGlobal(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f3f1" }}>
        <PantallaError {...props} />
      </body>
    </html>
  );
}
