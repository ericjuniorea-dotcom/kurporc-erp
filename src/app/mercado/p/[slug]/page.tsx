// Detalle público de una publicación (Fase 12). Pedir, cotizar y consultar por WhatsApp piden login.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IconBrandWhatsapp, IconFileInvoice, IconShoppingCart, IconAlertTriangle, IconTruckDelivery } from "@tabler/icons-react";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { MarcoMercado, Verificado, gsTexto, tarjetaEstilo } from "@/components/mercado/marco";
import { BotonFavorito, Denunciar } from "@/components/mercado/botones";
import { publicacionPorSlug } from "@/lib/mercado/consultas";
import { textoPrecioBase, UNIDAD_CORTA, type UnidadBase } from "@/lib/mercado/calculo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await publicacionPorSlug(slug);
  if (!d) return { title: "Publicación no disponible · Mercado KurPorc" };
  return { title: `${d.p.titulo} · ${d.org.farmName} · Mercado KurPorc`, description: d.p.descripcion?.slice(0, 160) ?? `${d.p.titulo}, ${d.p.unidadVenta}, en el Mercado KurPorc.` };
}

export default async function DetallePublicacion({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ accion?: string }> }) {
  const { slug } = await params;
  const { accion } = await searchParams;
  const usuario = await getUsuario();
  const session = usuario ? await getSession() : null;
  const miTienda = session?.membresias.find(m => m.tipo === "VENDEDOR")?.organizacionId ?? null;
  const d = await publicacionPorSlug(slug, miTienda);
  if (!d) notFound();
  const { p, tienda, org, categoria, producto } = d;
  const volver = `/mercado/p/${slug}`;
  const fav = usuario ? !!(await prisma.favorito.findUnique({ where: { userId_publicacionId: { userId: usuario.id, publicacionId: p.id } } })) : false;
  const base = textoPrecioBase(p.precioGs, Number(p.contenidoBase), p.unidadBase as UnidadBase);
  const login = (a: string) => `/registro?next=${encodeURIComponent(`${volver}?accion=${a}`)}`;
  const esPropia = miTienda === p.tiendaId;

  return (
    <MarcoMercado>
      <nav style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/mercado" style={{ color: "inherit" }}>Mercado</Link> › <Link href={`/mercado?cat=${categoria.slug}`} style={{ color: "inherit" }}>{categoria.nombre}</Link>
      </nav>
      {!d.visible && (
        <div style={{ padding: "8px 12px", fontSize: 12.5, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
          Vista previa: esta publicación está en estado {p.estado.toLowerCase()} y solo la ves vos.{p.motivoRechazo ? ` Motivo: ${p.motivoRechazo}` : ""}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...tarjetaEstilo, aspectRatio: "4 / 3", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {p.fotos[0]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.fotos[0]} alt={p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{categoria.nombre}</span>}
          </div>
          {p.fotos.length > 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {p.fotos.map((f, i) => (
                <a key={i} href={f} target="_blank" rel="noopener noreferrer" style={{ ...tarjetaEstilo, aspectRatio: "1", overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f} alt={`Foto ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "var(--text-primary)", lineHeight: 1.25 }}>{p.titulo}</h1>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{p.unidadVenta}{p.marca ? ` · ${p.marca}` : ""}{producto ? ` · ${producto.codigo}` : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 650, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gsTexto(p.precioGs)}</div>
            {base && <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{base} · contiene {Number(p.contenidoBase).toLocaleString("es-PY")} {UNIDAD_CORTA[p.unidadBase as UnidadBase]}</div>}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <div>Pedido mínimo: <strong>{p.pedidoMinimo}</strong>{p.stockDisponible !== null ? ` · Disponibles: ${p.stockDisponible}` : ""}</div>
            <div><IconTruckDelivery size={14} aria-hidden style={{ verticalAlign: -2 }} /> Entrega en {p.plazoEntregaDias} día{p.plazoEntregaDias === 1 ? "" : "s"}{p.zonasEntrega.length ? ` · ${p.zonasEntrega.join(", ")}` : ""}</div>
          </div>
          {p.requiereReceta && (
            <div style={{ display: "flex", gap: 8, padding: "8px 12px", fontSize: 12.5, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
              <IconAlertTriangle size={15} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} /> Venta sujeta a receta veterinaria; responsabilidad del vendedor.
            </div>
          )}
          {categoria.requiereVerificacion && p.declaracionSanitaria && (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>La tienda declara que entrega la documentación sanitaria de traslado exigida por SENACSA.</div>
          )}

          {!esPropia && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {usuario ? (
                accion === "pedir" || accion === "cotizar" ? (
                  <div style={{ ...tarjetaEstilo, padding: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    Los pedidos y las cotizaciones dentro de KurPorc se habilitan en los próximos días. Mientras tanto, consultá a la tienda por WhatsApp.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`${volver}?accion=pedir`} className="btn btn-primary" style={{ height: 38 }}><IconShoppingCart size={16} aria-hidden /> Pedir</Link>
                    <Link href={`${volver}?accion=cotizar`} className="btn" style={{ height: 38 }}><IconFileInvoice size={16} aria-hidden /> Solicitar cotización</Link>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={login("pedir")} className="btn btn-primary" style={{ height: 38 }}><IconShoppingCart size={16} aria-hidden /> Pedir</Link>
                  <Link href={login("cotizar")} className="btn" style={{ height: 38 }}><IconFileInvoice size={16} aria-hidden /> Solicitar cotización</Link>
                </div>
              )}
              {org.whatsapp && (
                <a href={usuario ? `${volver}/whatsapp` : login("whatsapp")} className="btn" style={{ height: 38, alignSelf: "flex-start" }}>
                  <IconBrandWhatsapp size={16} aria-hidden style={{ color: "#25D366" }} /> Consultar por WhatsApp
                </a>
              )}
              {!usuario && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Creá tu cuenta gratis para pedir o consultar; volvés a esta misma publicación.</div>}
            </div>
          )}
          {esPropia && <Link href={`/vendedor/productos/${p.id}`} className="btn" style={{ height: 34, alignSelf: "flex-start" }}>Editar publicación</Link>}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <BotonFavorito id={p.id} inicial={fav} conSesion={!!usuario} volver={volver} />
          </div>

          <Link href={`/tienda/${org.slug}`} style={{ ...tarjetaEstilo, padding: 12, display: "flex", flexDirection: "column", gap: 2, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{org.farmName} {org.verificacion === "VERIFICADA" && <Verificado />}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {org.departamento ?? "Paraguay"}{tienda.totalResenas > 0 ? ` · ★ ${Number(tienda.calificacion).toFixed(1)} (${tienda.totalResenas})` : ""} · Ver la tienda →
            </div>
          </Link>
        </div>
      </div>

      {p.descripcion && (
        <section style={{ ...tarjetaEstilo, padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Descripción</h2>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.descripcion}</div>
        </section>
      )}
      {!esPropia && <Denunciar id={p.id} conSesion={!!usuario} volver={volver} />}
    </MarcoMercado>
  );
}
