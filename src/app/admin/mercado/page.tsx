// Cómo se mueve el Mercado (Fase 11). Pedidos, GMV, ticket y tiempo de respuesta llegan con la Fase 13.
import prisma from "@/lib/db/prisma";
import { registrarAcceso, requireAdmin } from "@/lib/admin/acceso";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

function Dato({ t, v, sub }: { t: string; v: React.ReactNode; sub?: string }) {
  return <div style={{ ...tarjeta, padding: 14 }}><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t}</div><div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</div>{sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</div>}</div>;
}

export default async function MercadoAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE", "MODERACION", "LECTURA"]);
  const hace30 = new Date(Date.now() - 30 * 86_400_000);
  const [tiendas, verificadas, conActivas, porEstado, nuevas30, favoritos, denuncias, porCategoria, cats] = await Promise.all([
    prisma.tenant.count({ where: { tipo: "VENDEDOR", estado: "ACTIVA" } }),
    prisma.tenant.count({ where: { tipo: "VENDEDOR", estado: "ACTIVA", verificacion: "VERIFICADA" } }),
    prisma.publicacion.groupBy({ by: ["tiendaId"], where: { estado: "ACTIVA" } }).then(r => r.length),
    prisma.publicacion.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.publicacion.count({ where: { createdAt: { gte: hace30 } } }),
    prisma.favorito.count(),
    prisma.denunciaPublicacion.count({ where: { estado: "ABIERTA" } }),
    prisma.publicacion.groupBy({ by: ["categoriaId"], where: { estado: "ACTIVA" }, _count: { _all: true } }),
    prisma.categoriaMercado.findMany({ select: { id: true, nombre: true, padreId: true } }),
  ]);
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: "/admin/mercado", motivo: "ESTADISTICA" });
  const n = (e: string) => porEstado.find(x => x.estado === e)?._count._all ?? 0;
  // Agrupado por categoría principal
  const raiz = (id: string) => { const c = cats.find(x => x.id === id); return c?.padreId ? cats.find(x => x.id === c.padreId) : c; };
  const porRaiz = new Map<string, number>();
  for (const g of porCategoria) { const r = raiz(g.categoriaId); if (r) porRaiz.set(r.nombre, (porRaiz.get(r.nombre) ?? 0) + g._count._all); }
  const filas = Array.from(porRaiz).sort((x, y) => y[1] - x[1]);
  const max = Math.max(1, ...filas.map(f => f[1]));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <Dato t="Tiendas activas" v={tiendas} sub={`${verificadas} verificadas · ${conActivas} con publicaciones`} />
        <Dato t="Publicaciones activas" v={n("ACTIVA")} sub={`${n("BORRADOR")} borradores · ${n("PAUSADA")} pausadas · ${n("RECHAZADA")} rechazadas`} />
        <Dato t="Nuevas en 30 días" v={nuevas30} />
        <Dato t="Favoritos guardados" v={favoritos} />
        <Dato t="Denuncias abiertas" v={denuncias} />
      </div>
      <div style={{ ...tarjeta, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Publicaciones activas por categoría</div>
        {filas.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Todavía no hay publicaciones activas.</div>}
        {filas.map(([nombre, v]) => (
          <div key={nombre} style={{ display: "grid", gridTemplateColumns: "180px 1fr 40px", gap: 10, alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
            <span>{nombre}</span>
            <div style={{ height: 10, background: "var(--bg-subtle)", borderRadius: 4 }}><div style={{ width: `${(v / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4, opacity: 0.7 }} /></div>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>GMV, pedidos por estado, ticket promedio, tasa cotización → pedido y tiempo de respuesta aparecen cuando se habiliten los pedidos (Fase 13).</div>
    </>
  );
}
