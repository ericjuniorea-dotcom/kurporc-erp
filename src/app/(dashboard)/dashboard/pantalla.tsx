"use client";
// Dashboard · «¿Cómo amaneció la granja?». Primero lo que necesita acción, después cuántos animales hay en cada fase
// y dónde se pierden, y todos los indicadores contra la meta (12 meses + últimos 3). El detalle se investiga en
// el Análisis de cada módulo. Fórmulas y textos: src/lib/indicadores/catalogo.ts.
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconLayoutDashboard, IconRefresh, IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconCircleCheck,
  IconChevronRight, IconArrowUpRight, IconArrowDownRight, IconMinus, IconArrowRight, IconLoader2,
} from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";
import { AyudaIndicador, ComoSeCalcula } from "@/components/indicadores/ayuda";
import { INDICADORES, formatear, type ClaveIndicador, type Estado, type GrupoIndicador } from "@/lib/indicadores/catalogo";
import type { FilaIndicador, TableroGranja } from "@/lib/indicadores/granja";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const rotulo: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" };
const num: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

const ESTADO: Record<Estado, { texto: string; clase: string; color: string }> = {
  EN_META: { texto: "En meta", clase: "badge badge-ok", color: "var(--success)" },
  ATENCION: { texto: "Atención", clase: "badge badge-warn", color: "var(--warning)" },
  FUERA: { texto: "Fuera", clase: "badge badge-danger", color: "var(--danger)" },
  SIN_DATO: { texto: "Sin dato", clase: "badge", color: "var(--text-muted)" },
};
const ANALISIS: Partial<Record<GrupoIndicador, string>> = {
  Reproducción: "/gestacion?tab=analisis", Maternidad: "/maternidad?tab=analisis", Iniciación: "/recria", Engorde: "/engorde?tab=analisis",
};

function Chip({ estado }: { estado: Estado }) {
  return <span className={ESTADO[estado].clase} style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>{ESTADO[estado].texto}</span>;
}

/** Flecha del último trimestre: hacia dónde se movió el número; verde si mejora, rojo si empeora. */
function Tendencia({ f }: { f: FilaIndicador }) {
  if (!f.tendencia || f.reciente == null || f.anual == null) return null;
  const sube = f.reciente > f.anual;
  const color = f.tendencia === "mejora" ? "var(--success-text)" : f.tendencia === "empeora" ? "var(--danger-text)" : "var(--text-muted)";
  const Icono = f.tendencia === "estable" ? IconMinus : sube ? IconArrowUpRight : IconArrowDownRight;
  const texto = f.tendencia === "mejora" ? "mejorando" : f.tendencia === "empeora" ? "empeorando" : "estable";
  return <span title={`Últimos 3 meses: ${texto}`} style={{ display: "inline-flex", verticalAlign: "-2px" }}><Icono size={14} style={{ color }} aria-label={texto} /></span>;
}

const fila = (t: TableroGranja, c: ClaveIndicador) => t.indicadores.find(f => f.clave === c)!;
const fmt = (c: ClaveIndicador, v: number | null) => formatear(v, INDICADORES[c]);
const simbolo = (c: ClaveIndicador) => ("sentido" in INDICADORES[c] && INDICADORES[c].sentido === "menor" ? "≤" : "≥");
const distancia = (d: number | null) => d == null ? "—" : `${d > 0 ? "+" : ""}${Math.round(d * 100)}%`;

