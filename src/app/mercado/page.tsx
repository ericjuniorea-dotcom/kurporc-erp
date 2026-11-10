// Mercado KurPorc (Fase 12): navegación y búsqueda públicas, sin login.
import Link from "next/link";
import type { Metadata } from "next";
import { MarcoMercado, TarjetaPublicacion, tarjetaEstilo } from "@/components/mercado/marco";
import { buscarPublicaciones, categoriasMercado, POR_PAGINA, type Orden } from "@/lib/mercado/consultas";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mercado KurPorc · Insumos, sanidad, genética y servicios para granjas porcinas",
  description: "Núcleos, balanceados, vacunas, semen, lechones, equipos y servicios para tu granja, de tiendas verificadas de Paraguay. Comprar y vender es gratis.",
};

type SP = { q?: string; cat?: string; depto?: string; max?: string; ver?: string; orden?: string; p?: string };
const ORDENES: [Orden, string][] = [["relevancia", "Más relevantes"], ["precio", "Menor precio por unidad"], ["nuevos", "Más nuevos"], ["calificacion", "Mejor calificados"]];

function url(sp: SP, cambios: Partial<SP>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...cambios })) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `/mercado?${s}` : "/mercado";
}

export default async function Mercado({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const orden = (ORDENES.find(([k]) => k === sp.orden)?.[0] ?? (sp.q ? "relevancia" : "nuevos")) as Orden;
  const pagina = Math.max(0, Number(sp.p) || 0);
  const [cats, r] = await Promise.all([
    categoriasMercado(),
    buscarPublicaciones({ q: sp.q, categoria: sp.cat, depto: sp.depto, precioMax: Number(sp.max) || undefined, verificados: sp.ver === "1", orden, pagina }),
  ]);
  const actual = cats.flatMap(c => [c, ...c.hijas]).find(c => c.slug === sp.cat);
  const paginas = Math.ceil(r.total / POR_PAGINA);
  const etiqueta: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 };

  return (
    <MarcoMercado q={sp.q}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
          {sp.q ? `Resultados para «${sp.q}»` : actual ? actual.nombre : "Todo para tu granja, en un solo lugar"}
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          {r.total.toLocaleString("es-PY")} publicacion{r.total === 1 ? "" : "es"}. Comparás por precio por kilo, por dosis o por unidad, no por bolsa.
        </div>
      </div>

      <nav aria-label="Categorías" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Link href={url(sp, { cat: undefined, p: undefined })} className="btn" style={{ height: 30, fontSize: 12.5, fontWeight: !sp.cat ? 600 : 400 }}>Todo</Link>
        {cats.map(c => {
          const activa = sp.cat === c.slug || c.hijas.some(h => h.slug === sp.cat);
          return <Link key={c.id} href={url(sp, { cat: c.slug, p: undefined })} className="btn" style={{ height: 30, fontSize: 12.5, fontWeight: activa ? 600 : 400, background: activa ? "var(--bg-subtle)" : undefined }}>{c.nombre}</Link>;
        })}
      </nav>
      {(() => {
        const raiz = cats.find(c => c.slug === sp.cat || c.hijas.some(h => h.slug === sp.cat));
        return raiz && raiz.hijas.length > 0 ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
            {raiz.hijas.map(h => <Link key={h.id} href={url(sp, { cat: h.slug, p: undefined })} style={{ color: sp.cat === h.slug ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: sp.cat === h.slug ? 600 : 400 }}>{h.nombre}</Link>)}
          </div>
        ) : null;
      })()}
      {actual?.requiereVerificacion && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>En esta categoría solo publican tiendas verificadas que entregan la documentación sanitaria de traslado exigida por SENACSA.</div>}

      <form method="get" action="/mercado" style={{ ...tarjetaEstilo, padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {sp.q && <input type="hidden" name="q" value={sp.q} />}
        {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
        <label style={etiqueta}>Entrega en
          <select name="depto" className="kp-input" defaultValue={sp.depto ?? ""} style={{ minWidth: 170 }}>
            <option value="">Todo el país</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label style={etiqueta}>Precio máximo (Gs)
          <input name="max" type="number" min={0} step={1000} className="kp-input" defaultValue={sp.max ?? ""} style={{ width: 150 }} />
        </label>
        <label style={etiqueta}>Ordenar
          <select name="orden" className="kp-input" defaultValue={orden}>
            {ORDENES.filter(([k]) => k !== "relevancia" || sp.q).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, height: 34 }}>
          <input type="checkbox" name="ver" value="1" defaultChecked={sp.ver === "1"} /> Solo tiendas verificadas
        </label>
        <button className="btn btn-primary" type="submit" style={{ height: 34 }}>Aplicar</button>
      </form>

      {r.tarjetas.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {r.tarjetas.map(t => <TarjetaPublicacion key={t.id} t={t} />)}
        </div>
      ) : (
        <div style={{ ...tarjetaEstilo, padding: 28, textAlign: "center", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {sp.q || sp.cat || sp.depto || sp.max || sp.ver
            ? <>No encontramos publicaciones con esos filtros. <Link href="/mercado">Ver todo el Mercado</Link></>
            : <>El Mercado recién abre: todavía no hay publicaciones. ¿Vendés insumos, genética o servicios para granjas? <Link href="/registro?tipo=VENDEDOR&next=/vendedor">Abrí tu tienda gratis</Link>.</>}
        </div>
      )}

      {paginas > 1 && (
        <nav aria-label="Páginas" style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", fontSize: 12.5 }}>
          {pagina > 0 && <Link className="btn" style={{ height: 30 }} href={url(sp, { p: String(pagina - 1) })}>← Anterior</Link>}
          <span style={{ color: "var(--text-muted)" }}>Página {pagina + 1} de {paginas}</span>
          {pagina + 1 < paginas && <Link className="btn" style={{ height: 30 }} href={url(sp, { p: String(pagina + 1) })}>Siguiente →</Link>}
        </nav>
      )}
    </MarcoMercado>
  );
}
