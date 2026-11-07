// Render dinámico: así cada request recibe el nonce de la CSP (Fase 2.2).
// Una página estática tendría sus <script> sin nonce y la política los bloquearía.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
