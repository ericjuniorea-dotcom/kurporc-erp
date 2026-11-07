"use client";
// Cliente de Supabase para el navegador: ingreso con Google y segundo factor.
// Solo usa la clave pública (anon); los datos siguen protegidos por RLS.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
