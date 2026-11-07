// Cliente de Supabase con la clave de servicio: SOLO servidor.
// Salta RLS y administra usuarios (cuentas gestionadas, migración de usuarios).
// Nunca importarlo desde un componente "use client" ni exponer la clave en NEXT_PUBLIC_*.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });
}
