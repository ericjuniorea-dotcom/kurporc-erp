"use client";
// Encabezado y menú del panel de plataforma (Fase 15.4): 5 grupos y, debajo, las pestañas del grupo.
// En un celular de 360 px los 5 grupos entran en una fila (ícono y nombre corto).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBriefcase, IconHome, IconInbox, IconLogout, IconShieldCheck, IconShieldLock, IconUsers } from "@tabler/icons-react";
import { signOut } from "@/lib/auth/sesion-cliente";

type Seccion = { href: string; label: string; niveles?: string[]; exacta?: boolean };
const GESTION = ["TOTAL", "SOPORTE"];

const GRUPOS: { clave: string; label: string; icono: typeof IconHome; secciones: Seccion[] }[] = [
  { clave: "inicio", label: "Inicio", icono: IconHome, secciones: [{ href: "/admin", label: "Inicio", niveles: ["TOTAL", "SOPORTE", "MODERACION", "LECTURA"], exacta: true }] },
  { clave: "clientes", label: "Clientes", icono: IconUsers, secciones: [
    { href: "/admin/cuentas", label: "Cuentas" },
    { href: "/admin/organizaciones", label: "Organizaciones" },
  ] },
  { clave: "negocio", label: "Negocio", icono: IconBriefcase, secciones: [
    { href: "/admin/produccion", label: "Producción" },
    { href: "/admin/facturacion", label: "Facturación" },
    { href: "/admin/mercado", label: "Mercado", niveles: ["TOTAL", "SOPORTE", "MODERACION", "LECTURA"] },
    { href: "/admin/vendedores", label: "Vendedores", niveles: ["TOTAL", "SOPORTE", "MODERACION"] },
  ] },
  { clave: "buzon", label: "Buzón", icono: IconInbox, secciones: [
    { href: "/admin/buzon", label: "Buzón", exacta: true },
    { href: "/admin/buzon/hoja-de-ruta", label: "Hoja de ruta" },
  ] },
  { clave: "control", label: "Control", icono: IconShieldCheck, secciones: [
    { href: "/admin/moderacion", label: "Moderación", niveles: ["TOTAL", "SOPORTE", "MODERACION"] },
    { href: "/admin/actividad", label: "Actividad" },
    { href: "/admin/seguridad", label: "Seguridad" },
    { href: "/admin/privacidad", label: "Privacidad" },
    { href: "/admin/legal", label: "Legal" },
    { href: "/admin/datos", label: "Datos" },
    { href: "/admin/configuracion", label: "Configuración" },
    { href: "/admin/administradores", label: "Administradores" },
  ] },
];

const activa = (ruta: string, s: Seccion) => s.exacta ? ruta === s.href : ruta === s.href || ruta.startsWith(`${s.href}/`);

export function NavegacionAdmin({ nombre, nivel }: { nombre: string; nivel: string }) {
  const ruta = usePathname();
  const grupos = GRUPOS
    .map(g => ({ ...g, secciones: g.secciones.filter(s => (s.niveles ?? GESTION).includes(nivel)) }))
    .filter(g => g.secciones.length > 0);
  const actual = grupos.find(g => g.secciones.some(s => activa(ruta, s)))
    ?? grupos.find(g => g.clave === "buzon" && ruta.startsWith("/admin/sugerencias"))
    ?? grupos[0];

  return (
    <header style={{ background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border-default)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", flexWrap: "wrap" }}>
        <Link href="/admin" title="Ir al Inicio del panel" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--danger-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <IconShieldLock size={17} style={{ color: "var(--danger)" }} aria-hidden />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Panel de plataforma</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{nombre} · Super Administrador {nivel}</div>
          </div>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin" className="btn btn-primary" style={{ height: 30, fontSize: 12, gap: 5 }}><IconHome size={14} aria-hidden /> Inicio</Link>
          <button type="button" className="btn" style={{ height: 30, fontSize: 12, gap: 5 }} onClick={() => signOut({ callbackUrl: "/login" })}><IconLogout size={14} aria-hidden /> Cerrar sesión</button>
        </div>
      </div>
      <nav aria-label="Grupos del panel" style={{ display: "flex", gap: 2, padding: "0 12px", borderBottom: "0.5px solid var(--border-default)" }}>
        {grupos.map(g => {
          const on = g.clave === actual.clave;
          const Icono = g.icono;
          return (
            <Link key={g.clave} href={g.secciones[0].href} aria-current={on ? "true" : undefined}
              style={{ flex: "1 1 0", minWidth: 0, maxWidth: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 4px", fontSize: 12.5, whiteSpace: "nowrap", textDecoration: "none",
                color: on ? "var(--text-primary)" : "var(--text-muted)", fontWeight: on ? 500 : 400, borderBottom: `2px solid ${on ? "var(--danger)" : "transparent"}` }}>
              <Icono size={15} aria-hidden style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</span>
            </Link>
          );
        })}
      </nav>
      {actual.secciones.length > 1 && (
        <nav aria-label={`Secciones de ${actual.label}`} style={{ display: "flex", gap: 2, padding: "0 20px", overflowX: "auto", background: "var(--bg-base)" }}>
          {actual.secciones.map(s => {
            const on = activa(ruta, s);
            return (
              <Link key={s.href} href={s.href} aria-current={on ? "page" : undefined}
                style={{ padding: "7px 10px", fontSize: 12, whiteSpace: "nowrap", textDecoration: "none", color: on ? "var(--text-primary)" : "var(--text-muted)", fontWeight: on ? 500 : 400 }}>
                {s.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
