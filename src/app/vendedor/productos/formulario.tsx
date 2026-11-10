"use client";
// Formulario de publicación (Fase 12). Las fotos se convierten a WebP ≤ 300 KB en el navegador.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPhotoPlus, IconX } from "@tabler/icons-react";
import { cambiarEstadoPublicacion, guardarPublicacion, proponerProducto, subirFoto } from "@/app/acciones/vendedor";
import { textoPrecioBase, UNIDAD_CORTA, UNIDADES, type UnidadBase } from "@/lib/mercado/calculo";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

type Categoria = { id: string; nombre: string; animales: boolean };
type Producto = { id: string; codigo: string; nombre: string; categoriaId: string; unidadBase: string; requiereReceta: boolean; aprobado: boolean };
export type Inicial = {
  id?: string; productoCatalogoId: string | null; categoriaId: string; titulo: string; descripcion: string; marca: string;
  precioGs: string; unidadVenta: string; unidadBase: UnidadBase; contenidoBase: string; pedidoMinimo: string; stockDisponible: string;
  plazoEntregaDias: string; zonasEntrega: string[]; fotos: string[]; declaracionSanitaria: boolean; estado?: string;
};

const etiqueta: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12 };

async function aWebp(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  let ancho = Math.min(1400, img.width), q = 0.85;
  for (let intento = 0; intento < 8; intento++) {
    const alto = Math.round(img.height * (ancho / img.width));
    const c = document.createElement("canvas");
    c.width = ancho; c.height = alto;
    c.getContext("2d")!.drawImage(img, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/webp", q));
    if (blob && blob.type === "image/webp" && blob.size <= 300 * 1024) return blob;
    if (blob && blob.type !== "image/webp") throw new Error("Tu navegador no puede convertir a WebP. Probá con Chrome o Edge.");
    if (q > 0.55) q -= 0.1; else ancho = Math.round(ancho * 0.8);
  }
  throw new Error("No pudimos achicar la foto a 300 KB. Probá con otra.");
}

export function FormularioPublicacion({ inicial, categorias, productos, verificada }: { inicial: Inicial; categorias: Categoria[]; productos: Producto[]; verificada: boolean }) {
  const router = useRouter();
  const [d, setD] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [buscar, setBuscar] = useState("");
  const [proponer, setProponer] = useState(false);
  const [lista, setLista] = useState(productos);
  const set = <K extends keyof Inicial>(k: K, v: Inicial[K]) => setD(x => ({ ...x, [k]: v }));
  const categoria = categorias.find(c => c.id === d.categoriaId);
  const producto = lista.find(p => p.id === d.productoCatalogoId);
  const base = textoPrecioBase(Number(d.precioGs) || 0, Number(d.contenidoBase) || 0, d.unidadBase);
  const sugeridos = useMemo(() => {
    const q = buscar.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!q.length) return [];
    return lista.filter(p => { const t = `${p.nombre} ${p.codigo}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); return q.every(w => t.includes(w)); }).slice(0, 8);
  }, [buscar, lista]);

  const elegirProducto = (p: Producto) => {
    setD(x => ({ ...x, productoCatalogoId: p.id, categoriaId: p.categoriaId, unidadBase: p.unidadBase as UnidadBase, titulo: x.titulo || p.nombre }));
    setBuscar("");
  };

  async function agregarFotos(files: FileList | null) {
    if (!files) return;
    setError(null); setSubiendo(true);
    try {
      for (const f of Array.from(files).slice(0, 6 - d.fotos.length)) {
        const webp = await aWebp(f);
        const fd = new FormData();
        fd.append("foto", new File([webp], "foto.webp", { type: "image/webp" }));
        const r = await subirFoto(fd);
        if (!r.ok) throw new Error(r.error);
        setD(x => ({ ...x, fotos: [...x.fotos, r.url].slice(0, 6) }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo subir la foto."); }
    setSubiendo(false);
  }

  function guardar(publicar: boolean) {
    setError(null); setAviso(null);
    iniciar(async () => {
      const r = await guardarPublicacion({
        id: d.id, productoCatalogoId: d.productoCatalogoId, categoriaId: d.categoriaId, titulo: d.titulo, descripcion: d.descripcion, marca: d.marca,
        precioGs: Number(d.precioGs.replace(/\D/g, "")), unidadVenta: d.unidadVenta, unidadBase: d.unidadBase, contenidoBase: Number(d.contenidoBase.replace(",", ".")),
        pedidoMinimo: Number(d.pedidoMinimo) || 1, stockDisponible: d.stockDisponible === "" ? null : Number(d.stockDisponible), plazoEntregaDias: Number(d.plazoEntregaDias) || 0,
        zonasEntrega: d.zonasEntrega as (typeof DEPARTAMENTOS)[number][], fotos: d.fotos, declaracionSanitaria: d.declaracionSanitaria, publicar,
      });
      if (!r.ok) { setError(r.error); return; }
      if (r.aviso) { setAviso(`Guardado como borrador. ${r.aviso}`); if (!d.id) router.replace(`/vendedor/productos/${r.id}`); else router.refresh(); return; }
      router.push("/vendedor/productos");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
      <section style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>1. ¿Qué vendés?</div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Elegilo del catálogo de KurPorc: así los productores lo encuentran y lo comparan con otras tiendas, y cuando lo reciban entra solo a su stock.</div>
        {producto ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <strong>{producto.nombre}</strong> <span style={{ color: "var(--text-muted)" }}>{producto.codigo}{!producto.aprobado ? " · propuesto, en revisión" : ""}</span>
            <button type="button" className="btn" style={{ height: 26, fontSize: 11.5 }} onClick={() => set("productoCatalogoId", null)}>Cambiar</button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input className="kp-input" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar en el catálogo: núcleo lactación, vacuna circovirus, lechón…" style={{ width: "100%" }} aria-label="Buscar en el catálogo" />
            {sugeridos.length > 0 && (
              <div role="listbox" style={{ position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", marginTop: 4, ...tarjeta, padding: 4, gap: 0, boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}>
                {sugeridos.map(p => (
                  <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => elegirProducto(p)}
                    style={{ textAlign: "left", padding: "7px 10px", background: "none", border: 0, cursor: "pointer", fontSize: 13, color: "var(--text-primary)", borderRadius: 6 }}>
                    {p.nombre} <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{p.codigo} · {UNIDAD_CORTA[p.unidadBase as UnidadBase]}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, marginTop: 6 }}>
              ¿No está? <button type="button" onClick={() => setProponer(!proponer)} style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Proponer un producto</button> o publicalo sin producto del catálogo.
            </div>
            {proponer && <Proponer categorias={categorias} alCrear={p => { setLista(l => [...l, p]); elegirProducto(p); setProponer(false); }} />}
          </div>
        )}
        <label style={etiqueta}>Categoría
          <select className="kp-input" value={d.categoriaId} onChange={e => set("categoriaId", e.target.value)} disabled={!!producto}>
            <option value="">Elegí…</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <label style={etiqueta}>Título
            <input className="kp-input" value={d.titulo} maxLength={120} onChange={e => set("titulo", e.target.value)} placeholder="Núcleo de lactación 4 %" />
          </label>
          <label style={etiqueta}>Marca
            <input className="kp-input" value={d.marca} maxLength={80} onChange={e => set("marca", e.target.value)} />
          </label>
        </div>
        <label style={etiqueta}>Descripción
          <textarea className="kp-input" rows={4} value={d.descripcion} maxLength={4000} onChange={e => set("descripcion", e.target.value)} style={{ height: "auto", padding: 8 }} placeholder="Composición, uso, presentación, condiciones…" />
        </label>
      </section>

      <section style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>2. Precio y presentación</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <label style={etiqueta}>Cómo se vende
            <input className="kp-input" value={d.unidadVenta} maxLength={60} onChange={e => set("unidadVenta", e.target.value)} placeholder="Bolsa 40 kg" />
          </label>
          <label style={etiqueta}>Precio (Gs)
            <input className="kp-input" inputMode="numeric" value={d.precioGs} onChange={e => set("precioGs", e.target.value.replace(/[^\d]/g, ""))} placeholder="94000" />
          </label>
          <label style={etiqueta}>Contiene
            <input className="kp-input" inputMode="decimal" value={d.contenidoBase} onChange={e => set("contenidoBase", e.target.value)} placeholder="40" />
          </label>
          <label style={etiqueta}>Unidad
            <select className="kp-input" value={d.unidadBase} onChange={e => set("unidadBase", e.target.value as UnidadBase)} disabled={!!producto}>
              {UNIDADES.map(u => <option key={u} value={u}>{UNIDAD_CORTA[u]}</option>)}
            </select>
          </label>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Precio por {UNIDAD_CORTA[d.unidadBase]}: <strong style={{ color: "var(--text-primary)" }}>{base ?? "—"}</strong> (así comparan los productores).</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <label style={etiqueta}>Pedido mínimo
            <input className="kp-input" type="number" min={1} value={d.pedidoMinimo} onChange={e => set("pedidoMinimo", e.target.value)} />
          </label>
          <label style={etiqueta}>Disponibles (opcional)
            <input className="kp-input" type="number" min={0} value={d.stockDisponible} onChange={e => set("stockDisponible", e.target.value)} />
          </label>
          <label style={etiqueta}>Plazo de entrega (días)
            <input className="kp-input" type="number" min={0} max={120} value={d.plazoEntregaDias} onChange={e => set("plazoEntregaDias", e.target.value)} />
          </label>
        </div>
        {producto?.requiereReceta && <div style={{ fontSize: 12.5, color: "var(--warning-text)" }}>Este producto se muestra con el aviso «Venta sujeta a receta veterinaria; responsabilidad del vendedor».</div>}
      </section>

      <section style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>3. ¿Dónde entregás?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DEPARTAMENTOS.map(dep => {
            const sel = d.zonasEntrega.includes(dep);
            return (
              <button key={dep} type="button" aria-pressed={sel} onClick={() => set("zonasEntrega", sel ? d.zonasEntrega.filter(z => z !== dep) : [...d.zonasEntrega, dep])}
                className="btn" style={{ height: 28, fontSize: 12, background: sel ? "var(--accent-subtle, var(--bg-subtle))" : undefined, fontWeight: sel ? 600 : 400, borderColor: sel ? "var(--accent)" : undefined }}>
                {dep}
              </button>
            );
          })}
        </div>
      </section>

      <section style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>4. Fotos <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}>hasta 6 · la primera es la principal</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {d.fotos.map((f, i) => (
            <div key={f} style={{ position: "relative", width: 96, height: 96, borderRadius: 8, overflow: "hidden", border: "0.5px solid var(--border-default)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" aria-label="Quitar foto" onClick={() => set("fotos", d.fotos.filter(x => x !== f))}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: 0, background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={13} /></button>
            </div>
          ))}
          {d.fotos.length < 6 && (
            <label style={{ width: 96, height: 96, borderRadius: 8, border: "1px dashed var(--border-strong, var(--border-default))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
              {subiendo ? <IconLoader2 size={18} className="animate-spin" aria-hidden /> : <IconPhotoPlus size={18} aria-hidden />}
              {subiendo ? "Subiendo…" : "Agregar"}
              <input type="file" accept="image/*" multiple hidden disabled={subiendo} onChange={e => { agregarFotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </section>

      {categoria?.animales && (
        <section style={tarjeta}>
          <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <input type="checkbox" checked={d.declaracionSanitaria} onChange={e => set("declaracionSanitaria", e.target.checked)} style={{ marginTop: 3 }} />
            Declaro que entrego los animales con la documentación sanitaria de traslado exigida por SENACSA, y que soy responsable de su estado sanitario.
          </label>
        </section>
      )}

      {error && <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</div>}
      {aviso && <div role="status" style={{ fontSize: 13, color: "var(--warning-text)" }}>{aviso}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary" style={{ height: 38 }} disabled={pendiente || subiendo} onClick={() => guardar(true)}>
          {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} {d.estado === "ACTIVA" ? "Guardar cambios" : "Publicar"}
        </button>
        <button type="button" className="btn" style={{ height: 38 }} disabled={pendiente || subiendo} onClick={() => guardar(false)}>
          {d.estado === "ACTIVA" ? "Guardar y pausar" : "Guardar borrador"}
        </button>
        {!verificada && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Hasta que tu tienda esté verificada, queda en borrador.</span>}
      </div>
    </div>
  );
}

function Proponer({ categorias, alCrear }: { categorias: Categoria[]; alCrear: (p: Producto) => void }) {
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidad, setUnidad] = useState<UnidadBase>("KG");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div style={{ marginTop: 8, padding: 12, border: "0.5px solid var(--border-default)", borderRadius: 8, display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 8, alignItems: "end" }}>
      <label style={etiqueta}>Producto<input className="kp-input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} /></label>
      <label style={etiqueta}>Categoría
        <select className="kp-input" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}><option value="">Elegí…</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </label>
      <label style={etiqueta}>Unidad
        <select className="kp-input" value={unidad} onChange={e => setUnidad(e.target.value as UnidadBase)}>{UNIDADES.map(u => <option key={u} value={u}>{UNIDAD_CORTA[u]}</option>)}</select>
      </label>
      <button type="button" className="btn" style={{ height: 34 }} disabled={pendiente}
        onClick={() => iniciar(async () => { const r = await proponerProducto({ nombre, categoriaId, unidadBase: unidad }); if (r.ok) alCrear({ id: r.id, codigo: "propuesto", nombre, categoriaId, unidadBase: unidad, requiereReceta: false, aprobado: false }); else setError(r.error); })}>
        Proponer
      </button>
      {error && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
      <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "var(--text-muted)" }}>Lo podés usar ya; el equipo de KurPorc lo revisa para sumarlo al catálogo de todos.</div>
    </div>
  );
}

export function CambiarEstado({ id, estado }: { id: string; estado: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const destino = estado === "ACTIVA" ? "PAUSADA" : "ACTIVA";
  return (
    <>
      <button type="button" className="btn" style={{ height: 26, fontSize: 11.5 }} disabled={pendiente}
        onClick={() => iniciar(async () => { const r = await cambiarEstadoPublicacion(id, destino); if (!r.ok) setMsg(r.error); else if (r.aviso) setMsg(r.aviso); else router.refresh(); })}>
        {destino === "PAUSADA" ? "Pausar" : "Activar"}
      </button>
      {msg && <span style={{ fontSize: 11, color: "var(--warning-text)", whiteSpace: "normal", maxWidth: 240 }}>{msg}</span>}
    </>
  );
}
