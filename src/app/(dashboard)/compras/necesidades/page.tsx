// "Lo que te va a faltar" (Fase 14.5): stock, consumo proyectado, fecha de quiebre y cuánto pedir.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { calcularNecesidades } from "@/lib/necesidades/datos";
import { TablaNecesidades } from "./tabla";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const ORDEN = { CRITICA: 0, PRONTO: 1, OK: 2, SIN_DATOS: 3 } as const;

export default async function Necesidades() {
  const permisos = (await getPermisos())!;
  if (!puede(permisos, "compras.necesidades.ver")) return <div style={{ fontSize: 13.5 }}>No tenés permiso para ver «Lo que te va a faltar».</div>;
  const org = permisos.organizacionId;
  const [{ filas, calculadoEn }, productos, granja, tenant] = await Promise.all([
    calcularNecesidades(org),
    prisma.productoCatalogo.findMany({ where: { aprobado: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, unidadBase: true } }),
    prisma.granja.findFirst({ where: { organizacionId: org, activa: true }, orderBy: { createdAt: "asc" }, select: { departamento: true } }),
    prisma.tenant.findUnique({ where: { id: org }, select: { departamento: true } }),
  ]);
  filas.sort((a, b) => ORDEN[a.urgencia] - ORDEN[b.urgencia] || (a.coberturaDias ?? 999) - (b.coberturaDias ?? 999));
  const criticas = filas.filter(f => f.urgencia === "CRITICA").length, pronto = filas.filter(f => f.urgencia === "PRONTO").length, sinDatos = filas.filter(f => f.urgencia === "SIN_DATOS").length;
  const hora = calculadoEn.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", timeZone: "America/Asuncion" });

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[["Crítica", criticas, "var(--danger-subtle)", "var(--danger-text)", "se termina antes de que llegue el pedido"], ["Pronto", pronto, "var(--warning-subtle)", "var(--warning-text)", "pedilo esta semana"], ["Sin datos", sinDatos, "var(--bg-subtle)", "var(--text-muted)", "sin consumo para estimar"]].map(([t, v, bg, fg, sub]) => (
          <div key={t as string} style={{ ...tarjeta, padding: "10px 14px", minWidth: 170, background: bg as string }}>
            <div style={{ fontSize: 11.5, color: fg as string, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 22, fontWeight: 650, color: fg as string }}>{v as number}</div>
            <div style={{ fontSize: 11, color: fg as string }}>{sub}</div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "flex-end", marginLeft: "auto", textAlign: "right" }}>
          Calculado a las {hora} · se recalcula cada 30 minutos y todos los días a las 5:00<br />
          <Link href="/compras/necesidades/precision">¿Qué tan preciso es? →</Link>
        </div>
      </div>
      {filas.length === 0 ? (
        <div style={{ ...tarjeta, padding: 24, fontSize: 13.5, color: "var(--text-secondary)", textAlign: "center" }}>
          Todavía no tenés productos en stock. Cargalos en <Link href="/logistica">Logística</Link> o recibí tu primer pedido del Mercado y aparecen acá.
        </div>
      ) : (
        <TablaNecesidades filas={filas.map(f => ({ ...f, fechaQuiebre: f.fechaQuiebre?.toISOString().slice(0, 10) ?? null }))}
          productos={productos.map(p => ({ id: p.id, nombre: p.nombre, unidad: p.unidadBase.toLowerCase() }))}
          departamento={granja?.departamento ?? tenant?.departamento ?? ""}
          puedeConfigurar={puede(permisos, "compras.necesidades.configurar")} puedeCotizar={puede(permisos, "compras.cotizaciones.crear")} puedePedir={puede(permisos, "compras.pedidos.crear")} />
      )}
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Cómo se calcula: el balanceado, por ración según tus cerdas, los partos y destetes que vienen y la curva de engorde (Finanzas → Parámetros); las vacunas y medicamentos, por el calendario sanitario, con frascos enteros por día de aplicación; el resto, por tus salidas de stock de las últimas 8 semanas.
        Pedir = lo que vas a consumir durante el plazo del proveedor + los días de seguridad + el ciclo de compra, menos lo que tenés y lo que viene en camino, redondeado a cómo comprás.
      </div>
    </>
  );
}
