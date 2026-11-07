"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth/sesion-cliente";
import {
  IconShoppingCart, IconSearch, IconPlus, IconFileText,
  IconLoader2, IconPackage, IconCheck, IconAlertCircle,
  IconX, IconBuildingStore, IconShoppingBag,
} from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

/* ─── Tipos ──────────────────────────────────────────────────── */

interface Vendor {
  id: string; empresaNombre: string; ciudad?: string; logoUrl?: string; descripcion?: string;
  _count: { productos: number };
}

interface Producto {
  id: string; vendorId: string; nombreProducto: string; categoria: string;
  descripcion?: string; principioActivo?: string; enfermedadObjetivo?: string;
  viaAplicacion?: string; dosisMl?: string; presentacion?: string;
  stockDisponible: number; unidadMedida: string; precioGs: string;
  fichaTecnicaUrl?: string; paisProcedencia?: string; requiereReceta: boolean;
  vendor: { id: string; empresaNombre: string; logoUrl?: string; ciudad?: string };
}

interface CartItem { producto: Producto; cantidad: number; }

const CAT_LABELS: Record<string, string> = {
  VACUNA: "💉 Vacunas", MEDICAMENTO: "💊 Medicamentos", INSUMO: "🔧 Insumos",
  ALIMENTO: "🌾 Alimentos", EQUIPAMIENTO: "⚙️ Equipamiento", OTRO: "📦 Otros",
};

function fmtGs(v: string | number) {
  return `₲ ${Number(v).toLocaleString("es-PY")}`;
}

/* ─── Página ─────────────────────────────────────────────────── */

