import Link from "next/link";
import { paginaFinanzas } from "@/lib/finanzas/pagina";

export const metadata = { title: "Buenas prácticas · Finanzas · KurPorc" };

// Prácticas de control financiero de empresas porcinas grandes, llevadas a una granja chica.
// Sin cifras de terceros: el documento pide verificarlas contra fuentes públicas antes de mostrarlas.
const PRACTICAS: { titulo: string; que: string; como: string; donde: { href: string; label: string } }[] = [
  { titulo: "El costo unitario siempre al lado del precio", que: "Las empresas grandes miran cada mes cuánto les cuesta producir un kilo o un lechón y lo comparan con el precio de venta, no solo el resultado total.", como: "Mirá el costo por lechón entregado y el margen por lechón todos los meses. Si el margen baja tres meses seguidos, hay que actuar antes de que se note en la caja.", donde: { href: "/finanzas/costos", label: "Costos de producción" } },
  { titulo: "Fijar el costo del alimento", que: "El alimento es la mayor parte del costo. Las grandes compran por adelantado o con contratos cuando el precio es bueno.", como: "Seguí el precio por kilo de cada dieta mes a mes. Cuando baja, evaluá comprar más o acordar un precio con tu proveedor por varios meses.", donde: { href: "/finanzas/alimentacion", label: "Alimentación" } },
  { titulo: "Achicar la escala cuando el costo unitario no cierra", que: "Si cada animal se vende por debajo de su costo, producir más agranda la pérdida.", como: "Usá el punto de equilibrio: si vendés menos lechones de los que necesitás para cubrir los gastos fijos, primero bajá gastos fijos o subí la productividad por madre.", donde: { href: "/finanzas/indicadores", label: "Indicadores" } },
  { titulo: "Medir la plata parada", que: "Animales e insumos inmovilizados también son plata: una cerda vacía come sin producir y un botiquín sobrestockeado vence.", como: "Revisá el valor del stock de sanidad y los días no productivos de las cerdas. Cada día de una cerda parada es costo sin lechones.", donde: { href: "/finanzas/sanidad", label: "Sanidad valorizada" } },
  { titulo: "Cubrir los gastos financieros con la operación", que: "Las cuotas de préstamos tienen que salir de lo que genera la granja, no de nuevos préstamos ni de aportes.", como: "Antes de pedir un préstamo o comprar algo grande, usá «¿Entra en la caja?». Si la cuota supera una parte importante de tus mejores ventas, refinanciá a más plazo.", donde: { href: "/finanzas/nueva-inversion", label: "Nueva inversión" } },
  { titulo: "Explicar el costo por causa", que: "No alcanza con ver que un número subió: hay que escribir por qué (precio, consumo, mortalidad, un arreglo).", como: "Cada desvío grande contra el presupuesto lleva su causa escrita. Así, al año siguiente, el presupuesto sale mejor.", donde: { href: "/finanzas/presupuesto-vs-real", label: "Presupuesto contra real" } },
  { titulo: "Cerrar el mes, siempre", que: "Un mes cerrado no se toca: los números de ese mes son definitivos y comparables.", como: "Antes del día 5, declará los saldos de caja y bancos, revisá los controles del libro y cerrá el mes anterior.", donde: { href: "/finanzas/cierre", label: "Cierre de mes" } },
];

export default async function BuenasPracticas() {
  await paginaFinanzas("finanzas.tablero.ver");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
      {PRACTICAS.map(p => (
        <div key={p.titulo} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.titulo}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{p.que}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6 }}><strong>En tu granja:</strong> {p.como}</div>
          <Link href={p.donde.href} style={{ fontSize: 12, color: "var(--accent)", marginTop: "auto" }}>Ir a {p.donde.label} →</Link>
        </div>
      ))}
    </div>
  );
}
