import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { analizarLote } from "@/lib/engorde/lote";
import { datosAnio, sanidadAnio } from "@/lib/finanzas/anio";
import { div, hojaCostos, sumaB, sumaN } from "@/lib/finanzas/hojas";
import { gs, hoyUTC, mesDe } from "@/lib/finanzas/calculos";
import { EncabezadoEngorde } from "../lotes/[id]/formularios";

export const dynamic = "force-dynamic";
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const num = (v: number | null, dec = 0, suf = "") => (v === null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("es-PY", { maximumFractionDigits: dec, minimumFractionDigits: dec })}${suf}`);

export default async function ComparativoLotes() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "engorde.lotes.ver")) redirect("/dashboard");
  const org = session.user.tenantId;
  const verPlata = puede(permisos, "finanzas.costos.ver");
  const ids = await prisma.growingBatch.findMany({ where: { tenantId: org }, orderBy: { entryDate: "desc" }, take: 40, select: { id: true } });
  const lotes = (await Promise.all(ids.map(l => analizarLote(org, l.id)))).filter((x): x is NonNullable<typeof x> => !!x);

  // Ciclo completo: costo del lechón (Costos de producción del año) + costo del engorde por animal
  let costoLechon: number | null = null;
  if (verPlata) {
    const anio = hoyUTC().getUTCFullYear();
    const [d, san] = await Promise.all([datosAnio(org, anio), sanidadAnio(org, anio)]);
    const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, mesDe(hoyUTC()));
    costoLechon = div(sumaB(c.conAmort), sumaN(d.prod.map(p => p.entregados)));
  }

  return (
    <>
      <EncabezadoEngorde />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1300 }}>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <Link href="/engorde" style={{ color: "var(--text-muted)" }}>← Engorde</Link>
          <Link href="/engorde/curvas" style={{ color: "var(--accent)" }}>Curvas de crecimiento →</Link>
        </div>
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Comparativo de lotes</div>
          <table className="kp-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr><th>Lote</th><th>Estado</th><th style={{ textAlign: "right" }}>Ingresados</th><th style={{ textAlign: "right" }}>Presentes</th><th style={{ textAlign: "right" }}>Días</th><th style={{ textAlign: "right" }}>GDP (g)</th><th style={{ textAlign: "right" }}>Conversión</th><th style={{ textAlign: "right" }}>Mortalidad</th><th style={{ textAlign: "right" }}>Kg producidos</th>
                {verPlata && <><th style={{ textAlign: "right" }}>Costo por kg</th><th style={{ textAlign: "right" }}>Margen</th><th style={{ textAlign: "right" }}>Margen por animal</th></>}</tr>
            </thead>
            <tbody>
              {lotes.map(({ lote, ind, costos }) => (
                <tr key={lote.id}>
                  <td><Link href={`/engorde/lotes/${lote.id}`} style={{ color: "var(--accent)" }}>{lote.batchCode}</Link>{lote.modalidad === "INTEGRADO" && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}> · integrado</span>}</td>
                  <td>{lote.status === "CLOSED" ? "Cerrado" : "Abierto"}</td>
                  <td style={{ textAlign: "right" }}>{ind.ingresados}</td>
                  <td style={{ textAlign: "right" }}>{ind.presentes}</td>
                  <td style={{ textAlign: "right" }}>{num(ind.diasPromedio)}</td>
                  <td style={{ textAlign: "right" }}>{ind.gdpKg === null ? "—" : num(ind.gdpKg * 1000)}</td>
                  <td style={{ textAlign: "right" }}>{num(ind.conversion, 2)}</td>
                  <td style={{ textAlign: "right" }}>{ind.mortalidad === null ? "—" : num(ind.mortalidad * 100, 1, " %")}</td>
                  <td style={{ textAlign: "right" }}>{num(ind.kgProducidos, 0)}</td>
                  {verPlata && <>
                    <td style={{ textAlign: "right" }}>{costos.costoPorKgProducido === null ? "—" : gs(Math.round(costos.costoPorKgProducido))}</td>
                    <td style={{ textAlign: "right", color: costos.margen < 0n ? "var(--danger-text)" : undefined }}>{gs(costos.margen)}</td>
                    <td style={{ textAlign: "right" }}>{costos.margenPorAnimal === null ? "—" : gs(Math.round(costos.margenPorAnimal))}</td>
                  </>}
                </tr>
              ))}
              {lotes.length === 0 && <tr><td colSpan={12} style={{ padding: 16, color: "var(--text-muted)" }}>Todavía no hay lotes de engorde.</td></tr>}
            </tbody>
          </table>
        </div>
        {verPlata && lotes.some(l => l.costos.costoPorAnimalVendido !== null) && (
          <div style={{ ...tarjeta, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Ciclo completo: ¿cuánto cuesta un cerdo terminado?</div>
            <table className="kp-table">
              <thead><tr><th>Lote</th><th style={{ textAlign: "right" }}>Costo del lechón</th><th style={{ textAlign: "right" }}>Costo del engorde por animal</th><th style={{ textAlign: "right" }}>Cerdo terminado</th></tr></thead>
              <tbody>
                {lotes.filter(l => l.costos.costoPorAnimalVendido !== null).map(({ lote, costos, ind }) => {
                  // El costo de engorde por animal sin el costo de ingreso, para sumarle el costo propio del lechón
                  const engorde = ind.vendidos > 0 ? Number(costos.total - costos.animales) / ind.vendidos : null;
                  return (
                    <tr key={lote.id}>
                      <td>{lote.batchCode}</td>
                      <td style={{ textAlign: "right" }}>{costoLechon === null ? "—" : gs(Math.round(costoLechon))}</td>
                      <td style={{ textAlign: "right" }}>{engorde === null ? "—" : gs(Math.round(engorde))}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{costoLechon === null || engorde === null ? "—" : gs(Math.round(costoLechon + engorde))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Costo del lechón = costo por lechón entregado del año (Finanzas → Costos). Si todavía no hay ventas de lechones, queda vacío.</div>
          </div>
        )}
      </div>
    </>
  );
}
