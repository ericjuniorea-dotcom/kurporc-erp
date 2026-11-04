"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconAlertTriangle, IconShoppingCart } from "@tabler/icons-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { AnalisisGallery, RecomendacionesPanel, type GalleryCard, type Recomendacion } from "@/components/shared/analisis-gallery";

const TOOLTIP_STYLE = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: 8, fontSize: 11, color: "var(--text-primary)",
};

const CATEGORIA_LABEL: Record<string, string> = {
  VACUNA: "Vacuna", SUPLEMENTO: "Suplemento", MEDICAMENTO: "Medicamento",
  MATERIA_PRIMA: "Materia prima", BALANCEADO: "Balanceado", EQUIPAMIENTO: "Equipamiento",
};

function fmtGs(v: number) { return `₲ ${Math.round(v).toLocaleString("es-PY")}`; }

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
      <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function useLogisticaAnalisis() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/logistica/analisis")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { data, loading };
}

// Si el padre ya tiene el inventario cargado (caso normal en /logistica) lo
// recibe por prop y evita repetir la consulta — cada golpe extra a la base
// suma ~800ms-1s solo por la latencia de red al reponerlo desde cero.
function useInventario(preloaded?: any[]) {
  const [data, setData]       = useState<any[] | null>(preloaded ?? null);
  const [loading, setLoading] = useState(!preloaded);
  useEffect(() => {
    if (preloaded) { setData(preloaded); setLoading(false); return; }
    fetch("/api/logistica/inventario")
      .then(r => r.ok ? r.json() : [])
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [preloaded]);
  return { data, loading };
}

// ═══ ANÁLISIS 1 — Forecast de stock crítico ═══════════════════════════════════
function ForecastStock({ onBack: _, onComprar, stock }: { onBack: () => void; onComprar?: (productoId: string) => void; stock?: any[] }) {
  const { data, loading } = useInventario(stock);

  function recs(): Recomendacion[] {
    if (!data) return [];
    const criticos = data.filter(p => p.alertaStock);
    if (criticos.length === 0) {
      return [{ nivel: "success", titulo: "Sin productos en stock crítico", descripcion: "Todo el inventario (vacunas, suplementos, medicamentos, materia prima y balanceado) está dentro de los niveles esperados. ✓" }];
    }
    const urgentes = criticos.filter(p => p.diasHastaAgotamiento != null && p.diasHastaAgotamiento < 3);
    const r: Recomendacion[] = [];
    if (urgentes.length > 0) {
      r.push({ nivel: "danger", titulo: `${urgentes.length} producto${urgentes.length > 1 ? "s" : ""} con menos de 3 días de stock`, descripcion: `${urgentes.slice(0, 5).map((u: any) => u.nombre).join(", ")}.`, accion: "Registrá la compra ahora mismo desde el botón «Comprar» de cada fila, o revisá si se puede producir en Balanceado." });
    }
    r.push({ nivel: "warning", titulo: `${criticos.length} producto${criticos.length > 1 ? "s" : ""} en stock crítico en total`, descripcion: "Incluye tanto productos por debajo del mínimo configurado como productos sin stock suficiente para la demanda ya programada." });
    return r;
  }

  if (loading) return <Spinner />;
  const criticos = (data ?? []).filter(p => p.alertaStock).sort((a, b) => (a.diasHastaAgotamiento ?? 999) - (b.diasHastaAgotamiento ?? 999));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {criticos.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin productos en stock crítico</div>
      ) : (
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <table className="kp-table">
            <thead>
              <tr>
                <th>Producto</th><th>Categoría</th>
                <th style={{ textAlign: "right" }}>Stock</th>
                <th style={{ textAlign: "right" }}>Falta</th>
                <th style={{ textAlign: "right" }}>Días restantes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {criticos.map((p: any) => {
                const dias = p.diasHastaAgotamiento;
                const diasColor = dias == null ? "var(--text-muted)" : dias < 3 ? "var(--danger)" : dias < 7 ? "var(--warning)" : "var(--success)";
                return (
                  <tr key={p.productoId}>
                    <td style={{ fontWeight: 500 }}>{p.codigo && `${p.codigo} — `}{p.nombre}</td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{CATEGORIA_LABEL[p.categoria] ?? p.categoria}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.stockNoVencido} {p.unidadMedida === "KG" ? "kg" : ""}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{Math.round(p.faltante)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: diasColor, fontVariantNumeric: "tabular-nums" }}>{dias ?? "—"}</td>
                    <td>
                      {onComprar && (
                        <button className="btn btn-primary" style={{ height: 24, fontSize: 10, padding: "0 8px" }} onClick={() => onComprar(p.productoId)}>
                          <IconShoppingCart size={11} /> Comprar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 2 — Costos ══════════════════════════════════════════════════════
function CostosPanel({ onBack: _ }: { onBack: () => void }) {
  const { data, loading } = useLogisticaAnalisis();

  function recs(): Recomendacion[] {
    if (!data?.costos?.length) return [{ nivel: "info", titulo: "Sin costos cargados todavía", descripcion: "Cargá el «Costo unitario» al registrar una compra o un lote para poder ver cuánto te sale cada producto." }];
    const top = data.costos[0];
    return [{ nivel: "info", titulo: `${top.nombre} concentra el mayor valor en stock`, descripcion: `${fmtGs(top.valorInvertido)} invertidos en ${top.stockNoVencido} ${top.unidadMedida === "KG" ? "kg" : "unidades"} disponibles.` }];
  }

  if (loading) return <Spinner />;
  const costos: any[] = data?.costos ?? [];
  const max = Math.max(1, ...costos.map(c => c.valorInvertido));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Valor total invertido en stock</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{fmtGs(data?.valorTotalInventario ?? 0)}</div>
      </div>

      {costos.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin costos unitarios cargados — completá «Costo unitario» al registrar una compra.</div>
      ) : (
        <ChartPanel title="Cuánto sale cada producto" subtitle="Costo unitario promedio × stock actual, de mayor a menor">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {costos.slice(0, 15).map(c => (
              <div key={c.productoId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 170, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  {c.codigo && <span style={{ fontFamily: "monospace", fontSize: 9, color: "var(--accent)" }}>{c.codigo}</span>}
                  {c.nombre}
                </span>
                <div style={{ flex: 1, height: 10, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.valorInvertido / max) * 100}%`, background: "var(--warning)", borderRadius: 99, transition: "width 0.6s" }} />
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 90, textAlign: "right" }}>{fmtGs(c.costoUnitarioPromedio)}/u</span>
                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 90, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{fmtGs(c.valorInvertido)}</span>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 3 — Balanceado: comprado vs. producido ══════════════════════════
function BalanceadoOrigen({ onBack: _ }: { onBack: () => void }) {
  const { data, loading } = useLogisticaAnalisis();

  function recs(): Recomendacion[] {
    const rows: any[] = data?.balanceadoOrigen ?? [];
    if (rows.length === 0) return [{ nivel: "info", titulo: "Sin movimientos de balanceado todavía", descripcion: "El balanceado se repone de dos formas: comprándolo ya hecho (Logística → Registrar compra) o produciéndolo en planta (Balanceado → Producción). Acá vas a ver cuánto vino de cada vía." }];
    const totalComprado  = rows.reduce((s, r) => s + r.comprado, 0);
    const totalProducido = rows.reduce((s, r) => s + r.producido, 0);
    const total = totalComprado + totalProducido;
    if (total === 0) return [];
    const pctProducido = Math.round((totalProducido / total) * 100);
    return [{ nivel: "info", titulo: `${pctProducido}% del balanceado vino de producción propia`, descripcion: `Comprado: ${totalComprado.toLocaleString("es-PY")} kg · Producido en planta: ${totalProducido.toLocaleString("es-PY")} kg.` }];
  }

  if (loading) return <Spinner />;
  const rows: any[] = data?.balanceadoOrigen ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--info-subtle)", border: "0.5px solid var(--info-border)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 11, color: "var(--info-text)" }}>
        El balanceado se repone de dos maneras: <strong>comprado</strong> (proveedor externo, se carga acá en Logística) o <strong>producido</strong> (planta propia, se carga en Balanceado → Producción). Ambas caminos suman al mismo stock — este panel muestra de dónde vino cada kilo.
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin movimientos de entrada de balanceado en el período</div>
      ) : (
        <ChartPanel title="Kg de balanceado por origen">
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 50)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={160} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toLocaleString("es-PY")} kg`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="comprado" name="Comprado" fill="var(--info)" radius={[0, 3, 3, 0]} />
              <Bar dataKey="producido" name="Producido" fill="var(--success)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 4 — Tendencia de movimientos ════════════════════════════════════
function TendenciaMovimientos({ onBack: _ }: { onBack: () => void }) {
  const { data, loading } = useLogisticaAnalisis();

  if (loading) return <Spinner />;
  const tendencia: any[] = data?.movimientosTendencia ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {tendencia.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin movimientos en el período</div>
      ) : (
        <ChartPanel title="Movimientos de inventario por semana" subtitle="Cantidad de entradas y salidas registradas (todas las categorías)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tendencia} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="semana" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" name="Entradas" fill="var(--success)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="salidas" name="Salidas" fill="var(--danger)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}
    </div>
  );
}

// ─── Galería ───────────────────────────────────────────────────────────────────
export function CentralAnalisisLogistica({ onComprar, stock }: { onComprar?: (productoId: string) => void; stock?: any[] }) {
  const CARDS: GalleryCard[] = [
    {
      id: "forecast",
      titulo: "Forecast de stock crítico",
      descripcion: "Qué producto falta, cuánto falta y cuántos días de stock quedan, en las 6 categorías. Registrá la compra directo desde acá.",
      tags: ["Forecast", "Stock", "Compra"],
      categoria: "desempeño",
      color: "var(--danger)",
      component: (p) => <ForecastStock {...p} onComprar={onComprar} stock={stock} />,
    },
    {
      id: "costos",
      titulo: "Costos",
      descripcion: "Cuánto sale cada vacuna, medicamento o insumo que suministrás, y cuánto tenés invertido en stock en este momento.",
      tags: ["Costos", "Valor invertido", "₲"],
      categoria: "analisis",
      color: "var(--warning)",
      component: CostosPanel,
    },
    {
      id: "balanceado",
      titulo: "Balanceado: comprado vs. producido",
      descripcion: "El balanceado se repone comprándolo externo o produciéndolo en planta — vea de dónde vino cada kilo.",
      tags: ["Balanceado", "Producción", "Compra"],
      categoria: "analisis",
      color: "var(--info)",
      component: BalanceadoOrigen,
    },
    {
      id: "movimientos",
      titulo: "Tendencia de movimientos",
      descripcion: "Entradas y salidas de inventario por semana, en todas las categorías — para presentar en una reunión de equipo.",
      tags: ["Movimientos", "Tendencia", "Auditoría"],
      categoria: "listado",
      color: "var(--accent)",
      component: TendenciaMovimientos,
    },
  ];

  return <AnalisisGallery cards={CARDS} />;
}
