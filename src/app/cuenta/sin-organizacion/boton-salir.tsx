"use client";
import { signOut } from "@/lib/auth/sesion-cliente";

export function BotonSalir() {
  return (
    <button type="button" className="btn" onClick={() => signOut({ callbackUrl: "/login" })}
      style={{ width: "100%", height: 34, justifyContent: "center", marginTop: 6 }}>
      Cerrar sesión
    </button>
  );
}
