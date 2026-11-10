import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { analizarLote } from "@/lib/engorde/lote";
import { pesoEsperado } from "@/lib/engorde/indicadores";
import { gs } from "@/lib/finanzas/calculos";
import { GraficoPeso } from "@/components/engorde/grafico-peso";
import { EncabezadoEngorde, FormLote, FormTratamiento } from "./formularios";

export const dynamic = "force-dynamic";
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
const f = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const num = (v: number | null, dec = 0, suf = "") => (v === null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("es-PY", { maximumFractionDigits: dec, minimumFractionDigits: dec })}${suf}`);

function Dato({ t, v, nota }: { t: string; v: string; nota?: string }) {
  return <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div><div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>{nota && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{nota}</div>}</div>;
}

export default async function LoteEngordePage({ params }: { params: Promise<{ id: string }> }) {
  const [session, permisos, { id }] = await Promise.all([getSession(), getPermisos(), params]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "engorde.lotes.ver")) redirect("/dashboard");
  const org = session.user.tenantId;
  const a = await analizarLote(org, id);
  if (!a) notFound();
  const [curvas, medicamentos] = await Promise.all([
    prisma.curvaEngorde.findMany({ where: { organizacionId: org }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.medicine.findMany({ where: { tenantId: org, isActive: true }, select: { id: true, name: true, withdrawalDays: true }, orderBy: { name: "asc" } }),
  ]);
  const { lote, ind, costos: c } = a;
  const verPlata = puede(permisos, "finanzas.costos.ver");
  const cerrado = lote.status === "CLOSED";
  const diaDe = (d: Date) => Math.round((d.getTime() - lote.entryDate.getTime()) / 86_400_000);
  const integrador = lote.integradorId ? a.contrapartes.find(x => x.id === lote.integradorId)?.nombre ?? "" : "";

  return (
    <>
      <EncabezadoEngorde />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1200 }}>
        <Link href="/engorde" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Engorde</Link>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Lote {lote.batchCode}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Ingreso {f(lote.entryDate)} · {lote.modalidad === "INTEGRADO" ? `integrado (${integrador})` : "propio"} · {lote.procedencia === "COMPRA_EXTERNA" ? "comprado" : "de recría propia"}
              {lote.sexo ? ` · ${lote.sexo.replace("_", " ").toLowerCase()}` : ""}{lote.genetica ? ` · ${lote.genetica}` : ""} · {cerrado ? `cerrado el ${lote.closedAt ? f(lote.closedAt) : "—"}` : "abierto"}
            </div>
          </div>
          <Link href="/engorde/comparativo" style={{ fontSize: 12, color: "var(--accent)" }}>Comparar lotes →</Link>
        </div>

        {a.carencias.length > 0 && (
          <div style={{ ...tarjeta, padding: 12, background: "var(--danger-subtle)", color: "var(--danger-text)", fontSize: 12.5 }}>
            En período de carencia: {a.carencias.map(x => `${x.medicine.name} hasta el ${f(x.endDate)}`).join(" · ")}. La venta al frigorífico está bloqueada hasta esa fecha.
          </div>
        )}

        <div style={{ ...tarjeta, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          <Dato t="Animales presentes" v={num(ind.presentes)} nota={`ingresaron ${ind.ingresados} · murieron ${ind.muertos} · vendidos ${ind.vendidos}`} />
          <Dato t="Días en engorde" v={num(ind.diasPromedio, 0)} nota="promedio por animal" />
          <Dato t="Peso promedio actual" v={num(ind.pesoActual, 1, " kg")} nota={`objetivo ${a.objetivo} kg`} />
          <Dato t="Ganancia diaria (GDP)" v={ind.gdpKg === null ? "—" : num(ind.gdpKg * 1000, 0, " g/día")} />
          <Dato t="Conversión alimenticia" v={num(ind.conversion, 2)} nota="kg de alimento por kg ganado" />
          <Dato t="Conversión económica" v={num(ind.conversionEconomica, 2)} nota="por kg vendido" />
          <Dato t="Mortalidad" v={ind.mortalidad === null ? "—" : num(ind.mortalidad * 100, 1, " %")} />
          <Dato t="Kg producidos" v={num(ind.kgProducidos, 0, " kg")} />
          <Dato t="Salida estimada" v={a.diasFaltan === null ? "—" : a.diasFaltan === 0 ? "Ya llegó al objetivo" : `en ${a.diasFaltan} días`} nota={a.curva ? `según la curva ${a.curva.nombre}` : "según la GDP (sin curva)"} />
        </div>

        {a.curva?.puntos && lote.weightRecords.length > 0 && (
          <div style={{ ...tarjeta, overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>Peso real contra la curva «{a.curva.nombre}»</div>
            <GraficoPeso curva={a.curva.puntos} objetivo={a.objetivo}
              pesajes={lote.weightRecords.map(w => ({ dia: diaDe(w.recordDate), real: Number(w.avgWeightKg), esperado: pesoEsperado(a.curva!.puntos!, diaDe(w.recordDate)), fecha: f(w.recordDate) }))} />
            <table className="kp-table" style={{ minWidth: 520, marginTop: 10 }}>
              <thead><tr><th>Pesaje</th><th style={{ textAlign: "right" }}>Día</th><th style={{ textAlign: "right" }}>Real</th><th style={{ textAlign: "right" }}>Esperado</th><th style={{ textAlign: "right" }}>Diferencia</th></tr></thead>
              <tbody>
                {lote.weightRecords.map(w => {
                  const real = Number(w.avgWeightKg), esp = pesoEsperado(a.curva!.puntos!, diaDe(w.recordDate));
                  const dif = esp === null ? null : real - esp;
                  return <tr key={w.id}><td>{f(w.recordDate)}</td><td style={{ textAlign: "right" }}>{diaDe(w.recordDate)}</td><td style={{ textAlign: "right" }}>{num(real, 1, " kg")}</td><td style={{ textAlign: "right" }}>{num(esp, 1, " kg")}</td><td style={{ textAlign: "right", color: dif !== null && dif < -2 ? "var(--danger-text)" : undefined }}>{dif === null ? "—" : `${dif > 0 ? "+" : ""}${num(dif, 1, " kg")}`}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        {verPlata ? (
          <div style={tarjeta}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Costo y resultado del lote</div>
            <table className="kp-table">
              <tbody>
                <tr><td>Animales que ingresaron<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.origenCostoAnimales}</div></td><td style={{ textAlign: "right" }}>{gs(c.animales)}</td></tr>
                <tr><td>Alimento<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{lote.alimentoLoProvee === "INTEGRADOR" ? "lo provee el integrador: costo 0 (los kilos cuentan para la conversión)" : c.precioKg ? `${num(c.alimentoKg, 0)} kg × ${gs(Math.round(c.precioKg))}/kg` : "sin compras de balanceado con kilos: no hay precio"}</div></td><td style={{ textAlign: "right" }}>{gs(c.alimento)}</td></tr>
                <tr><td>Sanidad (tratamientos del lote)</td><td style={{ textAlign: "right" }}>{gs(c.sanidad)}</td></tr>
                <tr><td>Mano de obra, estructura y amortización<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.pctEstructura > 0 ? `${num(c.pctEstructura * 100, 1)} % de los gastos fijos del período` : "sin prorrateo: definí el porcentaje en Finanzas → Parámetros"}</div></td><td style={{ textAlign: "right" }}>{gs(c.estructura)}</td></tr>
                <tr><td>Flete y gastos de venta</td><td style={{ textAlign: "right" }}>{gs(c.ventaGastos)}</td></tr>
                <tr style={{ background: "var(--bg-elevated)" }}><td style={{ fontWeight: 600 }}>Costo total</td><td style={{ textAlign: "right", fontWeight: 600 }}>{gs(c.total)}</td></tr>
                <tr><td>Ingresos{lote.modalidad === "INTEGRADO" ? " (pago del integrador)" : " (ventas)"}</td><td style={{ textAlign: "right" }}>{gs(c.ingresos)}</td></tr>
                <tr style={{ background: "var(--bg-elevated)" }}><td style={{ fontWeight: 600 }}>Margen del lote</td><td style={{ textAlign: "right", fontWeight: 600, color: c.margen < 0n ? "var(--danger-text)" : "var(--success-text)" }}>{gs(c.margen)}</td></tr>
                <tr><td>Costo por kg producido</td><td style={{ textAlign: "right" }}>{c.costoPorKgProducido === null ? "—" : gs(Math.round(c.costoPorKgProducido))}</td></tr>
                <tr><td>Costo por animal vendido</td><td style={{ textAlign: "right" }}>{c.costoPorAnimalVendido === null ? "—" : gs(Math.round(c.costoPorAnimalVendido))}</td></tr>
                <tr><td>Margen por animal</td><td style={{ textAlign: "right" }}>{c.margenPorAnimal === null ? "—" : gs(Math.round(c.margenPorAnimal))}</td></tr>
                <tr><td>Precio de equilibrio por kg vivo<div style={{ fontSize: 11, color: "var(--text-muted)" }}>costo total ÷ kg vendidos</div></td><td style={{ textAlign: "right" }}>{c.precioEquilibrioKg === null ? "—" : gs(Math.round(c.precioEquilibrioKg))}</td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ ...tarjeta, fontSize: 12, color: "var(--text-muted)" }}>El costo y el margen del lote los ve quien tiene el permiso de costos de Finanzas.</div>
        )}

        <div style={tarjeta}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Tratamientos y carencias</div>
          {a.tratamientos.length === 0 ? <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin tratamientos registrados en este lote.</div> : (
            <table className="kp-table">
              <thead><tr><th>Fecha</th><th>Medicamento</th><th style={{ textAlign: "right" }}>Animales</th><th>Carencia hasta</th>{verPlata && <th style={{ textAlign: "right" }}>Costo</th>}</tr></thead>
              <tbody>{a.tratamientos.map(t => (
                <tr key={t.id}><td>{f(t.startDate)}</td><td>{t.medicine.name}</td><td style={{ textAlign: "right" }}>{t.animales ?? "—"}</td>
                  <td style={{ color: t.endDate.getTime() > Date.now() ? "var(--danger-text)" : undefined }}>{t.withdrawalDays ? f(t.endDate) : "Sin carencia"}</td>
                  {verPlata && <td style={{ textAlign: "right" }}>{t.costoGs === null ? "—" : gs(t.costoGs)}</td>}</tr>
              ))}</tbody>
            </table>
          )}
          {!cerrado && puede(permisos, "sanidad.tratamientos.crear") && <FormTratamiento loteId={lote.id} medicamentos={medicamentos} presentes={ind.presentes} />}
        </div>

        {!cerrado && puede(permisos, "engorde.lotes.editar") && (
          <FormLote id={lote.id} curvas={curvas} inicial={{
            modalidad: lote.modalidad, integrador, pagoIntegracion: lote.pagoIntegracion ?? "", tarifaIntegracionGs: lote.tarifaIntegracionGs?.toString() ?? "",
            alimentoLoProvee: lote.alimentoLoProvee, sexo: lote.sexo ?? "", genetica: lote.genetica ?? "", costoIngresoGs: lote.costoIngresoGs?.toString() ?? "",
            targetWeightKg: String(Number(lote.targetWeightKg ?? 110)), curvaId: lote.curvaId ?? "",
          }} />
        )}
      </div>
    </>
  );
}
