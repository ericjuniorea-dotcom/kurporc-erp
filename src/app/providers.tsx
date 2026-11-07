"use client";
// Proveedores globales de la app. La sesión se provee en el layout del ERP
// (src/app/(dashboard)/layout.tsx), que la arma en el servidor.
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
