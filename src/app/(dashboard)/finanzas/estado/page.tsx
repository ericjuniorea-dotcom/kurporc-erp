import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { estadoFinanciero } from "@/lib/finanzas/control";
import { gs } from "@/lib/finanzas/calculos";

export const metadata = { title: "Estado financiero · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };

function Bloque({ titulo, filas, total }: { titulo: string; filas: [string, bigint | null, string?][]; total?: [string, bigint | null] }) {
  return (
    <div style={tarjeta}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>{titulo}</div>
      <table className="kp-table">
        <tbody>
          {filas.map(([t, v, nota]) => (
            <tr key={t}><td>{t}{nota && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{nota}</div>}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: v !== null && v < 0n ? "var(--danger-text)" : undefined }}>{v === null ? "—" : gs(v)}</td></tr>
          ))}
          {total && <tr style={{ background: "var(--bg-elevated)" }}><td style={{ fontWeight: 600 }}>{total[0]}</td><td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: total[1] !== null && total[1] < 0n ? "var(--danger-text)" : undefined }}>{total[1] === null ? "—" : gs(total[1])}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function EstadoFinanciero() {
  const { org } = await paginaFinanzas("finanzas.estado.ver");
  const e = await estadoFinanciero(org);
  const c = e.conciliacion;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
      <Bloque titulo="Activos disponibles" filas={[["Caja", e.activos.caja], ...e.activos.bancos.map(b => [b.nombre, b.saldoGs] as [string, bigint]), ["Cuentas por cobrar", e.activos.porCobrar]]} total={["Total", e.activos.total]} />
      <Bloque titulo="Obligaciones" filas={[["Cuentas por pagar a proveedores", e.obligaciones.porPagar], ["Préstamos (saldo pendiente)", e.obligaciones.prestamos]]} total={["Total", e.obligaciones.total]} />
      <Bloque titulo="Posición neta" filas={[
        ["Capital de trabajo", e.posicion.capitalTrabajo, "Disponible + por cobrar − por pagar"],
        ["Posición neta total", e.posicion.posicionNeta, "Activos disponibles − obligaciones"],
        ["Dinero comprometido", e.posicion.comprometido, "Por pagar + cuotas de los próximos 3 meses"],
        ["Caja realmente disponible", e.posicion.cajaDisponible, "Caja + bancos − por pagar − cuota del mes"],
      ]} />
      <Bloque titulo="Resultado del año" filas={[["Ingresos", e.resultado.ingresos], ["Costo de la granja (con amortización)", e.resultado.costo], ["De eso, balanceado", e.resultado.balanceado], ["Resto de la granja", e.resultado.restoGranja]]} total={["Resultado", e.resultado.resultado]} />
      <Bloque titulo="Inversiones" filas={[["Histórica", e.inversiones.historica], ["Nueva (prevista)", e.inversiones.nueva]]} total={["Total", e.inversiones.total]} />
      <Bloque titulo="¿De dónde salió la plata?" filas={[
        ["Saldos iniciales de las cuentas", c.saldosIniciales], ["+ Préstamos recibidos", c.prestamosRecibidos], ["+ Capital propio aportado", c.aportes], ["+ Ingresos cobrados", c.cobrados],
        ["− Egresos pagados (gastos e inversión)", c.egresosPagados], ["− Cuotas pagadas", c.cuotasPagadas], ["− Intereses y retiros", c.otrosFin],
        ["= Saldo según movimientos", c.segunMovimientos], ["Saldo declarado (caja + cuentas)", c.declarado, c.declarado === null ? "Falta declarar el saldo de alguna cuenta" : undefined],
      ]} total={["Diferencia a conciliar (debe ser cero)", c.diferencia]} />
    </div>
  );
}
