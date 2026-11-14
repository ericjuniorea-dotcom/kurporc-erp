// Ficha de una organización (Fase 15.4). Sin motivo registrado no se muestra nada de la organización.
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { MOTIVOS, motivoVigente, registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { saludOrganizaciones, SALUD } from "@/lib/admin/salud";
import { desde, horas, usoOrganizacion } from "@/lib/admin/uso";
import { BarraApilada, BarrasH, PASTEL, Semaforo } from "@/components/admin/barras";
import { etiquetaModulo } from "@/lib/modulos";
import { gs, hoyUTC, mesDe, nombreMes } from "@/lib/finanzas/calculos";
import { ElegirMotivo } from "./elegir-motivo";
import { VerERP } from "../../ver-erp";

export const dynamic = "force-dynamic";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const h2: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 };
const fecha = (d: Date | null | undefined) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const TIPO: Record<string, string> = { EMPRESA: "Empresa", INDIVIDUAL: "Productor", VENDEDOR: "Tienda" };
const TIPO_BUZON: Record<string, string> = { PROBLEMA: "Problema", CONSULTA: "Duda", SUGERENCIA: "Idea", FUNCION_NUEVA: "Función nueva" };
const ESTADO_BUZON: Record<string, string> = { NUEVA: "Nueva", EN_REVISION: "En revisión", EN_DESARROLLO: "En desarrollo", HECHA: "Hecha", DESCARTADA: "Descartada" };

