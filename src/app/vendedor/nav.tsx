"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/sesion-cliente";

const SECCIONES = [
  { href: "/vendedor", label: "Inicio" },
  { href: "/vendedor/pedidos", label: "Pedidos" },
  { href: "/vendedor/cotizaciones", label: "Cotizaciones" },
  { href: "/vendedor/productos", label: "Productos" },
  { href: "/vendedor/tienda", label: "Mi tienda" },
];

export function NavVendedor() {
  const ruta = usePathname();
  return (
    <nav aria-label="Panel de vendedor" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 2, padding: "0 16px", overflowX: "auto" }}>
      {SECCIONES.map(s => {
        const activa = s.href === "/vendedor" ? ruta === "/vendedor" : ruta.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} aria-current={activa ? "page" : undefined}
            style={{ padding: "9px 12px", fontSize: 13, whiteSpace: "nowrap", textDecoration: "none", color: activa ? "var(--text-primary)" : "var(--text-muted)", fontWeight: activa ? 500 : 400, borderBottom: `2px solid ${activa ? "var(--accent)" : "transparent"}` }}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Salir() {
  return (
    <button type="button" className="btn" onClick={() => signOut({ callbackUrl: "/login" })} style={{ height: 30, fontSize: 12 }}>
      Cerrar sesión
    </button>
  );
}