export default function DashboardPage({ datos }: { datos: TableroGranja }) {
  const router = useRouter();
  const [actualizando, iniciar] = useTransition();
  const t = datos;
  const hora = new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t.generado));

  return (
    <>
      <Topbar title="Dashboard" icon={IconLayoutDashboard} iconColor="var(--accent)"
        actions={
          <button className="btn" onClick={() => iniciar(() => router.refresh())} disabled={actualizando} title="Actualizar">
            {actualizando ? <IconLoader2 size={13} className="animate-spin" aria-hidden /> : <IconRefresh size={13} aria-hidden />} Actualizar
          </button>
        } />

      <div style={{ padding: "16px 20px 28px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>¿Cómo amaneció la granja?</h2>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Últimos 12 meses y últimos 3 · semáforo contra tus metas · actualizado {hora}</span>
        </div>

        <Avisos t={t} />
        <Flujo t={t} />
        <DondeSePierden t={t} />
        <TablaIndicadores t={t} />
        <EventosYActividad t={t} />

        <ComoSeCalcula claves={[
          ...t.indicadores.map(f => f.clave),
          "madres_activas", "lechones_maternidad", "lechones_iniciacion", "cerdos_engorde", "total_lechones",
          "proximo_parto", "proximo_destete", "servicios_mes", "partos_mes", "destetados_30d", "bajas_mes", "gestacion_real",
        ]} />
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
          Distancia a la meta = valor ÷ meta − 1 (en mortalidad, repetición, intervalo y lactancia, donde menos es mejor: meta ÷ valor − 1).
          En meta = cumple · Atención = a menos del 10% · Fuera = más lejos. La flecha compara los últimos 3 meses contra los 12.
          Las metas se cambian en <Link href="/configuracion?modulo=GESTACION&tab=Metas" style={{ color: "inherit" }}>Configuración → Metas</Link>.
        </p>
      </div>
    </>
  );
}

/* ── 1. Avisos ─────────────────────────────────────────────── */
function Avisos({ t }: { t: TableroGranja }) {
  if (t.avisos.length === 0) return (
    <div className="kp-alert kp-alert-ok" style={{ fontSize: 13 }}><IconCircleCheck size={15} aria-hidden /> Todo en meta. No hay nada urgente hoy.</div>
  );
  const icono = { critico: IconAlertTriangle, atencion: IconAlertCircle, info: IconInfoCircle };
  const color = { critico: "var(--danger)", atencion: "var(--warning)", info: "var(--info)" };
  return (
    <section style={{ ...tarjeta, overflow: "hidden" }} aria-labelledby="avisos-t">
      <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 8, alignItems: "center" }}>
        <h3 id="avisos-t" style={{ ...rotulo, margin: 0, color: "var(--text-secondary)" }}>Hoy prestá atención a</h3>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {t.avisos.map((a, i) => {
          const I = icono[a.nivel];
          return (
            <li key={i} style={{ borderTop: i ? "0.5px solid var(--border-default)" : "none" }}>
              <Link href={a.href} className="kp-fila-link" style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", textDecoration: "none", color: "var(--text-primary)", fontSize: 13 }}>
                <I size={16} style={{ color: color[a.nivel], flexShrink: 0 }} aria-label={a.nivel === "critico" ? "Fuera de meta" : a.nivel === "atencion" ? "Atención" : "Aviso"} />
                <span style={{ flex: 1, minWidth: 0 }}>{a.texto}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>
                  {a.clave ? "Investigar" : "Ver"} <IconChevronRight size={13} aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── 2. Flujo de animales ──────────────────────────────────── */
function Flujo({ t }: { t: TableroGranja }) {
  const inv = t.inventario;
  const etapas: { titulo: string; clave: ClaveIndicador; valor: number; unidad: string; detalle: string[]; mort?: ClaveIndicador; href: string; color: string }[] = [
    { titulo: "Plantel", clave: "madres_activas", valor: inv.madres, unidad: "madres", href: "/plantel", color: "var(--accent)",
      detalle: [`Gestantes ${inv.prenadas + inv.servidas} · Lactantes ${inv.lactantes} · Vacías ${inv.vacias}`, `Cachorras ${inv.cachorras} · Machos ${inv.machos}${inv.cuarentena ? ` · Cuarentena ${inv.cuarentena}` : ""}`] },
    { titulo: "Maternidad", clave: "lechones_maternidad", valor: inv.lechonesMat, unidad: "lechones", href: "/maternidad", color: "var(--info)",
      detalle: [`${inv.camadas} camada${inv.camadas === 1 ? "" : "s"}`], mort: "mortalidad_predestete" },
    { titulo: "Iniciación", clave: "lechones_iniciacion", valor: inv.lechonesIni, unidad: "lechones", href: "/recria", color: "var(--warning)",
      detalle: [`${inv.lotesIni} lote${inv.lotesIni === 1 ? "" : "s"}`], mort: "mortalidad_iniciacion" },
    { titulo: "Engorde", clave: "cerdos_engorde", valor: inv.cerdosEng, unidad: "cerdos", href: "/engorde", color: "var(--danger)",
      detalle: [`${inv.lotesEng} lote${inv.lotesEng === 1 ? "" : "s"}`], mort: "mortalidad_engorde" },
  ];
  return (
    <section aria-labelledby="flujo-t" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 id="flujo-t" style={{ ...rotulo, margin: 0 }}>Animales hoy, fase por fase</h3>
      <div className="kp-flujo">
        {etapas.map((e, i) => {
          const f = e.mort ? fila(t, e.mort) : null;
          return (
            <div key={e.titulo} className="kp-flujo-paso">
              <Link href={e.href} className="kp-tarjeta-link" style={{ ...tarjeta, borderTop: `3px solid ${e.color}`, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, textDecoration: "none", color: "inherit", height: "100%" }}>
                <AyudaIndicador clave={e.clave}><span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{e.titulo}</span></AyudaIndicador>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ ...num, fontSize: 28, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.1 }}>{e.valor.toLocaleString("es-PY")}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.unidad}</span>
                </div>
                {e.detalle.map(d => <span key={d} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d}</span>)}
                {f && (
                  <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-secondary)" }}>
                    <span>Mortalidad <strong style={{ ...num, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(f.clave, f.anual)}</strong></span>
                    <Chip estado={f.estado} />
                  </div>
                )}
              </Link>
              {i < etapas.length - 1 && <IconArrowRight className="kp-flujo-flecha" size={16} aria-hidden style={{ color: "var(--text-muted)" }} />}
            </div>
          );
        })}
        <div className="kp-flujo-paso">
          <div style={{ ...tarjeta, background: "var(--bg-elevated)", borderTop: "3px solid var(--text-secondary)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, height: "100%" }}>
            <AyudaIndicador clave="total_lechones"><span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Total en crecimiento</span></AyudaIndicador>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ ...num, fontSize: 28, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.1 }}>{inv.total.toLocaleString("es-PY")}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>animales</span>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Maternidad + Iniciación + Engorde</span>
            {(() => { const f = fila(t, "mortalidad_total"); return (
              <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-secondary)" }}>
                <span>Mortalidad total <strong style={{ ...num, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(f.clave, f.anual)}</strong></span>
                <Chip estado={f.estado} />
              </div>
            ); })()}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3. ¿Dónde se pierden los lechones? ────────────────────── */
function DondeSePierden({ t }: { t: TableroGranja }) {
  const claves: ClaveIndicador[] = ["nacidos_muertos", "momificados", "mortalidad_predestete", "mortalidad_iniciacion", "mortalidad_engorde", "mortalidad_total"];
  const filas = claves.map(c => fila(t, c));
  const escala = Math.max(5, ...filas.flatMap(f => [f.anual ?? 0, f.reciente ?? 0, f.meta ?? 0])) * 1.1;
  return (
    <section style={{ ...tarjeta, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }} aria-labelledby="pierden-t">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h3 id="pierden-t" style={{ ...rotulo, margin: 0, color: "var(--text-secondary)" }}>¿Dónde se pierden los lechones?</h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Barra = últimos 12 meses · raya = meta</span>
      </div>
      {filas.map(f => {
        const i = INDICADORES[f.clave];
        const ancho = f.anual != null ? Math.min(100, (f.anual / escala) * 100) : 0;
        const marca = f.meta != null ? Math.min(100, (f.meta / escala) * 100) : null;
        return (
          <Link key={f.clave} href={ANALISIS[i.grupo] ?? "/dashboard"} className="kp-fila-link" style={{ display: "grid", gridTemplateColumns: "minmax(130px, 190px) 1fr auto", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit", padding: "2px 0" }}>
            <AyudaIndicador clave={f.clave}><span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{i.nombre.replace("Mortalidad en ", "").replace("Mortalidad ", "")}</span></AyudaIndicador>
            <div style={{ position: "relative", height: 14, borderRadius: 4, background: "var(--bg-overlay)" }} aria-hidden>
              <div style={{ position: "absolute", inset: 0, width: `${ancho}%`, borderRadius: 4, background: ESTADO[f.estado].color, opacity: 0.85 }} />
              {marca != null && <div style={{ position: "absolute", top: -3, bottom: -3, left: `${marca}%`, width: 2, background: "var(--text-primary)", borderRadius: 1 }} />}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", fontSize: 12, minWidth: 200, flexWrap: "wrap" }}>
              <strong style={{ ...num, fontWeight: 600, color: "var(--text-primary)", minWidth: 48, textAlign: "right" }}>{fmt(f.clave, f.anual)}</strong>
              <span style={{ ...num, color: "var(--text-muted)" }} title="Últimos 3 meses">3m {fmt(f.clave, f.reciente)} <Tendencia f={f} /></span>
              <span style={{ ...num, color: "var(--text-muted)" }}>meta {simbolo(f.clave)} {fmt(f.clave, f.meta)}</span>
              <Chip estado={f.estado} />
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/* ── 4. Todos los indicadores vs meta ──────────────────────── */
function TablaIndicadores({ t }: { t: TableroGranja }) {
  const grupos: GrupoIndicador[] = ["Reproducción", "Maternidad", "Iniciación", "Engorde", "General"];
  return (
    <section style={{ ...tarjeta, overflow: "hidden" }} aria-labelledby="ind-t">
      <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h3 id="ind-t" style={{ ...rotulo, margin: 0, color: "var(--text-secondary)" }}>Todos los indicadores vs meta</h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pasá el mouse por un indicador para ver cómo se calcula · «Analizar» abre el módulo</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 680 }}>
          <thead><tr>
            <th>Indicador</th><th style={{ textAlign: "right" }}>12 meses</th><th style={{ textAlign: "right" }}>Últimos 3 meses</th>
            <th style={{ textAlign: "right" }}>Meta</th><th style={{ textAlign: "right" }}>Distancia</th><th>Estado</th><th />
          </tr></thead>
          {grupos.map(g => {
            const filas = t.indicadores.filter(f => INDICADORES[f.clave].grupo === g);
            if (!filas.length) return null;
            return (
              <tbody key={g}>
                <tr><td colSpan={7} style={{ ...rotulo, background: "var(--bg-elevated)", padding: "6px 12px" }}>{g}</td></tr>
                {filas.map(f => (
                  <tr key={f.clave}>
                    <td><AyudaIndicador clave={f.clave}>{INDICADORES[f.clave].nombre}</AyudaIndicador></td>
                    <td style={{ ...num, textAlign: "right", fontWeight: 600 }}>{fmt(f.clave, f.anual)}</td>
                    <td style={{ ...num, textAlign: "right", color: "var(--text-secondary)" }}>{fmt(f.clave, f.reciente)} <Tendencia f={f} /></td>
                    <td style={{ ...num, textAlign: "right", color: "var(--text-muted)" }}>{simbolo(f.clave)} {fmt(f.clave, f.meta)}</td>
                    <td style={{ ...num, textAlign: "right", fontWeight: 500, color: f.estado === "FUERA" ? "var(--danger-text)" : f.estado === "ATENCION" ? "var(--warning-text)" : f.estado === "EN_META" ? "var(--success-text)" : "var(--text-muted)" }}>{distancia(f.distancia)}</td>
                    <td><Chip estado={f.estado} /></td>
                    <td style={{ textAlign: "right" }}>{ANALISIS[g] && <Link href={ANALISIS[g]!} style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>Analizar <IconChevronRight size={12} aria-hidden /></Link>}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

/* ── 5. Próximos eventos y actividad del mes ───────────────── */
function Mini({ clave, titulo, valor, sub, alerta }: { clave: ClaveIndicador; titulo: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <AyudaIndicador clave={clave}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{titulo}</span></AyudaIndicador>
      <span style={{ ...num, fontSize: 20, fontWeight: 600, color: alerta ? "var(--danger-text)" : "var(--text-primary)" }}>{valor}</span>
      {sub && <span style={{ fontSize: 11, color: alerta ? "var(--danger-text)" : "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}
function EventosYActividad({ t }: { t: TableroGranja }) {
  const fecha = (s: string) => s.split("-").reverse().join("/");
  const en = (d: number) => d === 0 ? "hoy" : d > 0 ? `en ${d} día${d === 1 ? "" : "s"}` : `atrasado ${-d} día${d === -1 ? "" : "s"}`;
  const { parto, destete } = t.eventos;
  const lact = fila(t, "dias_lactancia");
  return (
    <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12 }}>
      <section style={tarjeta} aria-labelledby="ev-t">
        <h3 id="ev-t" style={{ ...rotulo, margin: 0, padding: "10px 12px 0" }}>Próximos eventos</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <Mini clave="proximo_parto" titulo="Próximo parto" valor={parto ? fecha(parto.fecha) : "—"} sub={parto ? `${en(parto.enDias)}${parto.cantidad > 1 ? ` · ${parto.cantidad} esa semana` : ""}` : "Sin cerdas preñadas"} alerta={!!parto && parto.enDias < 0} />
          <Mini clave="proximo_destete" titulo="Próximo destete" valor={destete ? fecha(destete.fecha) : "—"} sub={destete ? `${en(destete.enDias)}${t.eventos.atrasadas ? ` · ${t.eventos.atrasadas} pasada${t.eventos.atrasadas === 1 ? "" : "s"} de ${t.eventos.metaLact} d` : ""}` : "Sin camadas en Maternidad"} alerta={!!destete && destete.enDias < 0} />
        </div>
      </section>
      <section style={tarjeta} aria-labelledby="act-t">
        <h3 id="act-t" style={{ ...rotulo, margin: 0, padding: "10px 12px 0" }}>Actividad del mes</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
          <Mini clave="servicios_mes" titulo="Servicios" valor={String(t.actividad.servicios)} />
          <Mini clave="partos_mes" titulo="Partos" valor={String(t.actividad.partos)} />
          <Mini clave="destetados_30d" titulo="Destetados (30 d)" valor={String(t.actividad.destetados30)} sub="lechones" />
          <Mini clave="bajas_mes" titulo="Bajas de lechones" valor={String(t.actividad.bajas)} sub="todas las fases" />
          <Mini clave="dias_lactancia" titulo="Días de lactancia" valor={fmt("dias_lactancia", lact.anual)} sub={`objetivo ${fmt("dias_lactancia", lact.meta)}`} alerta={lact.estado === "FUERA"} />
          <Mini clave="gestacion_real" titulo="Gestación real" valor={t.actividad.gestacionReal != null ? `${t.actividad.gestacionReal.toLocaleString("es-PY", { maximumFractionDigits: 1 })} d` : "—"} sub="normal 114-116" />
        </div>
      </section>
    </div>
  );
}
