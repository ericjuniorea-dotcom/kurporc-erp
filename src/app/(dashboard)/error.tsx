"use client";
// Error dentro del ERP: aviso con recarga (y recarga automática si KurPorc se actualizó con la página abierta).
import { PantallaError } from "@/components/layout/pantalla-error";

export default function ErrorERP(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError {...props} />;
}
