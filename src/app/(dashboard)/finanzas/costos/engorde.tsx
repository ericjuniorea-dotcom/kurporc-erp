// Fase 9 · Sección "Engorde" de Costos de producción: los lotes con actividad en el año, con su costo,
// kg producidos, costo por kg y margen (los mismos números del detalle de cada lote).
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { analizarLote } from "@/lib/engorde/lote";
import { gs } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const derecha: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const kg = (v: number) => `${Math.round(v).toLocaleString("es-PY")} kg`;

export async function SeccionEngorde({ org, anio }: { org: string; anio: number }) {
  const inicio = new Date(Date.UTC(anio, 0, 1)), fin = new Date(Date.UTC(anio + 1, 0, 1));
  const ids = await prisma.growingBatch.findMany({
    where: { tenantId: org, entryDate: { lt: fin }, OR: [{ status: "ACTIVE" }, { closedAt: { gte: inicio } }, { closedAt: null, entryDate: { gte: inicio } }] },
    orderBy: { entryDate: "asc" }, select: { id: true },
  });
  if (!ids.length) return null;
  const lotes = (await Promise.all(ids.map(l => analizarLote(org, l.id)))).filter((x): x is NonNullable<typeof x> => !!x);
  const t = lotes.reduce((s, l) => ({
    total: s.total + l.costos.total, ingresos: s.ingresos + l.costos.ingresos, margen: s.margen + l.costos.margen,
    kgProd: s.kgProd + l.ind.kgProducidos, vendidos: s.vendidos + l.ind.vendidos, kgVend: s.kgVend + l.ind.kgVendidos,
  }), { total: 0n, ingresos: 0n, margen: 0n, kgProd: 0, vendidos: 0, kgVend: 0 });
  return (
    <section style={{ ...tarjeta, overflowX: "auto" }} aria-labelledby="t-engorde">
      <div style={{ padding: "12px 14px 0", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h2 id="t-engorde" style={{ fontSize: 14, margin: 0 }}>Engorde {anio}</h2>
        <Link href="/engorde/comparativo" style={{ fontSize: 12 }}>Comparativo y ciclo completo →</Link>
      </div>
      <div style={{ padding: "4px 14px 0", fontSize: 12, color: "var(--text-secondary)" }}>
        Cada lote con su costo propio: animales de ingreso, alimento, sanidad, estructura asignada y gastos de venta. No se suma a la tabla de arriba, que es la granja de lechones.
      </div>
      <table className="kp-table" style={{ minWidth: 960 }}>
        <thead><tr><th>Lote</th><th>Estado</th><th style={derecha}>Presentes</th><th style={derecha}>Kg producidos</th><th style={derecha}>Costo total</th><th style={derecha}>Costo por kg</th><th style={derecha}>Ingresos</th><th style={derecha}>Margen</th><th style={derecha}>Equilibrio por kg</th></tr></thead>
        <tbody>
          {lotes.map(l => (
            <tr key={l.lote.id}>
              <td><Link href={`/engorde/lotes/${l.lote.id}`} style={{ fontWeight: 500 }}>{l.lote.batchCode}</Link><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.lote.modalidad === "INTEGRADO" ? "Integrado" : "Propio"}</div></td>
              <td>{l.lote.status === "CLOSED" ? "Cerrado" : "Abierto"}</td>
              <td style={derecha}>{l.ind.presentes}</td>
              <td style={derecha}>{kg(l.ind.kgProducidos)}</td>
              <td style={derecha}>{gs(l.costos.total)}</td>
              <td style={derecha}>{l.costos.costoPorKgProducido === null ? "—" : gs(Math.round(l.costos.costoPorKgProducido))}</td>
              <td style={derecha}>{l.costos.ingresos > 0n ? gs(l.costos.ingresos) : "—"}</td>
              <td style={{ ...derecha, color: l.costos.margen < 0n && l.costos.ingresos > 0n ? "var(--danger-text)" : undefined }}>{l.costos.ingresos > 0n ? gs(l.costos.margen) : "—"}</td>
              <td style={derecha}>{l.costos.precioEquilibrioKg === null ? "—" : gs(Math.round(l.costos.precioEquilibrioKg))}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3}>Total engorde</td>
            <td style={derecha}>{kg(t.kgProd)}</td><td style={derecha}>{gs(t.total)}</td>
            <td style={derecha}>{t.kgProd > 0 ? gs(Math.round(Number(t.total) / t.kgProd)) : "—"}</td>
            <td style={derecha}>{t.ingresos > 0n ? gs(t.ingresos) : "—"}</td><td style={derecha}>{t.ingresos > 0n ? gs(t.margen) : "—"}</td>
            <td style={derecha}>{t.kgVend > 0 ? gs(Math.round(Number(t.total) / t.kgVend)) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
