// Cola de verificación de tiendas del Mercado (Fase 11). TOTAL, SOPORTE y MODERACION.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { DecisionVendedor } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date) => d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
const PESTANAS = [["PENDIENTE", "Pendientes"], ["VERIFICADA", "Verificadas"], ["RECHAZADA", "Rechazadas"]] as const;

export default async function VendedoresAdmin({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const a = await requireAdmin(["TOTAL", "SOPORTE", "MODERACION"]);
  const { estado: e } = await searchParams;
  const estado = PESTANAS.some(([k]) => k === e) ? e! : "PENDIENTE";
  const [conteo, tiendas] = await Promise.all([
    prisma.tenant.groupBy({ by: ["verificacion"], where: { tipo: "VENDEDOR" }, _count: { _all: true } }),
    prisma.tenant.findMany({
      where: { tipo: "VENDEDOR", verificacion: estado as "PENDIENTE" | "VERIFICADA" | "RECHAZADA" }, orderBy: { createdAt: "asc" },
      select: { id: true, farmName: true, razonSocial: true, ruc: true, rubro: true, departamento: true, distrito: true, whatsapp: true, createdAt: true, estado: true,
        miembros: { where: { esPropietario: true }, select: { perfil: { select: { name: true, email: true } } } } },
    }),
  ]);
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: `/admin/vendedores?estado=${estado}`, motivo: "SOPORTE", filas: tiendas.length });
  const n = (k: string) => conteo.find(c => c.verificacion === k)?._count._all ?? 0;
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Una tienda se verifica sola cuando su RUC figura activo en el padrón de la DNIT. Las que no, quedan acá: revisá el RUC y la razón social y aprobá o rechazá con motivo (la tienda lo ve y recibe un aviso).
      </div>
      <nav style={{ display: "flex", gap: 6 }}>
        {PESTANAS.map(([k, l]) => (
          <Link key={k} href={`/admin/vendedores?estado=${k}`} className="btn" aria-current={k === estado ? "page" : undefined}
            style={{ height: 30, fontSize: 12, fontWeight: k === estado ? 600 : 400, background: k === estado ? "var(--bg-subtle)" : undefined }}>{l} ({n(k)})</Link>
        ))}
      </nav>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Tienda</th><th>RUC y razón social</th><th>Responsable</th><th>Ubicación</th><th>Alta</th><th>Decisión</th></tr></thead>
          <tbody>
            {tiendas.map(t => (
              <tr key={t.id}>
                <td><div style={{ fontWeight: 500 }}>{t.farmName}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.rubro ?? "—"}{t.estado !== "ACTIVA" ? ` · ${t.estado}` : ""}</div></td>
                <td><div>{t.ruc ?? "—"}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.razonSocial ?? "—"}</div></td>
                <td>{t.miembros.map((m, i) => <div key={i}>{m.perfil.name}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.perfil.email}{t.whatsapp ? ` · ${t.whatsapp}` : ""}</div></div>)}</td>
                <td>{t.departamento ?? "—"}{t.distrito ? `, ${t.distrito}` : ""}</td>
                <td>{fecha(t.createdAt)}</td>
                <td><DecisionVendedor id={t.id} estado={estado} /></td>
              </tr>
            ))}
            {tiendas.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No hay tiendas en este estado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Las calificaciones de cada tienda aparecen cuando el Mercado tenga pedidos (Fase 13).</div>
    </>
  );
}