export default function MarketplacePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [loading,    setLoading]    = useState(true);
  // Precargados desde la URL (?categoria=&q=) — para llegar acá con un enlace
  // directo desde una alerta de stock crítico en otro módulo (Sanidad, etc.)
  const [search,     setSearch]     = useState(() => searchParams.get("q") ?? "");
  const [categoria,  setCategoria]  = useState(() => searchParams.get("categoria") ?? "ALL");
  const [vendorFilt, setVendorFilt] = useState("ALL");
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [showCart,   setShowCart]   = useState(false);
  const [showFicha,  setShowFicha]  = useState<Producto | null>(null);
  const [ordering,   setOrdering]   = useState(false);
  const [orderDone,  setOrderDone]  = useState(false);
  const [activeView, setActiveView] = useState<"catalogo" | "pedidos">("catalogo");
  const [pedidos,    setPedidos]    = useState<unknown[]>([]);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [vendorForm, setVendorForm] = useState({ empresaNombre: "", ruc: "", contactoNombre: "", email: "", telefono: "", ciudad: "", descripcion: "" });
  const [productForm, setProductForm] = useState({ vendorId: "", nombreProducto: "", categoria: "VACUNA", principioActivo: "", enfermedadObjetivo: "", viaAplicacion: "IM", dosisMl: "", presentacion: "", stockDisponible: "", precioGs: "", paisProcedencia: "", fichaTecnicaUrl: "", descripcion: "", requiereReceta: false });

  const isAdmin = session?.user?.roles?.some((r: number) => [1, 2].includes(r)) ?? false;

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [vRes, pRes] = await Promise.all([
      fetch("/api/marketplace/vendors"),
      fetch("/api/marketplace/productos"),
    ]);
    if (vRes.ok) setVendors(await vRes.json());
    if (pRes.ok) setProductos(await pRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadPedidos() {
    const r = await fetch("/api/marketplace/pedidos");
    if (r.ok) setPedidos(await r.json());
  }

  useEffect(() => {
    if (activeView === "pedidos") loadPedidos();
  }, [activeView]);

  function addToCart(p: Producto) {
    setCart(prev => {
      const ex = prev.find(i => i.producto.id === p.id);
      if (ex) return prev.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { producto: p, cantidad: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.producto.id !== id));
  }

  function changeQty(id: string, delta: number) {
    setCart(prev => prev
      .map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
    );
  }

  const cartTotal = cart.reduce((s, i) => s + Number(i.producto.precioGs) * i.cantidad, 0);
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0);

  async function placeOrder() {
    if (cart.length === 0) return;
    setOrdering(true);
    const r = await fetch("/api/marketplace/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })) }),
    });
    setOrdering(false);
    if (r.ok) { setCart([]); setShowCart(false); setOrderDone(true); setTimeout(() => setOrderDone(false), 4000); }
  }

  async function saveVendor() {
    if (!vendorForm.empresaNombre) { alert("Nombre de empresa requerido"); return; }
    setSavingForm(true);
    const r = await fetch("/api/marketplace/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vendorForm) });
    setSavingForm(false);
    if (r.ok) { setShowVendorForm(false); setVendorForm({ empresaNombre: "", ruc: "", contactoNombre: "", email: "", telefono: "", ciudad: "", descripcion: "" }); loadAll(); }
    else { const e = await r.json(); alert(e.error ?? "Error"); }
  }

  async function saveProducto() {
    const { vendorId, nombreProducto, categoria: cat, precioGs } = productForm;
    if (!vendorId || !nombreProducto || !cat || !precioGs) { alert("Completá los campos obligatorios"); return; }
    setSavingForm(true);
    const r = await fetch("/api/marketplace/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...productForm, dosisMl: productForm.dosisMl ? Number(productForm.dosisMl) : null, stockDisponible: Number(productForm.stockDisponible) || 0, precioGs: Number(productForm.precioGs) }),
    });
    setSavingForm(false);
    if (r.ok) { setShowProductForm(false); loadAll(); }
    else { const e = await r.json(); alert(e.error ?? "Error"); }
  }

  // Filtrado
  const filtered = productos.filter(p => {
    if (vendorFilt !== "ALL" && p.vendorId !== vendorFilt) return false;
    if (categoria !== "ALL" && p.categoria !== categoria) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.nombreProducto.toLowerCase().includes(s) ||
        (p.principioActivo ?? "").toLowerCase().includes(s) ||
        (p.enfermedadObjetivo ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  function Spinner() { return <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} />; }

  return (
    <>
      <Topbar
        title="Mercado de Insumos"
        icon={IconBuildingStore}
        iconColor="var(--accent)"
        tabs={[
          { key: "catalogo", label: "Catálogo" },
          { key: "pedidos",  label: "Mis pedidos" },
        ]}
        activeTab={activeView}
        onTabChange={v => setActiveView(v as typeof activeView)}
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {isAdmin && (
              <>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => setShowVendorForm(true)}>
                  <IconBuildingStore size={12} /> Nuevo proveedor
                </button>
                {vendors.length > 0 && (
                  <button className="btn" style={{ fontSize: 11 }} onClick={() => setShowProductForm(true)}>
                    <IconPackage size={12} /> Agregar producto
                  </button>
                )}
              </>
            )}
            <button
              className="btn btn-primary"
              style={{ position: "relative" }}
              onClick={() => setShowCart(true)}
              disabled={cart.length === 0}
            >
              <IconShoppingCart size={13} />
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "var(--danger)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
              Carrito
            </button>
          </div>
        }
      />

      <div style={{ padding: "16px 20px" }}>
        {orderDone && (
          <div className="kp-alert kp-alert-ok" style={{ marginBottom: 12 }}>
            <IconCheck size={13} /> Pedido enviado correctamente. El proveedor lo confirmará a la brevedad.
          </div>
        )}

        {activeView === "catalogo" ? (
          <>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <IconSearch size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  className="kp-input"
                  placeholder="Buscar por producto, principio activo, enfermedad…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 28, fontSize: 12 }}
                />
              </div>
              <select className="kp-input" value={categoria} onChange={e => setCategoria(e.target.value)} style={{ width: 160, fontSize: 12, appearance: "auto" }}>
                <option value="ALL">Todas las categorías</option>
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="kp-input" value={vendorFilt} onChange={e => setVendorFilt(e.target.value)} style={{ width: 180, fontSize: 12, appearance: "auto" }}>
                <option value="ALL">Todos los proveedores</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.empresaNombre}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40, color: "var(--text-muted)" }}><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
                <IconShoppingBag size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No hay productos disponibles</div>
                {isAdmin && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Agregá un proveedor y luego cargá sus productos</div>}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filtered.map(p => {
                  const inCart = cart.find(i => i.producto.id === p.id);
                  return (
                    <div key={p.id} className="panel" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span className={`badge ${p.categoria === "VACUNA" ? "badge-info" : p.categoria === "MEDICAMENTO" ? "badge-warn" : "badge"}`} style={{ fontSize: 10 }}>
                          {CAT_LABELS[p.categoria] ?? p.categoria}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.vendor.empresaNombre}</span>
                      </div>

                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3 }}>{p.nombreProducto}</div>
                        {p.principioActivo && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.principioActivo}</div>}
                      </div>

                      {p.enfermedadObjetivo && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: "4px 8px" }}>
                          Contra: <strong>{p.enfermedadObjetivo}</strong>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {p.viaAplicacion  && <span className="badge badge-mat" style={{ fontSize: 10 }}>{p.viaAplicacion}</span>}
                        {p.presentacion   && <span className="badge" style={{ fontSize: 10 }}>{p.presentacion}</span>}
                        {p.paisProcedencia && <span className="badge" style={{ fontSize: 10 }}>🌍 {p.paisProcedencia}</span>}
                        {p.requiereReceta && <span className="badge badge-warn" style={{ fontSize: 10 }}>Receta</span>}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--accent)" }}>{fmtGs(p.precioGs)}</div>
                          <div style={{ fontSize: 10, color: p.stockDisponible > 0 ? "var(--success)" : "var(--danger)" }}>
                            {p.stockDisponible > 0 ? `${p.stockDisponible} ${p.unidadMedida}s disponibles` : "Sin stock"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {p.fichaTecnicaUrl && (
                            <a href={p.fichaTecnicaUrl} target="_blank" rel="noopener noreferrer" title="Ver ficha técnica"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)", color: "var(--accent)", textDecoration: "none" }}
                            >
                              <IconFileText size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => p.stockDisponible > 0 && addToCart(p)}
                            disabled={p.stockDisponible === 0}
                            className={inCart ? "btn btn-primary" : "btn"}
                            style={{ height: 30, fontSize: 11, padding: "0 10px" }}
                          >
                            {inCart ? <><IconCheck size={12} /> En carrito ({inCart.cantidad})</> : <><IconShoppingCart size={12} /> Agregar</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Mis pedidos */
          <div>
            {(pedidos as never[]).length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
                <IconShoppingBag size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No tenés pedidos aún</div>
              </div>
            ) : (
              <table className="kp-table">
                <thead><tr><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {(pedidos as Record<string, unknown>[]).map((p) => (
                    <tr key={String(p.id)}>
                      <td style={{ fontWeight: 500 }}>{String((p.vendor as Record<string,unknown>)?.empresaNombre ?? "")}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{(p.items as unknown[]).length} productos</td>
                      <td style={{ color: "var(--accent)", fontWeight: 500 }}>{fmtGs(String(p.totalGs))}</td>
                      <td><span className={`badge ${p.estado === "ENTREGADO" ? "badge-ok" : p.estado === "CANCELADO" ? "badge-danger" : "badge-warn"}`}>{String(p.estado)}</span></td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(String(p.createdAt)).toLocaleDateString("es-PY")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal carrito */}
      {showCart && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCart(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 520, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}><IconShoppingCart size={14} /> Carrito ({cartCount} {cartCount === 1 ? "item" : "items"})</h2>
              <button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {cart.map(item => (
                <div key={item.producto.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-default)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{item.producto.nombreProducto}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.producto.vendor.empresaNombre} · {fmtGs(item.producto.precioGs)} / {item.producto.unidadMedida}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => changeQty(item.producto.id, -1)} style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 24, textAlign: "center" }}>{item.cantidad}</span>
                    <button onClick={() => changeQty(item.producto.id, 1)} style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <div style={{ fontWeight: 500, color: "var(--accent)", minWidth: 90, textAlign: "right", fontSize: 12 }}>
                    {fmtGs(Number(item.producto.precioGs) * item.cantidad)}
                  </div>
                  <button onClick={() => removeFromCart(item.producto.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={13} /></button>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "0.5px solid var(--border-default)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total del pedido</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: "var(--accent)" }}>{fmtGs(cartTotal)}</span>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={placeOrder} disabled={ordering}>
                {ordering ? <Spinner /> : <IconShoppingCart size={13} />}
                {ordering ? "Enviando pedido…" : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ficha técnica rápida */}
      {showFicha && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowFicha(null)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{showFicha.nombreProducto}</h2>
              <button onClick={() => setShowFicha(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {showFicha.principioActivo   && <div><strong>Principio activo:</strong> {showFicha.principioActivo}</div>}
              {showFicha.enfermedadObjetivo && <div><strong>Contra:</strong> {showFicha.enfermedadObjetivo}</div>}
              {showFicha.viaAplicacion     && <div><strong>Vía:</strong> {showFicha.viaAplicacion}</div>}
              {showFicha.dosisMl           && <div><strong>Dosis:</strong> {showFicha.dosisMl} ml</div>}
              {showFicha.presentacion      && <div><strong>Presentación:</strong> {showFicha.presentacion}</div>}
              {showFicha.paisProcedencia   && <div><strong>País de origen:</strong> {showFicha.paisProcedencia}</div>}
              {showFicha.descripcion       && <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{showFicha.descripcion}</div>}
              {showFicha.fichaTecnicaUrl && (
                <a href={showFicha.fichaTecnicaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: "none", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconFileText size={13} /> Ver ficha técnica completa (PDF)
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo proveedor */}
      {showVendorForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowVendorForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Registrar proveedor</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label className="kp-label">Empresa *</label><input className="kp-input" value={vendorForm.empresaNombre} onChange={e => setVendorForm(p => ({ ...p, empresaNombre: e.target.value }))} placeholder="Ej: Covepa, Ysaka…" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">RUC</label><input className="kp-input" value={vendorForm.ruc} onChange={e => setVendorForm(p => ({ ...p, ruc: e.target.value }))} /></div>
                <div><label className="kp-label">Ciudad</label><input className="kp-input" value={vendorForm.ciudad} onChange={e => setVendorForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Contacto</label><input className="kp-input" value={vendorForm.contactoNombre} onChange={e => setVendorForm(p => ({ ...p, contactoNombre: e.target.value }))} /></div>
                <div><label className="kp-label">Teléfono</label><input className="kp-input" value={vendorForm.telefono} onChange={e => setVendorForm(p => ({ ...p, telefono: e.target.value }))} /></div>
              </div>
              <div><label className="kp-label">Email</label><input className="kp-input" type="email" value={vendorForm.email} onChange={e => setVendorForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="kp-label">Descripción</label><textarea className="kp-input" rows={2} value={vendorForm.descripcion} onChange={e => setVendorForm(p => ({ ...p, descripcion: e.target.value }))} style={{ height: "auto", paddingTop: 8 }} /></div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowVendorForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveVendor} disabled={savingForm}>{savingForm ? <Spinner /> : "Guardar proveedor"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo producto */}
      {showProductForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowProductForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Agregar producto al marketplace</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Proveedor *</label>
                  <select className="kp-input" value={productForm.vendorId} onChange={e => setProductForm(p => ({ ...p, vendorId: e.target.value }))} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.empresaNombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Categoría *</label>
                  <select className="kp-input" value={productForm.categoria} onChange={e => setProductForm(p => ({ ...p, categoria: e.target.value }))} style={{ appearance: "auto" }}>
                    {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="kp-label">Nombre del producto *</label><input className="kp-input" value={productForm.nombreProducto} onChange={e => setProductForm(p => ({ ...p, nombreProducto: e.target.value }))} placeholder="Ej: Ingelvac CircoFLEX" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Principio activo</label><input className="kp-input" value={productForm.principioActivo} onChange={e => setProductForm(p => ({ ...p, principioActivo: e.target.value }))} /></div>
                <div><label className="kp-label">Contra qué enfermedad actúa</label><input className="kp-input" value={productForm.enfermedadObjetivo} onChange={e => setProductForm(p => ({ ...p, enfermedadObjetivo: e.target.value }))} placeholder="Ej: PCV2, Parvo…" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Vía aplicación</label><select className="kp-input" value={productForm.viaAplicacion} onChange={e => setProductForm(p => ({ ...p, viaAplicacion: e.target.value }))} style={{ appearance: "auto" }}><option value="IM">IM</option><option value="SC">SC</option><option value="IV">IV</option><option value="ORAL">Oral</option><option value="INTRANASAL">Intranasal</option><option value="">N/A</option></select></div>
                <div><label className="kp-label">Dosis (ml)</label><input className="kp-input" type="number" step="0.1" value={productForm.dosisMl} onChange={e => setProductForm(p => ({ ...p, dosisMl: e.target.value }))} /></div>
                <div><label className="kp-label">Presentación</label><input className="kp-input" value={productForm.presentacion} onChange={e => setProductForm(p => ({ ...p, presentacion: e.target.value }))} placeholder="50ml/vial" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Precio (₲) *</label><input className="kp-input" type="number" value={productForm.precioGs} onChange={e => setProductForm(p => ({ ...p, precioGs: e.target.value }))} placeholder="Ej: 180000" /></div>
                <div><label className="kp-label">Stock disponible</label><input className="kp-input" type="number" min="0" value={productForm.stockDisponible} onChange={e => setProductForm(p => ({ ...p, stockDisponible: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">País procedencia</label><input className="kp-input" value={productForm.paisProcedencia} onChange={e => setProductForm(p => ({ ...p, paisProcedencia: e.target.value }))} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
                  <input id="req-receta" type="checkbox" checked={productForm.requiereReceta} onChange={e => setProductForm(p => ({ ...p, requiereReceta: e.target.checked }))} style={{ width: 14, height: 14 }} />
                  <label htmlFor="req-receta" style={{ fontSize: 12, color: "var(--text-secondary)" }}>Requiere receta</label>
                </div>
              </div>
              <div><label className="kp-label">URL Ficha Técnica</label><input className="kp-input" type="url" value={productForm.fichaTecnicaUrl} onChange={e => setProductForm(p => ({ ...p, fichaTecnicaUrl: e.target.value }))} placeholder="https://…" /></div>
              <div><label className="kp-label">Descripción</label><textarea className="kp-input" rows={2} value={productForm.descripcion} onChange={e => setProductForm(p => ({ ...p, descripcion: e.target.value }))} style={{ height: "auto", paddingTop: 8 }} /></div>
              <div className="kp-alert kp-alert-info" style={{ fontSize: 11 }}>
                <IconAlertCircle size={12} /> Los productos con ficha técnica cargada generan mayor confianza para los compradores.
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowProductForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveProducto} disabled={savingForm}>{savingForm ? <Spinner /> : "Publicar producto"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
