// Bandeja de consultas, problemas y sugerencias que manda la gente desde la app.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";
import { FilaSugerencia } from "./fila";

const ESTADOS = { NUEVA: "Nuevas", EN_REVISION: "En revisión", HECHA: "Hechas", DESCARTADA: "Descartadas" } as const;

export default async function SugerenciasAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const sp = await searchParams;
  const estado = sp.estado && sp.estado in ESTADOS ? sp.estado : "NUEVA";
  const [filas, conteo] = await Promise.all([
    prisma.sugerencia.findMany({ where: { estado }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.sugerencia.groupBy({ by: ["estado"], _count: { _all: true } }),
  ]);
  const ids = Array.from(new Set(filas.map(f => f.usuarioId)));
  const orgIds = Array.from(new Set(filas.map(f => f.organizacionId).filter((x): x is string => !!x)));
  const [personas, orgs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    prisma.tenant.findMany({ where: { id: { in: orgIds } }, select: { id: true, farmName: true } }),
  ]);
  const quien = new Map(personas.map(p => [p.id, { nombre: p.name || p.email, email: p.email }]));
  const org = new Map(orgs.map(o => [o.id, o.farmName]));
  const n = new Map(conteo.map(c => [c.estado, c._count._all]));

  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Lo que mandan las personas con el botón «Ayuda y sugerencias». Lo que respondas acá lo ven en ese mismo botón.
        Los correos a soporte@kurporc.com llegan a esa casilla, no a esta bandeja.
      </div>
      <nav aria-label="Estado" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <Link key={k} href={`/admin/sugerencias?estado=${k}`} className={k === estado ? "btn btn-primary" : "btn"} style={{ height: 30, fontSize: 12 }}>
            {v} ({n.get(k) ?? 0})
          </Link>
        ))}
      </nav>
      {filas.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay nada en esta bandeja.</div>}
      {filas.map(f => (
        <FilaSugerencia key={f.id} s={{
          id: f.id, tipo: f.tipo, mensaje: f.mensaje, pagina: f.pagina, estado: f.estado, respuesta: f.respuesta,
          fecha: f.createdAt.toISOString(), persona: quien.get(f.usuarioId)?.nombre ?? "—", email: quien.get(f.usuarioId)?.email ?? null,
          organizacion: f.organizacionId ? org.get(f.organizacionId) ?? null : null,
        }} />
      ))}
    </>
  );
}
