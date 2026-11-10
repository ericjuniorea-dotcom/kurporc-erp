// Explorador de solo lectura de todas las tablas de una organización (Fase 11). Cada consulta,
// cada "Mostrar" de un dato personal y cada exportación quedan en acceso_plataforma.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { MOTIVOS, motivoVigente, registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { consultar, enmascarar, esSensible, LIMITE, tablasConOrganizacion } from "@/lib/admin/explorador";
import { ElegirMotivo } from "../organizaciones/[id]/elegir-motivo";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
type SP = { org?: string; tabla?: string; col?: string; val?: string; desde?: string; hasta?: string; p?: string; mostrar?: string };

function enlace(sp: SP, cambios: Partial<SP>, ruta = "/admin/datos") {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...cambios })) if (v) u.set(k, String(v));
  return `${ruta}?${u.toString()}`;
}

export default async function ExploradorDatos({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin(["TOTAL", "SOPORTE"]);
  const sp = await searchParams;
  const orgs = await prisma.tenant.findMany({ orderBy: { farmName: "asc" }, select: { id: true, farmName: true, tipo: true } });
  const org = orgs.find(o => o.id === sp.org);

  const selectorOrg = (
    <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select name="org" className="kp-input" defaultValue={org?.id ?? ""} style={{ minWidth: 260 }} aria-label="Organización">
        <option value="">Elegí una organización…</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.farmName} · {o.tipo}</option>)}
      </select>
      <button className="btn" type="submit" style={{ height: 34 }}>Abrir</button>
    </form>
  );
  const intro = <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Solo lectura. Cada consulta y cada exportación quedan registradas y la organización las ve en su actividad. Los datos personales aparecen enmascarados; las contraseñas y los tokens no se muestran nunca.</div>;
  if (!org) return <>{intro}{selectorOrg}</>;

  const motivo = await motivoVigente(org.id);
  if (!motivo) return <>{intro}{selectorOrg}<ElegirMotivo organizacionId={org.id} nombre={org.farmName} motivos={MOTIVOS} /></>;

  const tablas = await tablasConOrganizacion();
  const tabla = tablas.find(t => t.tabla === sp.tabla)?.tabla;
  const banner = (
    <div style={{ padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
      Modo plataforma · solo lectura · {org.farmName} · motivo: {MOTIVOS[motivo.motivo]}{motivo.detalle ? ` (${motivo.detalle})` : ""}
    </div>
  );
  const formTabla = (
    <form method="get" style={{ ...tarjeta, padding: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <input type="hidden" name="org" value={org.id} />
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>Tabla
        <select name="tabla" className="kp-input" defaultValue={tabla ?? ""} style={{ minWidth: 220 }}>
          <option value="">Elegí una tabla…</option>
          {tablas.map(t => <option key={t.tabla} value={t.tabla}>{t.tabla}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>Columna
        <input name="col" className="kp-input" defaultValue={sp.col ?? ""} placeholder="ej. estado" style={{ width: 140 }} />
      </label>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>Contiene
        <input name="val" className="kp-input" defaultValue={sp.val ?? ""} style={{ width: 140 }} />
      </label>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>Desde
        <input name="desde" type="date" className="kp-input" defaultValue={sp.desde ?? ""} />
      </label>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>Hasta
        <input name="hasta" type="date" className="kp-input" defaultValue={sp.hasta ?? ""} />
      </label>
      <button className="btn btn-primary" type="submit" style={{ height: 34 }}>Consultar</button>
    </form>
  );
  if (!tabla) {
    await registrarAcceso({ adminId: admin.usuario.id, organizacionId: org.id, seccion: "/admin/datos", motivo: motivo.motivo, detalle: motivo.detalle });
    return <>{banner}{selectorOrg}{formTabla}</>;
  }

  const pagina = Math.max(0, Number(sp.p) || 0);
  const r = await consultar({ tabla, organizacionId: org.id, columna: sp.col, valor: sp.val, desde: sp.desde, hasta: sp.hasta, pagina });
  const mostrar = new Set((sp.mostrar ?? "").split(",").filter(c => c && esSensible(c) && r.columnas.some(x => x.nombre === c)));
  await registrarAcceso({ adminId: admin.usuario.id, organizacionId: org.id, seccion: `datos:${tabla}`, motivo: motivo.motivo, detalle: motivo.detalle, filas: r.filas.length });
  for (const c of mostrar) await registrarAcceso({ adminId: admin.usuario.id, organizacionId: org.id, seccion: `datos:${tabla}.${c} (mostrar dato personal)`, motivo: motivo.motivo, detalle: motivo.detalle, filas: r.filas.length });

  const paginas = Math.ceil(r.total / LIMITE);
  return (
    <>
      {banner}{selectorOrg}{formTabla}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-secondary)" }}>
        <span>{r.total.toLocaleString("es-PY")} filas{r.fechaCol ? ` · ordenadas por ${r.fechaCol}, más recientes primero` : ""}{paginas > 1 ? ` · página ${pagina + 1} de ${paginas}` : ""}</span>
        <span style={{ display: "flex", gap: 6 }}>
          {pagina > 0 && <Link className="btn" style={{ height: 30, fontSize: 12 }} href={enlace(sp, { p: String(pagina - 1) })}>← Anterior</Link>}
          {pagina + 1 < paginas && <Link className="btn" style={{ height: 30, fontSize: 12 }} href={enlace(sp, { p: String(pagina + 1) })}>Siguiente →</Link>}
          {/* Descarga directa: el route handler vuelve a validar y registra la exportación */}
          <a className="btn" style={{ height: 30, fontSize: 12 }} href={enlace(sp, { p: undefined }, "/admin/datos/csv")}>Exportar CSV</a>
        </span>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>{r.columnas.map(c => (
              <th key={c.nombre} style={{ whiteSpace: "nowrap" }}>
                {c.nombre}
                {esSensible(c.nombre) && !mostrar.has(c.nombre) && (
                  <Link href={enlace(sp, { mostrar: [...mostrar, c.nombre].join(",") })} style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "var(--accent)" }}>Mostrar</Link>
                )}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {r.filas.map((f, i) => (
              <tr key={i}>{r.columnas.map(c => {
                const v = f[c.nombre];
                const txt = v === null ? "—" : esSensible(c.nombre) && !mostrar.has(c.nombre) ? enmascarar(v) : v;
                return <td key={c.nombre} title={txt.length > 60 ? txt : undefined} style={{ whiteSpace: "nowrap", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", color: v === null ? "var(--text-muted)" : undefined }}>{txt}</td>;
              })}</tr>
            ))}
            {r.filas.length === 0 && <tr><td colSpan={r.columnas.length} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sin filas para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
