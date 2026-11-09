// Pantallas de la cuenta personal: requieren sesión, no una organización ni haber
// aceptado el contrato (privacidad y seguridad siempre accesibles, punto 4.2.10).
import { redirect } from "next/navigation";
import { getUsuario } from "@/lib/auth/config";
import { AyudaSoporte } from "@/components/layout/ayuda-soporte";

export const dynamic = "force-dynamic";

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  if (usuario.faltaSegundoFactor) redirect("/auth/segundo-factor");
  return <>{children}<AyudaSoporte /></>;
}
