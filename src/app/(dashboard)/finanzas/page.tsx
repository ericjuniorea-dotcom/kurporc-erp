import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { cuentasConSaldo, pagosConSigno } from "@/lib/finanzas/datos";
import { estadoCuentaDe, gs, hoyUTC, mesDe, nombreMes, pct } from "@/lib/finanzas/calculos";

export const metadata = { title: "Finanzas · KurPorc" };

const GRUPOS: Record<string, string> = {
  BALANCEADO: "Balanceado", PERSONAL: "Personal", SANIDAD_VET: "Sanidad y veterinario", GENETICA: "Genética y reproducción",
  ENERGIA_AGUA: "Energía y agua", MANT_LIMPIEZA: "Mantenimiento y limpieza", LOGISTICA: "Logística", ADMIN_OTROS: "Administración y otros",
};
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

function Tile({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div style={{ ...tarjeta, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{valor}</div>
      {detalle && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{detalle}</div>}
    </div>
  );
}

export default async function TableroFinanzas() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "finanzas.tablero.ver")) redirect("/finanzas/movimientos");
  const org = session.user.tenantId;
  const corte = hoyUTC();
  const mes = mesDe(corte);
  const anio = Math.floor(mes / 100);

  const [movsAnio, cajas, pagos, abiertos] = await Promise.all([
    prisma.movimiento.findMany({
      where: { organizacionId: org, estado: { not: "ANULADO" }, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 } },
      select: { mes: true, tipo: true, montoGs: true, signo: true, esInterno: true, categoria: { select: { nombre: true, grupoTablero: true } } },
    }),
    cuentasConSaldo(org),
    pagosConSigno(org),
    prisma.movimiento.findMany({
      where: { organizacionId: org, estado: { in: ["PENDIENTE", "POR_COBRAR"] } },
      select: { montoGs: true, signo: true, fechaVencimiento: true, pagos: { select: { montoGs: true } } },
    }),
  ]);

  const sumar = (f: (m: (typeof movsAnio)[number]) => boolean) => movsAnio.filter(m => !m.esInterno && f(m)).reduce((s, m) => s + m.montoGs, 0n);
  const ingresosMes = sumar(m => m.tipo === "INGRESO" && m.mes === mes);
  const gastosMes = sumar(m => m.tipo === "GASTO" && m.mes === mes);
  const ingresosAnio = sumar(m => m.tipo === "INGRESO");
  const gastosAnio = sumar(m => m.tipo === "GASTO");
  const inversionAnio = sumar(m => m.tipo === "INVERSION");
  const flujoAnio = pagos.filter(p => !p.esInterno && p.fechaPago.getUTCFullYear() === anio).reduce((s, p) => s + (p.signo > 0 ? p.montoGs : -p.montoGs), 0n);
  const cajaTotal = cajas.cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldoGs, 0n) + cajas.sinAsignarGs;

  let porPagar = 0n, pagarVencido = 0n, porCobrar = 0n, cobrarVencido = 0n;
  for (const m of abiertos) {
    const saldo = m.montoGs - m.pagos.reduce((s, p) => s + p.montoGs, 0n);
    const vencido = estadoCuentaDe(m.montoGs, saldo, m.fechaVencimiento, corte, m.signo > 0) === "VENCIDO";
    if (m.signo > 0) { porCobrar += saldo; if (vencido) cobrarVencido += saldo; }
    else { porPagar += saldo; if (vencido) pagarVencido += saldo; }
  }

  const grupos = Object.entries(GRUPOS).map(([k, nombre]) => ({
    nombre,
    anio: sumar(m => m.tipo === "GASTO" && m.categoria.grupoTablero === k),
    mes: sumar(m => m.tipo === "GASTO" && m.categoria.grupoTablero === k && m.mes === mes),
  })).filter(g => g.anio > 0n || g.mes > 0n).sort((a, b) => (b.anio > a.anio ? 1 : b.anio < a.anio ? -1 : 0));
  const maxGrupo = grupos.reduce((m, g) => (g.anio > m ? g.anio : m), 0n);
  const sinMovimientos = movsAnio.length === 0;

  return (
    <>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Datos al {corte.toISOString().slice(8, 10)}/{corte.toISOString().slice(5, 7)}/{anio} · en vivo</div>
      {sinMovimientos && (
        <div style={{ ...tarjeta, padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          Todavía no hay movimientos de {anio}. Empezá por <Link href="/finanzas/caja-bancos" style={{ color: "var(--accent)" }}>cargar tus cuentas de caja y bancos</Link> con su saldo inicial
          y después <Link href="/finanzas/movimientos" style={{ color: "var(--accent)" }}>cada ingreso, gasto o inversión</Link>. Todo lo demás se calcula solo.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Tile titulo="Caja + bancos hoy" valor={gs(cajaTotal)} color={cajaTotal < 0n ? "var(--danger-text)" : undefined}
          detalle={`Realmente disponible: ${gs(cajaTotal - porPagar)}`} />
        <Tile titulo={`Resultado de ${nombreMes(mes)}`} valor={gs(ingresosMes - gastosMes)} color={ingresosMes - gastosMes < 0n ? "var(--danger-text)" : "var(--success-text)"}
          detalle={`Ingresos ${gs(ingresosMes)} · gastos ${gs(gastosMes)}`} />
        <Tile titulo={`Resultado de ${anio}`} valor={gs(ingresosAnio - gastosAnio)} color={ingresosAnio - gastosAnio < 0n ? "var(--danger-text)" : "var(--success-text)"}
          detalle={`Flujo de caja real: ${gs(flujoAnio)}`} />
        <Tile titulo="Por pagar" valor={gs(porPagar)} detalle={pagarVencido > 0n ? `Vencido: ${gs(pagarVencido)}` : "Nada vencido"} color={pagarVencido > 0n ? "var(--warning-text)" : undefined} />
        <Tile titulo="Por cobrar" valor={gs(porCobrar)} detalle={cobrarVencido > 0n ? `Vencido: ${gs(cobrarVencido)}` : "Nada vencido"} color={cobrarVencido > 0n ? "var(--warning-text)" : undefined} />
        <Tile titulo={`Inversión en ${anio}`} valor={gs(inversionAnio)} />
      </div>

      {grupos.length > 0 && (
        <div style={{ ...tarjeta, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>¿En qué se va la plata? (gastos de {anio})</div>
          <table className="kp-table" style={{ minWidth: 0 }}>
            <thead><tr><th>Grupo</th><th style={{ width: "40%" }}></th><th style={{ textAlign: "right" }}>En el año</th><th style={{ textAlign: "right" }}>%</th><th style={{ textAlign: "right" }}>Este mes</th></tr></thead>
            <tbody>
              {grupos.map(g => {
                const p = pct(g.anio, gastosAnio);
                return (
                  <tr key={g.nombre} title={`${g.nombre}: ${gs(g.anio)} en el año`}>
                    <td style={{ color: "var(--text-primary)" }}>{g.nombre}</td>
                    <td aria-hidden>
                      <div style={{ height: 8, borderRadius: 4, background: "var(--accent)", opacity: 0.85, width: maxGrupo > 0n ? `${Math.max(2, Number((g.anio * 1000n) / maxGrupo) / 10)}%` : 0 }} />
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(g.anio)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{p === null ? "—" : `${p.toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{gs(g.mes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ ...tarjeta, padding: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text-primary)" }}>Cómo se usa.</strong> Todos los días: cargá ingresos, gastos, inversiones y cuotas en Movimientos.
        Cada semana: revisá lo que vence en Por pagar. Cada mes: declará el saldo de la caja y de cada banco en Caja y bancos.
      </div>
    </>
  );
}
