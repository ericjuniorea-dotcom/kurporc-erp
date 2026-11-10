// Marco público del Mercado KurPorc (Fase 12): encabezado con buscador, pie con contacto.
import Link from "next/link";
import { IconBuildingStore, IconSearch, IconRosetteDiscountCheckFilled } from "@tabler/icons-react";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AyudaSoporte } from "@/components/layout/ayuda-soporte";
import { getUsuario } from "@/lib/auth/config";
import { CORREO_INFO, CORREO_SOPORTE } from "@/lib/contacto";
import { textoPrecioBase } from "@/lib/mercado/calculo";
import type { Tarjeta } from "@/lib/mercado/consultas";

export const tarjetaEstilo: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
export const gsTexto = (v: bigint | number) => `Gs ${Number(v).toLocaleString("es-PY")}`;

export async function MarcoMercado({ children, q }: { children: React.ReactNode; q?: string }) {
  const usuario = await getUsuario();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border-default)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" aria-label="KurPorc, inicio"><KurPorcLogo size="sm" /></Link>
          <Link href="/mercado" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>Mercado</Link>
          <form action="/mercado" method="get" role="search" style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 6, background: "var(--bg-subtle)", border: "0.5px solid var(--border-default)", borderRadius: 999, padding: "0 12px", height: 36 }}>
            <IconSearch size={15} aria-hidden style={{ color: "var(--text-muted)" }} />
            <input name="q" defaultValue={q ?? ""} placeholder="Buscar núcleos, vacunas, lechones…" aria-label="Buscar en el Mercado"
              style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontSize: 13.5, color: "var(--text-primary)", minWidth: 0 }} />
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <ThemeToggle />
            {usuario ? (
              <>
                <Link href="/mercado/favoritos" style={{ color: "var(--text-secondary)" }}>Favoritos</Link>
                <Link href="/dashboard" style={{ color: "var(--text-secondary)" }}>Mi granja</Link>
              </>
            ) : (
              <>
                <Link href="/login?next=/mercado" style={{ color: "var(--text-secondary)" }}>Ingresar</Link>
                <Link href="/registro?next=/mercado" className="btn btn-primary" style={{ height: 30, fontSize: 12.5 }}>Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main style={{ flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "18px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </main>
      <footer style={{ borderTop: "0.5px solid var(--border-default)", padding: "18px 16px", fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.7 }}>
        <div>
          <Link href="/vendedor" style={{ color: "inherit" }}><IconBuildingStore size={13} aria-hidden style={{ verticalAlign: -2 }} /> Vendé en KurPorc</Link>
          {" · "}<Link href="/terminos" style={{ color: "inherit" }}>Términos</Link>{" · "}<Link href="/privacidad" style={{ color: "inherit" }}>Privacidad</Link>
        </div>
        <div>Comprar y vender es gratis. Cada tienda es responsable de lo que publica. Todas las tiendas aparecen en el mismo orden, sin destacados pagos ni propios.</div>
        <div>Ayuda y sugerencias: <a href={`mailto:${CORREO_SOPORTE}`} style={{ color: "inherit" }}>{CORREO_SOPORTE}</a> · Información: <a href={`mailto:${CORREO_INFO}`} style={{ color: "inherit" }}>{CORREO_INFO}</a></div>
      </footer>
      {usuario && <AyudaSoporte />}
    </div>
  );
}

export function Verificado({ size = 14 }: { size?: number }) {
  return <IconRosetteDiscountCheckFilled size={size} aria-label="Tienda verificada" style={{ color: "var(--accent)", verticalAlign: -2 }} />;
}

export function TarjetaPublicacion({ t }: { t: Tarjeta }) {
  const base = textoPrecioBase(t.precioGs, t.contenidoBase, t.unidadBase);
  return (
    <Link href={`/mercado/p/${t.slug}`} style={{ ...tarjetaEstilo, display: "flex", flexDirection: "column", overflow: "hidden", textDecoration: "none", color: "inherit" }}>
      <div style={{ aspectRatio: "4 / 3", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {t.foto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={t.foto} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.categoria}</span>}
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35 }}>{t.titulo}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.unidadVenta}{t.marca ? ` · ${t.marca}` : ""}</div>
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gsTexto(t.precioGs)}</div>
          {base && <div style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{base}</div>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
          {t.tienda.nombre} {t.tienda.verificada && <Verificado size={13} />}
          {t.tienda.resenas > 0 && <span style={{ color: "var(--text-muted)" }}>· ★ {t.tienda.calificacion.toFixed(1)}</span>}
        </div>
        {t.zonas.length > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Entrega en {t.zonas.slice(0, 3).join(", ")}{t.zonas.length > 3 ? ` y ${t.zonas.length - 3} más` : ""}</div>}
      </div>
    </Link>
  );
}
