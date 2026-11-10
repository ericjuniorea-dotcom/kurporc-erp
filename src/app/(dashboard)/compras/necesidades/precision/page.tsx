// Precisión del motor (14.4): consumo predicho contra salidas reales de los últimos 28 días. Meta: error < 15 % en balanceados.
import Link from "next/link";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { precisionNecesidades } from "@/lib/necesidades/datos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const n = (v: number) => v.toLocaleString("es-PY", { maximumFractionDigits: 1 });
const METODO: Record<string, string> = { RACION: "Por ración", PROGRAMADO: "Calendario sanitario", HISTORICO: "Histórico" };

export default async function Precision() {
  const permisos = (await getPermisos())!;
  if (!puede(permisos, "compras.necesidades.ver")) return <div style={{ fontSize: 13.5 }}>No tenés permiso para ver esta página.</div>;
  const filas = await precisionNecesidades(permisos.organizacionId);
  return (
    <>
      <Link href="/compras/necesidades" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Lo que te va a faltar</Link>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Comparamos lo que el cálculo dijo que ibas a consumir con lo que realmente salió del stock en los últimos 28 días. La meta es equivocarse menos de 15 % en el balanceado.
        Si el error es grande, revisá que las salidas se carguen todos los días y las raciones en Finanzas → Parámetros.
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 720 }}>
          <thead><tr><th>Producto</th><th>Método</th><th style={{ textAlign: "right" }}>Días con datos</th><th style={{ textAlign: "right" }}>Predicho</th><th style={{ textAlign: "right" }}>Real</th><th style={{ textAlign: "right" }}>Error</th></tr></thead>
          <tbody>
            {filas.map(f => {
              const meta = f.categoria === "BALANCEADO" ? 0.15 : 0.3;
              return (
                <tr key={f.id}>
                  <td>{f.nombre}</td><td>{METODO[f.metodo] ?? f.metodo}</td><td style={{ textAlign: "right" }}>{f.dias}</td>
                  <td style={{ textAlign: "right" }}>{n(f.predicho)} {f.unidad}</td><td style={{ textAlign: "right" }}>{n(f.real)} {f.unidad}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: f.error === null ? "var(--text-muted)" : f.error <= meta ? "var(--success-text)" : "var(--warning-text)" }}>
                    {f.error === null ? "sin salidas" : `${Math.round(f.error * 100)} %`}
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Todavía no hay cálculos guardados. Vuelve a mirar en unos días: se guarda uno por día.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
