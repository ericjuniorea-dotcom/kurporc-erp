// Fase 15.4 · Inicio del panel de plataforma: cuatro números, lo que necesita atención, del registro al uso real,
// lo más pedido y lo más usado. Abajo se conservan privacidad, incidentes, fallidos y altas por día.
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { requireAdmin } from "@/lib/admin/acceso";
import { resumenPlataforma } from "@/lib/admin/datos";
import { inicioPlataforma } from "@/lib/admin/inicio";
import { horas } from "@/lib/admin/uso";
import { BarrasH, PASTEL } from "@/components/admin/barras";
import { gs, hoyUTC, mesDe, nombreMes } from "@/lib/finanzas/calculos";

export const dynamic = "force-dynamic";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const titulo: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 10px" };

function Numero({ t, v, d }: { t: string; v: React.ReactNode; d?: React.ReactNode }) {
  return (
    <div style={{ ...tarjeta, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
      {d && <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>{d}</div>}
    </div>
  );
}

function Tile({ titulo: t, valor, detalle, alerta }: { titulo: string; valor: string | number; detalle?: string; alerta?: boolean }) {
  return (
    <div style={{ ...tarjeta, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: alerta ? "var(--danger-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{valor}</div>
      {detalle && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{detalle}</div>}
    </div>
  );
}

export default async function InicioAdmin() {
  const admin = await requireAdmin();
  const gestiona = admin.nivel === "TOTAL" || admin.nivel === "SOPORTE";
  const [i, r] = await Promise.all([inicioPlataforma(), resumenPlataforma()]);
  const mes = mesDe(hoyUTC());
  const atencion = [
    { n: i.atencion.buzonNuevos, texto: "mensajes nuevos en el buzón", href: "/admin/buzon?estado=NUEVA", ver: gestiona },
    { n: i.atencion.funcionesPedidas, texto: "funciones pedidas por 3 o más organizaciones, sin hacer", href: "/admin/buzon?tipo=FUNCION_NUEVA&orden=pedidas", ver: gestiona },
    { n: i.atencion.rojos, texto: "clientes en rojo", href: "/admin/organizaciones?salud=ROJO", ver: gestiona },
    { n: i.atencion.privacidad, texto: "solicitudes de privacidad abiertas", href: "/admin/privacidad", ver: gestiona },
    { n: i.atencion.incidentes, texto: "incidentes de seguridad abiertos", href: "/admin/seguridad", ver: gestiona },
  ].filter(a => a.ver && a.n > 0);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Numero t="Organizaciones" v={i.organizaciones.granjas} d={`granjas y productores · ${i.organizaciones.tiendas} tiendas · ${i.organizaciones.nuevas7} nuevas en 7 días`} />
        <Numero t="Activos en 7 días" v={<>{i.activos7} <span style={{ fontSize: 13, color: "var(--text-muted)" }}>de {i.usuarios}</span></>} d="personas que usaron la plataforma" />
        <Numero t="Cerdas en la plataforma" v={i.madres.toLocaleString("es-PY")} d={`madres activas en ${i.granjasConMadres} granja${i.granjasConMadres === 1 ? "" : "s"}`} />
        <Numero t={`Plata que se mueve · ${nombreMes(mes)}`} v={gs(i.plataMes.ingresos + i.plataMes.gastos)} d={`ingresos ${gs(i.plataMes.ingresos)} · gastos ${gs(i.plataMes.gastos)}`} />
      </div>

      <section style={{ ...tarjeta, padding: 16 }} aria-labelledby="atencion">
        <h2 id="atencion" style={titulo}>Necesita tu atención</h2>
        {atencion.length === 0
          ? <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nada pendiente. Todo al día.</div>
          : <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {atencion.map(a => (
              <li key={a.href}>
                <Link href={a.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "0.5px solid var(--border-subtle, var(--border-default))", textDecoration: "none", color: "var(--text-primary)", fontSize: 13 }}>
                  <strong style={{ fontWeight: 500, minWidth: 28, fontVariantNumeric: "tabular-nums" }}>{a.n}</strong>
                  <span style={{ flex: 1, color: "var(--text-secondary)" }}>{a.texto}</span>
                  <IconChevronRight size={15} aria-hidden style={{ color: "var(--text-muted)" }} />
                </Link>
              </li>
            ))}
          </ul>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
        <section style={{ ...tarjeta, padding: 16 }} aria-labelledby="embudo">
          <h2 id="embudo" style={titulo}>Del registro al uso real</h2>
          <BarrasH ancho={210} color={i2 => PASTEL[i2]} filas={i.embudo.map((e, k) => ({
            etiqueta: e.etiqueta, valor: e.valor,
            detalle: k > 0 && i.embudo[0].valor > 0 ? `${Math.round((e.valor / i.embudo[0].valor) * 100)} %` : undefined,
          }))} />
        </section>
        <section style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 14 }} aria-label="Lo más pedido y lo más usado">
          <div>
            <h2 style={titulo}>Las funciones más pedidas</h2>
            <BarrasH color={PASTEL[2]} vacio="Todavía nadie pidió una función nueva." formato={v => `${v} org.`}
              filas={i.topFunciones.map(f => ({ etiqueta: f.titulo, valor: f.pedidas }))} ancho={200} />
          </div>
          <div>
            <h2 style={titulo}>Los módulos más usados esta semana</h2>
            <BarrasH color={PASTEL[0]} vacio="Todavía no hay tiempo de uso registrado." formato={v => `${horas(v).toLocaleString("es-PY")} h`}
              filas={i.topModulos.map(m => ({ etiqueta: m.etiqueta, valor: m.segundos, detalle: `${Math.round(m.parte * 100)} %` }))} ancho={200} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Tiempo de uso estimado: pestaña abierta con actividad, no atención.</div>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <Tile titulo="Solicitudes de privacidad abiertas" valor={r.privacidad} alerta={r.privacidad > 0} detalle="Plazo: 30 días" />
        <Tile titulo="Incidentes de seguridad abiertos" valor={r.incidentes} alerta={r.incidentes > 0} detalle="Plazo de aviso: 72 h" />
        <Tile titulo="Ingresos fallidos (24 h)" valor={r.fallidos24} alerta={r.fallidos24 > 20} />
        <Tile titulo="Activos hoy" valor={r.activosHoy} detalle={`en 30 días ${r.activos30}`} />
      </div>
      <div style={{ ...tarjeta, padding: 16 }}>
        <h2 style={titulo}>Altas de los últimos 30 días</h2>
        {r.altasPorDia.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nadie se registró en los últimos 30 días.</div>
        ) : (
          <table className="kp-table">
            <thead><tr><th>Día</th><th style={{ textAlign: "right" }}>Cuentas nuevas</th></tr></thead>
            <tbody>
              {r.altasPorDia.map(([dia, n]) => (
                <tr key={dia}><td>{dia.slice(8, 10)}/{dia.slice(5, 7)}/{dia.slice(0, 4)}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
