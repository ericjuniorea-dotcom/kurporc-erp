// Pantallas de la cuenta personal: requieren sesión, no una organización.
import { redirect } from "next/navigation";
import { getUsuario } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  if (usuario.faltaSegundoFactor) redirect("/auth/segundo-factor");
  return <>{children}</>;
}