function Tarjeta({ t, v, d }: { t: string; v: React.ReactNode; d?: React.ReactNode }) {
  return (
    <div style={{ ...tarjeta, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
      {d && <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>{d}</div>}
    </div>
  );
}

export default async function DetalleOrganizacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const org = await prisma.tenant.findUnique({ where: { id }, select: { id: true, farmName: true, tipo: true, ruc: true, departamento: true, distrito: true, plan: true, estado: true, createdAt: true } });
  if (!org) notFound();

  if (admin.nivel === "LECTURA" || admin.nivel === "MODERACION") {
    return <div style={{ ...tarjeta, padding: 16, fontSize: 13 }}>Tu nivel ({admin.nivel}) solo ve métricas agregadas, no los datos de cada organización.</div>;
  }
  const motivo = await motivoVigente(id);
  if (!motivo) {
    return (
      <>
        <Link href="/admin/organizaciones" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Organizaciones</Link>
        <ElegirMotivo organizacionId={id} nombre={org.farmName} motivos={MOTIVOS} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          O abrí directamente su ERP en solo lectura: <VerERP organizacionId={id} nombre={org.farmName} />
        </div>
      </>
    );
  }
  await registrarAcceso({ adminId: admin.usuario.id, organizacionId: id, seccion: `/admin/organizaciones/${id}`, motivo: motivo.motivo, detalle: motivo.detalle });

  const hoy = hoyUTC();
  const mes = mesDe(hoy);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const [salud, uso, miembros, estados, activosSemana, partosMes, vivosMes, destetesMes, serviciosMes, finMes, buzonTotal, buzon, auditoria] = await Promise.all([
    saludOrganizaciones(),
    usoOrganizacion(id, 7),
    prisma.miembro.findMany({ where: { organizacionId: id }, orderBy: [{ esPropietario: "desc" }, { createdAt: "asc" }],
      select: { userId: true, cargo: true, estado: true, esPropietario: true, rol: { select: { nombre: true } }, perfil: { select: { name: true, email: true, ultimoAcceso: true, tipoAcceso: true } } } }),
    prisma.sow.groupBy({ by: ["plantelState"], where: { tenantId: id, isActive: true }, _count: { _all: true } }),
    prisma.actividadDiaria.groupBy({ by: ["userId"], where: { organizacionId: id, fecha: { gte: desde(7) } } }).then(r => r.length),
    prisma.farrowingEvent.count({ where: { tenantId: id, startDatetime: { gte: inicioMes } } }),
    prisma.farrowingEvent.aggregate({ where: { tenantId: id, startDatetime: { gte: inicioMes } }, _sum: { bornAlive: true } }),
    prisma.weaningEvent.aggregate({ where: { tenantId: id, weaningDate: { gte: inicioMes } }, _sum: { pigletsWeaned: true } }),
    prisma.serviceEvent.count({ where: { tenantId: id, serviceDate: { gte: inicioMes } } }),
    prisma.movimiento.groupBy({ by: ["tipo"], where: { organizacionId: id, mes, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.sugerencia.count({ where: { organizacionId: id } }),
    prisma.sugerencia.findMany({ where: { organizacionId: id }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, tipo: true, modulo: true, estado: true, titulo: true, mensaje: true, createdAt: true } }),
    prisma.auditoria.findMany({ where: { organizacionId: id }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, createdAt: true, accion: true, actorId: true, entidad: true, actorEsPlataforma: true } }),
  ]);
  const suma = (t: string) => finMes.find(x => x.tipo === t)?._sum.montoGs ?? 0n;
  const ingresos = suma("INGRESO"), gastos = suma("GASTO");
  const n = (...ks: string[]) => estados.filter(e => e.plantelState && ks.includes(e.plantelState)).reduce((s, e) => s + e._count._all, 0);
  const madres = estados.reduce((s, e) => s + e._count._all, 0);
  const tramos = [
    { etiqueta: "Servidas", valor: n("MATED"), color: "#FAC775" },
    { etiqueta: "Gestantes confirmadas", valor: n("PREGNANT"), color: "#C0DD97" },
    { etiqueta: "En lactancia", valor: n("LACTATING", "FARROWING"), color: "#B5D4F4" },
    { etiqueta: "Vacías", valor: n("EMPTY"), color: "#F7C1C1" },
  ];
  tramos.push({ etiqueta: "Otras", valor: madres - tramos.reduce((s, t) => s + t.valor, 0), color: "#D3D1C7" });
  const actores = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(auditoria.map(a => a.actorId).filter((x): x is string => !!x))) } }, select: { id: true, name: true } });
  const nombre = new Map(actores.map(a => [a.id, a.name]));
  const s = salud[id];

  return (
    <>
      <Link href="/admin/organizaciones" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Organizaciones</Link>
      <div style={{ padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
        Modo plataforma · solo lectura · motivo: {MOTIVOS[motivo.motivo]}{motivo.detalle ? ` (${motivo.detalle})` : ""}. Esta visita quedó registrada y la organización la ve en su actividad.
      </div>

      <div style={{ ...tarjeta, padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>{org.farmName}</span>
            {s && <Semaforo estado={s.estado} etiqueta={SALUD[s.estado].etiqueta} fondo={SALUD[s.estado].fondo} />}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {TIPO[org.tipo] ?? org.tipo} · {org.departamento ?? "sin departamento"}{org.distrito ? `, ${org.distrito}` : ""} · alta {fecha(org.createdAt)} · RUC {org.ruc ?? "—"} · plan {org.plan} · {org.estado}
          </div>
        </div>
        <VerERP organizacionId={id} nombre={org.farmName} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <Tarjeta t="Cerdas" v={madres} d="madres activas" />
        <Tarjeta t={`Plata del mes · ${nombreMes(mes, true)}`} v={gs(ingresos - gastos)} d={`ingresos ${gs(ingresos)} · gastos ${gs(gastos)}`} />
        <Tarjeta t="Personas" v={miembros.filter(m => m.estado === "ACTIVO").length} d={`${activosSemana} activa${activosSemana === 1 ? "" : "s"} esta semana`} />
        <Tarjeta t="Tiempo de uso de la semana" v={`${horas(uso.totalSegundos).toLocaleString("es-PY")} h`} d="estimado, últimos 7 días" />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Este mes: {serviciosMes} servicios · {partosMes} partos · {vivosMes._sum.bornAlive ?? 0} nacidos vivos · {destetesMes._sum.pigletsWeaned ?? 0} destetados
      </div>

      <section style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }} aria-labelledby="cerdas">
        <h2 id="cerdas" style={h2}>Estado de las cerdas</h2>
        <BarraApilada tramos={tramos} />
      </section>

      <section style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }} aria-labelledby="modulos">
        <h2 id="modulos" style={h2}>En qué módulos pasan el tiempo</h2>
        <BarrasH color={i => PASTEL[i % PASTEL.length]} formato={v => `${Math.round(v)} %`} vacio="Todavía no hay tiempo de uso registrado esta semana."
          filas={uso.modulos.map(m => ({ etiqueta: m.etiqueta, valor: m.parte * 100, detalle: `${horas(m.segundos).toLocaleString("es-PY")} h` }))} />
      </section>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0" }}><h2 style={h2}>Miembros ({miembros.length})</h2></div>
        <table className="kp-table" style={{ minWidth: 860 }}>
          <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th style={{ textAlign: "right" }}>Horas de la semana</th><th>Lo que más usa (7 días)</th></tr></thead>
          <tbody>
            {miembros.map(m => (
              <tr key={m.userId}>
                <td><div style={{ color: "var(--text-primary)" }}>{m.perfil.name}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.perfil.tipoAcceso === "GESTIONADA" ? "cuenta de operario" : m.perfil.email}</div></td>
                <td>{m.esPropietario ? "Propietario" : m.rol?.nombre ?? "—"}{m.cargo ? ` · ${m.cargo}` : ""}</td>
                <td>{m.estado}</td>
                <td>{fecha(m.perfil.ultimoAcceso)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{horas(uso.personas.get(m.userId) ?? 0).toLocaleString("es-PY")}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{(uso.modulosPersona.get(m.userId) ?? []).slice(0, 3).map(x => `${x.etiqueta} ${horas(x.segundos).toLocaleString("es-PY")} h`).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 8 }} aria-labelledby="buzon">
        <h2 id="buzon" style={h2}>Mensajes al buzón ({buzonTotal})</h2>
        {buzon.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No mandó mensajes.</div>}
        {buzon.map(b => (
          <Link key={b.id} href={`/admin/buzon?id=${b.id}`} style={{ display: "flex", gap: 8, fontSize: 12.5, textDecoration: "none", color: "var(--text-secondary)", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-muted)" }}>{fecha(b.createdAt)}</span>
            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{TIPO_BUZON[b.tipo] ?? b.tipo}</span>
            <span>{etiquetaModulo(b.modulo)}</span>
            <span style={{ flex: 1, minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo ?? b.mensaje}</span>
            <span>{ESTADO_BUZON[b.estado] ?? b.estado}</span>
          </Link>
        ))}
      </section>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0" }}><h2 style={h2}>Últimos eventos de auditoría</h2></div>
        <table className="kp-table" style={{ minWidth: 640 }}>
          <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Sobre</th></tr></thead>
          <tbody>
            {auditoria.map(a => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }}>{a.createdAt.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{a.actorId ? (nombre.get(a.actorId) ?? "—") : "Sistema"}{a.actorEsPlataforma ? " (plataforma)" : ""}</td>
                <td>{a.accion}</td>
                <td>{a.entidad}</td>
              </tr>
            ))}
            {auditoria.length === 0 && <tr><td colSpan={4} style={{ padding: 16, color: "var(--text-muted)" }}>Sin eventos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
