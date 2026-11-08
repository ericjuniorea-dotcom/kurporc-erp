"use client";
// Sesión en el navegador (Fase 3). Reemplaza a SessionProvider/useSession de NextAuth
// con la misma forma ({ data, status }) para que las pantallas no cambien.
// La sesión se arma en el servidor (layout) y se pasa como prop: no hay fetch extra.

import { createContext, useContext, useMemo } from "react";
import type { AppSession } from "./config";

// Igual que NextAuth: si status es "authenticated", data nunca es null. "loading" no ocurre
// (la sesión llega armada del servidor) pero se mantiene por compatibilidad con las pantallas.
type ValorSesion =
  | { data: AppSession; status: "authenticated" }
  | { data: null; status: "unauthenticated" | "loading" };
const Ctx = createContext<ValorSesion>({ data: null, status: "unauthenticated" });

export function SesionProvider({ session, children }: { session: AppSession | null; children: React.ReactNode }) {
  return (
    <Ctx.Provider value={session ? { data: session, status: "authenticated" } : { data: null, status: "unauthenticated" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): ValorSesion {
  return useContext(Ctx);
}

/** Permisos de la persona en la organización activa (para mostrar u ocultar; la seguridad está en el servidor). */
export function usePermisos() {
  const { data } = useContext(Ctx);
  return useMemo(() => {
    const lista = new Set(data?.permisos ?? []);
    const puede = (clave: string) => !!data?.esPropietario || lista.has(clave);
    return { puede, alguno: (claves: string[]) => claves.some(puede), esPropietario: !!data?.esPropietario };
  }, [data]);
}

/** <Can permiso="gestacion.servicios.crear">…</Can> */
export function Can({ permiso, children, sino = null }: { permiso: string; children: React.ReactNode; sino?: React.ReactNode }) {
  return <>{usePermisos().puede(permiso) ? children : sino}</>;
}

/** Cierra la sesión. `global: true` la cierra en todos los dispositivos. */
export async function signOut(opciones: { callbackUrl?: string; global?: boolean } = {}) {
  await fetch(`/auth/salir${opciones.global ? "?alcance=global" : ""}`, { method: "POST" }).catch(() => {});
  window.location.href = opciones.callbackUrl ?? "/login";
}
