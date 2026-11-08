import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { MOTIVOS, motivoVigente, registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { gs, hoyUTC, mesDe, nombreMes } from "@/lib/finanzas/calculos";
import { ElegirMotivo } from "./elegir-motivo";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null | undefined) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div></div>;
}

export default async function DetalleOrganizacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const org = await prisma.tenant.findUnique({ where: { id }, select: { id: true, farmName: true, tipo: true, ruc: true, departamento: true, distrito: true, plan: true, estado: true, verificacion: true, createdAt: true } });
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
      </>
    );
  }
  await registrarAcceso({ adminId: admin.usuario.id, organizacionId: id, seccion: `/admin/organizaciones/${id}`, motivo: motivo.motivo, detalle: motivo.detalle });

  const hoy = hoyUTC();
  const mes = mesDe(hoy), anio = Math.floor(mes / 100);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const [miembros, madres, partosMes, vivosMes, destetesMes, serviciosMes, finMes, finAnio, auditoria, aceptaciones, actividad] = await Promise.all([
    prisma.miembro.findMany({ where: { organizacionId: id }, orderBy: [{ esPropietario: "desc" }, { createdAt: "asc" }],
      select: { cargo: true, estado: true, esPropietario: true, rol: { select: { nombre: true } }, perfil: { select: { name: true, email: true, ultimoAcceso: true, tipoAcceso: true } } } }),
    prisma.sow.count({ where: { tenantId: id, isActive: true } }),
    prisma.farrowingEvent.count({ where: { tenantId: id, startDatetime: { gte: inicioMes } } }),
    prisma.farrowingEvent.aggregate({ where: { tenantId: id, startDatetime: { gte: inicioMes } }, _sum: { bornAlive: true } }),
    prisma.weaningEvent.aggregate({ where: { tenantId: id, weaningDate: { gte: inicioMes } }, _sum: { pigletsWeaned: true } }),
    prisma.serviceEvent.count({ where: { tenantId: id, serviceDate: { gte: inicioMes } } }),
    prisma.movimiento.groupBy({ by: ["tipo"], where: { organizacionId: id, mes, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.movimiento.groupBy({ by: ["tipo"], where: { organizacionId: id, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 }, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.auditoria.findMany({ where: { organizacionId: id }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, createdAt: true, accion: true, actorId: true, entidad: true, actorEsPlataforma: true } }),
    prisma.aceptacionDocumento.count({ where: { organizacionId: id } }),
    prisma.actividadDiaria.groupBy({ by: ["fecha"], where: { organizacionId: id, fecha: { gte: new Date(hoy.getTime() - 30 * 86_400_000) } }, _sum: { accesos: true } }),
  ]);
  const suma = (g: typeof finMes, t: string) => g.find(x => x.tipo === t)?._sum.montoGs ?? 0n;
  const actores = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(auditoria.map(a => a.actorId).filter((x): x is string => !!x))) } }, select: { id: true, name: true } });
  const nombre = new Map(actores.map(a => [a.id, a.name]));

  return (
    <>
      <Link href="/admin/organizaciones" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Organizaciones</Link>
      <div style={{ padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
        Modo plataforma · solo lectura · motivo: {MOTIVOS[motivo.motivo]}{motivo.detalle ? ` (${motivo.detalle})` : ""}. Esta visita quedó registrada y la organización la ve en su actividad.
      </div>
      <div style={{ ...tarjeta, padding: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{org.farmName}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {org.tipo} · {org.departamento ?? "sin departamento"}{org.distrito ? `, ${org.distrito}` : ""} · RUC {org.ruc ?? "—"} · plan {org.plan} · {org.estado} · alta {fecha(org.createdAt)}
        </div>
      </div>
      <div style={{ ...tarjeta, padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        <Dato t="Madres activas" v={madres} />
        <Dato t={`Servicios · ${nombreMes(mes, true)}`} v={serviciosMes} />
        <Dato t={`Partos · ${nombreMes(mes, true)}`} v={partosMes} />
        <Dato t="Nacidos vivos del mes" v={vivosMes._sum.bornAlive ?? 0} />
        <Dato t="Destetados del mes" v={destetesMes._sum.pigletsWeaned ?? 0} />
        <Dato t="Ingresos del mes" v={gs(suma(finMes, "INGRESO"))} />
        <Dato t="Gastos del mes" v={gs(suma(finMes, "GASTO"))} />
        <Dato t={`Resultado ${anio}`} v={gs(suma(finAnio, "INGRESO") - suma(finAnio, "GASTO"))} />
        <Dato t="Días con uso (30 días)" v={actividad.length} />
        <Dato t="Aceptaciones de contrato" v={aceptaciones} />
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Miembros ({miembros.length})</div>
        <table className="kp-table" style={{ minWidth: 640 }}>
          <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Último acceso</th></tr></thead>
          <tbody>
            {miembros.map((m, i) => (
              <tr key={i}>
                <td><div style={{ color: "var(--text-primary)" }}>{m.perfil.name}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.perfil.tipoAcceso === "GESTIONADA" ? "cuenta de operario" : m.perfil.email}</div></td>
                <td>{m.esPropietario ? "Propietario" : m.rol?.nombre ?? "—"}{m.cargo ? ` · ${m.cargo}` : ""}</td>
                <td>{m.estado}</td>
                <td>{fecha(m.perfil.ultimoAcceso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Últimos eventos de auditoría</div>
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
