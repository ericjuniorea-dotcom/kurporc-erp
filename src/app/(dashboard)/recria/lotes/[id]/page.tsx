// Ficha del lote de Iniciación: datos del lote, desempeño contra metas, movimientos, alimento, mortalidad,
// sanidad e histórico de pesajes.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconCircleCheckFilled, IconAlertTriangleFilled } from "@tabler/icons-react";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { analizarLoteRecria } from "@/lib/recria/lote";
import { CargarPesaje, EncabezadoFicha } from "./cliente";

export const dynamic = "force-dynamic";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const n = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("es-PY", { maximumFractionDigits: d, minimumFractionDigits: d }));
const f = (d: Date | null | undefined) => (d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—");
const PESTANAS = [["desempeno", "Desempeño"], ["movimientos", "Movimientos"], ["alimento", "Alimento"], ["mortalidad", "Mortalidad"], ["sanidad", "Sanidad"], ["historico", "Histórico"]] as const;

/** Tarjeta de indicador; con meta muestra si cumple (ícono + texto, no solo color). */
function Indicador({ t, v, unidad, meta, bien }: { t: string; v: string; unidad?: string; meta?: string; bien?: boolean | null }) {
  return (
    <div style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 6, minHeight: 112 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)" }}>{t}</span>
        {bien !== undefined && bien !== null && (bien
          ? <IconCircleCheckFilled size={16} style={{ color: "var(--success)" }} aria-label="Dentro de la meta" />
          : <IconAlertTriangleFilled size={16} style={{ color: "var(--danger)" }} aria-label="Fuera de la meta" />)}
      </div>
      <div style={{ fontSize: 28, fontWeight: 650, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{v}{unidad && v !== "—" && <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}> {unidad}</span>}</div>
      {meta && <div style={{ fontSize: 12, color: bien === false ? "var(--danger-text)" : "var(--text-muted)", marginTop: "auto" }}>Meta: <strong>{meta}</strong></div>}
    </div>
  );
}

export default async function FichaLoteRecria({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const permisos = await getPermisos();
  if (!permisos) redirect("/login");
  if (!puedeAlguno(permisos, ["destete.lotes.ver", "maternidad.destetes.ver"])) redirect("/dashboard");
  const { id } = await params;
  const { tab: t } = await searchParams;
  const tab = PESTANAS.some(([k]) => k === t) ? t! : "desempeno";
  const a = await analizarLoteRecria(permisos.organizacionId, id);
  if (!a) notFound();
  const { lote: l, ind, metas } = a;
  const ubicacion = l.pen ? `${l.pen.location.name} · corral ${l.pen.number}` : "Sin ubicación";
  const fase = l.phase === "PHASE_2" ? "Fase 2" : "Fase 1";

  return (
    <>
      <EncabezadoFicha />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1280 }}>
        <Link href="/recria" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Lotes de Iniciación</Link>

        <section style={{ ...tarjeta, padding: 18, display: "grid", gridTemplateColumns: "minmax(200px, auto) 1fr auto", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{l.batchCode}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: l.phase === "PHASE_2" ? "var(--accent-subtle)" : "var(--info-subtle)", color: l.phase === "PHASE_2" ? "var(--accent-text)" : "var(--info-text)" }}>{fase}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: l.isActive ? "var(--success-subtle)" : "var(--bg-subtle)", color: l.isActive ? "var(--success-text)" : "var(--text-muted)" }}>{l.isActive ? "Abierto" : "Cerrado"}</span>
            </div>
          </div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 4, fontSize: 13 }}>
            <dt style={{ color: "var(--text-secondary)" }}>Fecha de inicio</dt><dd style={{ margin: 0, fontWeight: 600 }}>{f(l.entryDate)}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Previsión de cierre</dt><dd style={{ margin: 0, fontWeight: 600 }}>{!l.isActive ? "—" : ind.cierrePor === "PESO" ? `${f(ind.cierrePrevisto)} (en ${ind.diasParaMeta} días, al llegar a ${metas.pesoSalidaKg} kg)` : ind.diasFase > metas.diasFase ? `ya pasó la meta de ${metas.diasFase} días (${ind.diasFase - metas.diasFase} de más) · cargá un pesaje para estimar por peso` : `${f(ind.cierrePrevisto)} (meta de ${metas.diasFase} días; sin pesajes)`}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Fecha media de nacimiento</dt><dd style={{ margin: 0, fontWeight: 600 }}>{f(ind.nacimientoMedio)}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Ubicación</dt><dd style={{ margin: 0, fontWeight: 600 }}>{ubicacion}</dd>
            <dt style={{ color: "var(--text-secondary)" }}>Saldo de animales</dt><dd style={{ margin: 0, fontWeight: 600 }}>{l.currentCount.toLocaleString("es-PY")}</dd>
          </dl>
          {l.isActive && puede(permisos, "destete.eventos.crear") && <CargarPesaje loteId={l.id} animales={l.currentCount} />}
        </section>

        <nav aria-label="Secciones de la ficha" style={{ display: "flex", gap: 2, borderBottom: "0.5px solid var(--border-default)", overflowX: "auto" }}>
          {PESTANAS.map(([k, label]) => (
            <Link key={k} href={`/recria/lotes/${l.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
              style={{ padding: "9px 14px", fontSize: 13.5, whiteSpace: "nowrap", textDecoration: "none", color: tab === k ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === k ? 600 : 400, borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}` }}>{label}</Link>
          ))}
        </nav>

        {tab === "desempeno" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            <Indicador t="Entrada" v={ind.entrada.toLocaleString("es-PY")} unidad="animales" />
            <Indicador t="Edad media de entrada" v={n(ind.edadEntrada, 1)} unidad="días" />
            <Indicador t="Peso medio de entrada" v={n(ind.pesoEntrada, 2)} unidad="kg" />
            <Indicador t="Consumo de alimento" v={n(ind.consumoKg, 0)} unidad="kg" />
            <Indicador t="Consumo por animal" v={n(ind.consumoAnimal, 1)} unidad="kg" meta={`${n(metas.consumoAnimalKg, 1)} kg en la fase`} bien={ind.consumoAnimal === null ? null : ind.consumoAnimal <= metas.consumoAnimalKg} />
            <Indicador t="Mortalidad" v={ind.mortalidad === null ? "—" : n(ind.mortalidad * 100, 2)} unidad="%" meta={`${n(metas.mortalidadPct, 2)} %`} bien={ind.mortalidad === null ? null : ind.mortalidad * 100 <= metas.mortalidadPct} />
            <Indicador t="Días en la fase" v={String(ind.diasFase)} unidad="días" meta={`${metas.diasFase} días`} bien={ind.diasFase <= metas.diasFase} />
            <Indicador t="Peso actual" v={n(ind.pesoActual, 2)} unidad="kg" meta={ind.gdp !== null ? `ganancia ${n(ind.gdp * 1000, 0)} g/día` : undefined} />
            <Indicador t="Peso proyectado hoy" v={n(ind.pesoHoy, 2)} unidad="kg" meta={ind.cierrePor === "PESO" ? `${metas.pesoSalidaKg} kg en ${ind.diasParaMeta} días` : "sin pesajes para proyectar"} />
            <Indicador t="Salida" v={ind.salida.toLocaleString("es-PY")} unidad="animales" meta={ind.salida ? `${ind.vendidos} vendidos · ${ind.transferidos} a engorde` : undefined} />
            <Indicador t="Edad media de salida" v={n(ind.edadSalida, 1)} unidad="días" />
            <Indicador t="Peso medio de salida" v={n(ind.pesoSalida, 2)} unidad="kg" meta={`${metas.pesoSalidaKg} kg`} bien={ind.pesoSalida === null ? null : ind.pesoSalida >= metas.pesoSalidaKg} />
          </div>
        )}

        {tab === "movimientos" && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <table className="kp-table" style={{ minWidth: 720 }}>
              <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th style={{ textAlign: "right" }}>Animales</th><th style={{ textAlign: "right" }}>Peso medio</th></tr></thead>
              <tbody>
                {[
                  ...l.weanings.map(w => ({ fecha: w.weaningDate, tipo: "Entrada (destete)", detalle: <>Cerda <a href={`/plantel?cerda=${w.farrowing.sow.id}`}>{w.farrowing.sow.identCode}</a> · {w.lactationDays} días de lactancia</>, cant: w.pigletsWeaned, peso: Number(w.avgPigletWeightKg) })),
                  ...a.muertes.map(m => ({ fecha: m.fecha, tipo: "Muerte", detalle: <>{m.causa}</>, cant: -m.cantidad, peso: null as number | null })),
                  ...l.sales.map(v => ({ fecha: v.saleDate, tipo: "Venta", detalle: <>{v.buyerName ?? "—"}{v.transferGuide ? ` · guía ${v.transferGuide}` : ""}</>, cant: -v.animalCount, peso: v.animalCount ? Number(v.totalWeightKg) / v.animalCount : null })),
                  ...ind.transferencias.map(t => ({ fecha: t.fecha, tipo: "Pase a engorde", detalle: <>Lote <a href={`/engorde/lotes/${t.id}`}>{t.destino}</a></>, cant: -t.cantidad, peso: t.cantidad ? t.kg / t.cantidad : null })),
                ].sort((x, y) => x.fecha.getTime() - y.fecha.getTime()).map((m, i) => (
                  <tr key={i}><td>{f(m.fecha)}</td><td>{m.tipo}</td><td style={{ fontSize: 12.5 }}>{m.detalle}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: m.cant < 0 ? "var(--danger-text)" : "var(--success-text)" }}>{m.cant > 0 ? `+${m.cant}` : m.cant}</td>
                    <td style={{ textAlign: "right" }}>{m.peso ? `${n(m.peso, 2)} kg` : "—"}</td></tr>
                ))}
                <tr style={{ fontWeight: 600 }}><td colSpan={3}>Saldo actual</td><td style={{ textAlign: "right" }}>{l.currentCount}</td><td></td></tr>
              </tbody>
            </table>
          </div>
        )}

        {tab === "alimento" && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <div style={{ padding: "12px 14px 0", fontSize: 13, color: "var(--text-secondary)" }}>Total {n(ind.consumoKg, 0)} kg · {n(ind.consumoAnimal, 1)} kg por animal (meta {n(metas.consumoAnimalKg, 1)} kg en la fase).</div>
            <table className="kp-table">
              <thead><tr><th>Fecha</th><th>Alimento</th><th style={{ textAlign: "right" }}>Kg</th></tr></thead>
              <tbody>
                {l.feedRecords.map((r, i) => <tr key={i}><td>{f(r.recordDate)}</td><td>{r.feedType.name}</td><td style={{ textAlign: "right" }}>{n(Number(r.quantityKg), 1)}</td></tr>)}
                {l.feedRecords.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sin consumos cargados para este lote (Alimentación → registro diario).</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "mortalidad" && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <div style={{ padding: "12px 14px 0", fontSize: 13, color: "var(--text-secondary)" }}>{ind.muertos} muerte{ind.muertos === 1 ? "" : "s"} · {ind.mortalidad === null ? "—" : `${n(ind.mortalidad * 100, 2)} %`} (meta {n(metas.mortalidadPct, 2)} %).</div>
            <table className="kp-table">
              <thead><tr><th>Fecha</th><th>Causa</th><th style={{ textAlign: "right" }}>Cantidad</th></tr></thead>
              <tbody>
                {a.muertes.map((m, i) => <tr key={i}><td>{f(m.fecha)}</td><td>{m.causa}</td><td style={{ textAlign: "right" }}>{m.cantidad}</td></tr>)}
                {a.muertes.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sin muertes registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "sanidad" && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <table className="kp-table">
              <thead><tr><th>Fecha</th><th>Producto</th><th style={{ textAlign: "right" }}>Dosis</th><th>Estado</th></tr></thead>
              <tbody>
                {a.vacunas.map(v => <tr key={v.id}><td>{f(v.fecha)}</td><td>{v.vacuna.nombre}</td><td style={{ textAlign: "right" }}>{v.dosisNecesarias}</td><td style={{ color: v.estado === "aplicado" ? "var(--success-text)" : v.estado === "retrasado" ? "var(--danger-text)" : "var(--text-secondary)" }}>{v.estado === "aplicado" ? "Aplicada" : v.estado === "retrasado" ? "Atrasada" : v.estado === "omitido" ? "Omitida" : "Pendiente"}</td></tr>)}
                {a.vacunas.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sin aplicaciones programadas para este lote.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "historico" && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <table className="kp-table">
              <thead><tr><th>Fecha</th><th style={{ textAlign: "right" }}>Día en el lote</th><th style={{ textAlign: "right" }}>Animales pesados</th><th style={{ textAlign: "right" }}>Peso promedio</th><th style={{ textAlign: "right" }}>Ganancia diaria</th></tr></thead>
              <tbody>
                {ind.pesoEntrada !== null && <tr><td>{f(l.entryDate)}</td><td style={{ textAlign: "right" }}>0</td><td style={{ textAlign: "right" }}>{ind.entrada}</td><td style={{ textAlign: "right" }}>{n(ind.pesoEntrada, 2)} kg</td><td style={{ textAlign: "right", color: "var(--text-muted)" }}>entrada</td></tr>}
                {l.weightRecords.map(w => (
                  <tr key={w.id}><td>{f(w.recordDate)}</td><td style={{ textAlign: "right" }}>{Math.round((w.recordDate.getTime() - l.entryDate.getTime()) / 86_400_000)}</td><td style={{ textAlign: "right" }}>{w.animalCount}</td>
                    <td style={{ textAlign: "right" }}>{n(Number(w.avgWeightKg), 2)} kg</td><td style={{ textAlign: "right" }}>{w.dailyGainKg === null ? "—" : `${n(Number(w.dailyGainKg) * 1000, 0)} g`}</td></tr>
                ))}
                {l.weightRecords.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Todavía no hay pesajes. Usá «Cargar peso promedio».</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
