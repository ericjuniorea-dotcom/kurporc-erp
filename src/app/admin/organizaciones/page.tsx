// Organizaciones (Fase 15.4): salud, plata del mes y tiempo de la semana; filtros por tipo y salud; orden por columna.
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/acceso";
import { organizacionesPlataforma } from "@/lib/admin/datos";
import { saludOrganizaciones, SALUD, type Salud } from "@/lib/admin/salud";
import { horas, usoPorOrganizacion } from "@/lib/admin/uso";
import { Semaforo } from "@/components/admin/barras";
import { gs } from "@/lib/finanzas/calculos";
import { FilaEnlace } from "../fila-enlace";
import { VerERP } from "../ver-erp";

export const dynamic = "force-dynamic";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const TIPO: Record<string, string> = { EMPRESA: "Empresa", INDIVIDUAL: "Productor", VENDEDOR: "Tienda" };
const COLUMNAS = [
  ["nombre", "Organización"], ["tipo", "Tipo"], ["salud", "Salud"], ["madres", "Madres"], ["miembros", "Miembros"],
  ["plata", "Plata del mes"], ["tiempo", "Tiempo esta semana"], ["actividad", "Última actividad"],
] as const;
type Orden = (typeof COLUMNAS)[number][0];
const NUMERICAS: Orden[] = ["madres", "miembros", "plata", "tiempo"];
const chip = (on: boolean) => (on ? "btn btn-primary" : "btn");

export default async function OrganizacionesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const sp = await searchParams;
  const [orgs, salud, tiempo] = await Promise.all([organizacionesPlataforma(), saludOrganizaciones(), usoPorOrganizacion(7)]);
  const tipo = sp.tipo && sp.tipo in TIPO ? sp.tipo : null;
  const filtroSalud = sp.salud && sp.salud in SALUD ? (sp.salud as Salud) : null;
  const orden: Orden = COLUMNAS.find(c => c[0] === sp.orden)?.[0] ?? "salud";
  // Por defecto: salud de peor a mejor y texto A→Z; los números, de mayor a menor
  const ascendente = sp.dir ? sp.dir === "asc" : !NUMERICAS.includes(orden) && orden !== "actividad";

  const filas = orgs
    .map(o => ({ ...o, salud: salud[o.id]?.estado ?? null, plata: o.ingresosMesGs + o.gastosMesGs, segundos: tiempo.get(o.id) ?? 0 }))
    .filter(o => (!tipo || o.tipo === tipo) && (!filtroSalud || o.salud === filtroSalud));
  const valor = (o: (typeof filas)[number]): number | string => {
    switch (orden) {
      case "nombre": return o.farmName.toLowerCase();
      case "tipo": return o.tipo;
      case "salud": return o.salud ? SALUD[o.salud].orden : 9;
      case "madres": return o.madres;
      case "miembros": return o.miembros;
      case "plata": return Number(o.plata);
      case "tiempo": return o.segundos;
      case "actividad": return o.ultimaActividad?.getTime() ?? 0;
    }
  };
  filas.sort((a, b) => { const x = valor(a), y = valor(b); return (x < y ? -1 : x > y ? 1 : 0) * (ascendente ? 1 : -1); });

  const url = (c: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ tipo, salud: filtroSalud, orden: sp.orden ?? null, dir: sp.dir ?? null, ...c })) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/organizaciones${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <nav aria-label="Tipo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link href={url({ tipo: null })} className={chip(!tipo)} style={{ height: 28, fontSize: 12 }}>Todas</Link>
          {Object.entries(TIPO).map(([k, v]) => <Link key={k} href={url({ tipo: k })} className={chip(tipo === k)} style={{ height: 28, fontSize: 12 }}>{v}</Link>)}
        </nav>
        <nav aria-label="Salud" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link href={url({ salud: null })} className={chip(!filtroSalud)} style={{ height: 28, fontSize: 12 }}>Toda salud</Link>
          {(Object.keys(SALUD) as Salud[]).map(k => (
            <Link key={k} href={url({ salud: k })} className={chip(filtroSalud === k)} style={{ height: 28, fontSize: 12, gap: 6 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: SALUD[k].fondo }} />{SALUD[k].etiqueta}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              {COLUMNAS.map(([k, t]) => {
                const on = orden === k;
                return (
                  <th key={k} style={{ textAlign: NUMERICAS.includes(k) ? "right" : "left" }} aria-sort={on ? (ascendente ? "ascending" : "descending") : undefined}>
                    <Link href={url({ orden: k, dir: on ? (ascendente ? "desc" : "asc") : null })} style={{ color: "inherit", textDecoration: "none" }}>{t}{on ? (ascendente ? " ↑" : " ↓") : ""}</Link>
                  </th>
                );
              })}
              <th aria-label="Ver ERP" />
            </tr>
          </thead>
          <tbody>
            {filas.map(o => (
              <FilaEnlace key={o.id} href={`/admin/organizaciones/${o.id}`}>
                <td>
                  <Link href={`/admin/organizaciones/${o.id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>{o.farmName}</Link>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.departamento ?? "sin departamento"} · alta {fecha(o.createdAt)}</div>
                </td>
                <td>{TIPO[o.tipo] ?? o.tipo}</td>
                <td>{o.salud ? <Semaforo estado={o.salud} etiqueta={SALUD[o.salud].etiqueta} fondo={SALUD[o.salud].fondo} /> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.madres}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.miembros}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(o.plata)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{horas(o.segundos).toLocaleString("es-PY")} h</td>
                <td>{fecha(o.ultimaActividad)}</td>
                <td style={{ textAlign: "right" }}><VerERP organizacionId={o.id} nombre={o.farmName} chico /></td>
              </FilaEnlace>
            ))}
            {filas.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No hay organizaciones con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Salud: <strong style={{ fontWeight: 500 }}>en riesgo</strong> = sin uso hace 14 días o más, o más de 7 días desde el alta sin haber cargado datos nunca ·{" "}
        <strong style={{ fontWeight: 500 }}>bien</strong> = usó y cargó datos en los últimos 7 días, con los primeros pasos completos ·{" "}
        <strong style={{ fontWeight: 500 }}>nuevo</strong> = alta de menos de 7 días · el resto, <strong style={{ fontWeight: 500 }}>a mirar</strong>. Las tiendas no tienen semáforo.
        Plata del mes = ingresos + gastos registrados. Tiempo = uso estimado de los últimos 7 días. Se actualiza cada 10 minutos.
      </div>
    </>
  );
}
