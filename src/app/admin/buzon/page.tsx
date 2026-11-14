// Fase 15.2 · Buzón del Super Administrador: todo lo que mandan con «Ayuda y sugerencias», categorizado.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";
import { demanda, ESTADOS_BUZON, PRIORIDADES, TIPOS_BUZON } from "@/lib/buzon/datos";
import { CLAVES_MODULO, MODULOS } from "@/lib/modulos";
import { CORREO_SOPORTE } from "@/lib/contacto";
import { FilaBuzon } from "./fila";
import { PestanasBuzon } from "./pestanas";

export const dynamic = "force-dynamic";

const ETIQUETA_TIPO: Record<string, string> = { PROBLEMA: "Problemas", CONSULTA: "Dudas", SUGERENCIA: "Ideas", FUNCION_NUEVA: "Funciones nuevas" };
const ESTADO_FILTRO = { ABIERTAS: "Abiertas", ...ESTADOS_BUZON, TODAS: "Todas" } as const;

export default async function Buzon({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const sp = await searchParams;
  const tipo = sp.tipo && sp.tipo in TIPOS_BUZON ? sp.tipo : null;
  const estado = sp.estado && sp.estado in ESTADO_FILTRO ? sp.estado : "ABIERTAS";
  const modulo = sp.modulo && sp.modulo in MODULOS ? sp.modulo : null;
  const prioridad = sp.prioridad && sp.prioridad in PRIORIDADES ? sp.prioridad : null;
  const conVotos = sp.votos === "1";
  const esperan = sp.esperan === "1";
  const orden = sp.orden === "pedidas" ? "pedidas" : "recientes";
  const unId = sp.id && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : null;

  const base: Prisma.SugerenciaWhereInput = {
    agrupadaEn: null,
    ...(estado === "ABIERTAS" ? { estado: { in: ["NUEVA", "EN_REVISION", "EN_DESARROLLO"] } } : estado === "TODAS" ? {} : { estado }),
    ...(modulo ? { modulo } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(conVotos ? { votos: { some: {} } } : {}),
  };
  const where: Prisma.SugerenciaWhereInput = unId ? { id: unId } : { ...base, ...(tipo ? { tipo } : {}) };
  const [filas, porTipo, candidatos] = await Promise.all([
    prisma.sugerencia.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { agrupadas: { orderBy: { createdAt: "desc" }, include: { mensajes: { orderBy: { createdAt: "asc" } } } }, mensajes: { orderBy: { createdAt: "asc" } } } }),
    prisma.sugerencia.groupBy({ by: ["tipo"], where: base, _count: { _all: true } }),
    prisma.sugerencia.findMany({
      where: { agrupadaEn: null, tipo: { in: ["FUNCION_NUEVA", "SUGERENCIA"] }, estado: { not: "DESCARTADA" } },
      orderBy: { createdAt: "desc" }, take: 150, select: { id: true, titulo: true, tituloPublico: true, mensaje: true },
    }),
  ]);
  // «Esperan respuesta»: abiertas cuyo último mensaje es del cliente (o que nunca respondimos)
  const esperaRespuesta = (f: { estado: string; mensajes: { dePlataforma: boolean }[] }) =>
    !["HECHA", "DESCARTADA"].includes(f.estado) && (f.mensajes.length === 0 || !f.mensajes[f.mensajes.length - 1].dePlataforma);
  if (esperan) for (let i = filas.length - 1; i >= 0; i--) if (!esperaRespuesta(filas[i])) filas.splice(i, 1);
  const n = await demanda(filas.map(f => f.id));
  if (orden === "pedidas") filas.sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());

  const todos = [...filas, ...filas.flatMap(f => f.agrupadas)];
  const ids = Array.from(new Set(todos.map(f => f.usuarioId)));
  const orgIds = Array.from(new Set(todos.map(f => f.organizacionId).filter((x): x is string => !!x)));
  const [personas, orgs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    prisma.tenant.findMany({ where: { id: { in: orgIds } }, select: { id: true, farmName: true } }),
  ]);
  const quien = new Map(personas.map(p => [p.id, { nombre: p.name || p.email, email: p.email }]));
  const org = new Map(orgs.map(o => [o.id, o.farmName]));
  const conteo = new Map(porTipo.map(c => [c.tipo, c._count._all]));
  const total = porTipo.reduce((s, c) => s + c._count._all, 0);

  const url = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const actual: Record<string, string | null> = { tipo, estado, modulo, prioridad, votos: conVotos ? "1" : null, esperan: esperan ? "1" : null, orden: orden === "pedidas" ? "pedidas" : null, ...cambios };
    for (const [k, v] of Object.entries(actual)) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/buzon${s ? `?${s}` : ""}`;
  };
  const fila = (f: (typeof filas)[number]["agrupadas"][number]) => ({
    mensajes: f.mensajes.map(m => ({ id: m.id, dePlataforma: m.dePlataforma, texto: m.texto, fecha: m.createdAt.toISOString() })),
    esperaRespuesta: esperaRespuesta(f),
    id: f.id, tipo: f.tipo, modulo: f.modulo, prioridad: f.prioridad, mensaje: f.mensaje, titulo: f.titulo, problema: f.problema, comoFuncionaria: f.comoFuncionaria,
    pagina: f.pagina, estado: f.estado, respuesta: f.respuesta, fecha: f.createdAt.toISOString(),
    persona: quien.get(f.usuarioId)?.nombre ?? "—", email: quien.get(f.usuarioId)?.email ?? null,
    organizacion: f.organizacionId ? org.get(f.organizacionId) ?? null : null,
    publica: f.publica, tituloPublico: f.tituloPublico, descripcionPublica: f.descripcionPublica, agrupadaEn: f.agrupadaEn,
  });

  return (
    <>
      <PestanasBuzon activa="bandeja" />
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Lo que mandan las personas con «Ayuda y sugerencias». Lo que respondas acá lo ven en ese mismo botón y reciben un aviso.
        Los correos a {CORREO_SOPORTE} llegan a esa casilla, no a esta bandeja.
      </div>
      {unId ? (
        <Link href="/admin/buzon" className="btn" style={{ height: 30, fontSize: 12, alignSelf: "flex-start" }}>Ver toda la bandeja</Link>
      ) : (
        <>
          <nav aria-label="Tipo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link href={url({ tipo: null })} className={!tipo ? "btn btn-primary" : "btn"} style={{ height: 30, fontSize: 12 }}>Todo ({total})</Link>
            {Object.keys(TIPOS_BUZON).map(k => (
              <Link key={k} href={url({ tipo: k })} className={k === tipo ? "btn btn-primary" : "btn"} style={{ height: 30, fontSize: 12 }}>
                {ETIQUETA_TIPO[k]} ({conteo.get(k) ?? 0})
              </Link>
            ))}
          </nav>
          <form method="get" action="/admin/buzon" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
            {tipo && <input type="hidden" name="tipo" value={tipo} />}
            <select name="estado" defaultValue={estado} className="kp-input" aria-label="Estado" style={{ height: 30, width: "auto" }}>
              {Object.entries(ESTADO_FILTRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="modulo" defaultValue={modulo ?? ""} className="kp-input" aria-label="Módulo" style={{ height: 30, width: "auto" }}>
              <option value="">Todos los módulos</option>
              {CLAVES_MODULO.map(k => <option key={k} value={k}>{MODULOS[k].etiqueta}</option>)}
            </select>
            <select name="prioridad" defaultValue={prioridad ?? ""} className="kp-input" aria-label="Prioridad" style={{ height: 30, width: "auto" }}>
              <option value="">Toda prioridad</option>
              {Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="orden" defaultValue={orden} className="kp-input" aria-label="Orden" style={{ height: 30, width: "auto" }}>
              <option value="recientes">Más recientes</option>
              <option value="pedidas">Más pedidas</option>
            </select>
            <label style={{ display: "inline-flex", gap: 4, alignItems: "center", color: "var(--text-secondary)" }}>
              <input type="checkbox" name="votos" value="1" defaultChecked={conVotos} /> Con votos
            </label>
            <label style={{ display: "inline-flex", gap: 4, alignItems: "center", color: "var(--text-secondary)" }}>
              <input type="checkbox" name="esperan" value="1" defaultChecked={esperan} /> Esperan respuesta
            </label>
            <button type="submit" className="btn" style={{ height: 30, fontSize: 12 }}>Filtrar</button>
          </form>
        </>
      )}
      {filas.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay nada con estos filtros.</div>}
      {filas.map(f => (
        <FilaBuzon key={f.id} s={fila(f)} pedidas={n.get(f.id) ?? 1} agrupadas={f.agrupadas.map(fila)}
          candidatos={candidatos.filter(c => c.id !== f.id).map(c => ({ id: c.id, etiqueta: (c.tituloPublico ?? c.titulo ?? c.mensaje).slice(0, 70) }))} />
      ))}
    </>
  );
}
