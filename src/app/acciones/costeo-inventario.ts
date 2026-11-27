"use server";
// Inventario · costeo por etapa (Fase 4). La valorización (costo promedio ponderado) y la etapa de cada salida las
// mantiene la base (triggers). Acá: salida manual con etapa, valorizar el stock que entró sin costo y conteo físico.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { requirePermiso, ErrorPermiso } from "@/lib/permisos/servidor";
import { invalidateInventario } from "@/lib/cache";
import { descontarStock } from "@/lib/inventario/descontar";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[costeo-inventario]", e);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}
const refrescar = (org: string) => { invalidateInventario(org); revalidatePath("/inventario"); };
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const mediodia = (s: string) => new Date(`${s}T12:00:00Z`);
const hoyIso = () => new Date().toISOString().slice(0, 10);

async function etapaValida(org: string, codigo: string) {
  if (codigo === "INV") return false;
  return !!(await prisma.etapaCosto.count({ where: { organizacionId: org, codigo, activa: true } }));
}

// ── Salida manual (R5): siempre con etapa; repuestos y ajustes con motivo ──────────────────────────────
const salida = z.object({
  productoId: z.string().min(1).max(40),
  cantidad: z.number().positive("La cantidad tiene que ser mayor a 0.").max(1e9),
  fecha,
  etapaCodigo: z.string().regex(/^[A-Z]{2,5}$/, "Elegí la etapa donde se usa."),
  loteAnimal: z.string().trim().max(80).optional().default(""),
  motivo: z.string().trim().max(300).optional().default(""),
});

export async function registrarSalidaInventario(datos: z.input<typeof salida>): Promise<R<{ aviso?: string }>> {
  try {
    const { session, permisos } = await requirePermiso("stock.salidas.crear");
    const d = salida.parse(datos);
    const org = permisos.organizacionId;
    if (d.fecha > hoyIso()) throw new Error("•La fecha no puede ser futura.");
    const prod = await prisma.productoInventario.findFirst({ where: { id: d.productoId, tenantId: org }, select: { id: true, nombre: true, categoria: true, subcategoriaGastoId: true } });
    if (!prod) throw new Error("•Ese producto no está en tu inventario.");
    if (!(await etapaValida(org, d.etapaCodigo))) throw new Error("•Esa etapa no existe.");
    const sub = prod.subcategoriaGastoId ? await prisma.subcategoriaGasto.findUnique({ where: { id: prod.subcategoriaGastoId }, select: { codigo: true } }) : null;
    if (sub?.codigo === "INS-02" && d.motivo.length < 3) throw new Error("•Los repuestos llevan motivo: escribí para qué se usaron.");
    let aviso: string | undefined;
    await conActor(session.user.id, async tx => {
      const r = await descontarStock(tx, { tenantId: org, productoId: prod.id, cantidad: d.cantidad, origen: "AJUSTE_MANUAL", usuarioId: session.user.id,
        fecha: mediodia(d.fecha), etapaCodigo: d.etapaCodigo, loteAnimal: d.loteAnimal || null, motivo: d.motivo || null, nota: d.motivo || "Salida de inventario" });
      if (r.descontado === 0) throw new Error(`•No hay stock vigente de ${prod.nombre}.`);
      if (r.faltante > 0) aviso = `Faltaron ${r.faltante.toLocaleString("es-PY")}: se descontó lo que había (${r.descontado.toLocaleString("es-PY")}).`;
    });
    refrescar(org);
    return { ok: true, aviso };
  } catch (e) { return manejar(e); }
}

// ── Valorizar el stock que entró sin costo (carga inicial, donaciones…) ─────────────────────────────────
const valorizar = z.object({ productoId: z.string().min(1).max(40), costoUnitario: z.number().positive("Escribí el costo por unidad.").max(1e10) });

export async function valorizarStock(datos: z.input<typeof valorizar>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("stock.items.editar");
    const d = valorizar.parse(datos);
    const org = permisos.organizacionId;
    const prod = await prisma.productoInventario.findFirst({ where: { id: d.productoId, tenantId: org }, select: { id: true } });
    if (!prod) throw new Error("•Ese producto no está en tu inventario.");
    await conActor(session.user.id, async tx => {
      // Solo los lotes sin costo: lo comprado conserva su precio. La base recalcula el promedio.
      const n = await tx.loteInventario.updateMany({ where: { tenantId: org, vacunaId: prod.id, costoUnitario: null }, data: { costoUnitario: d.costoUnitario } });
      if (!n.count) throw new Error("•Este producto ya tiene costo en todos sus lotes.");
      // Las salidas anteriores NO se revalorizan: ese consumo ya está en el libro como compra (no se cuenta dos veces)
    });
    refrescar(org);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Conteo físico mensual (R6): la diferencia genera un ajuste con motivo y queda como indicador ───────────
const conteo = z.object({
  fecha,
  items: z.array(z.object({ productoId: z.string().min(1).max(40), contado: z.number().min(0).max(1e9), motivo: z.string().trim().max(300).optional().default("") })).min(1, "Cargá al menos un producto.").max(500),
});

export async function registrarConteo(datos: z.input<typeof conteo>): Promise<R<{ diferenciaGs: string; ajustes: number }>> {
  try {
    const { session, permisos } = await requirePermiso("stock.inventario_fisico.crear");
    const d = conteo.parse(datos);
    const org = permisos.organizacionId;
    if (d.fecha > hoyIso()) throw new Error("•La fecha no puede ser futura.");
    const ids = [...new Set(d.items.map(i => i.productoId))];
    if (ids.length !== d.items.length) throw new Error("•Hay un producto repetido en el conteo.");
    const prods = await prisma.productoInventario.findMany({ where: { tenantId: org, id: { in: ids } }, select: { id: true, nombre: true, costoPromedio: true, etapaConsumoCodigo: true } });
    if (prods.length !== ids.length) throw new Error("•Uno de los productos no está en tu inventario.");
    const porId = new Map(prods.map(p => [p.id, p]));
    const saldos = new Map((await prisma.loteInventario.groupBy({ by: ["vacunaId"], where: { tenantId: org, vacunaId: { in: ids } }, _sum: { cantidadActual: true } }))
      .map(g => [g.vacunaId, Number(g._sum.cantidadActual ?? 0)]));
    for (const it of d.items) {
      const dif = Math.round((it.contado - (saldos.get(it.productoId) ?? 0)) * 1000) / 1000;
      if (dif !== 0 && it.motivo.length < 3) throw new Error(`•${porId.get(it.productoId)!.nombre}: hay diferencia, escribí el motivo (rotura, vencido, error de carga…).`);
    }
    const fechaMov = mediodia(d.fecha);
    const mes = Number(d.fecha.slice(0, 4)) * 100 + Number(d.fecha.slice(5, 7));
    const res = await conActor(session.user.id, async tx => {
      const cab = await tx.conteoInventario.create({ data: { tenantId: org, fecha: new Date(`${d.fecha}T00:00:00Z`), mes, creadoPor: session.user.id }, select: { id: true } });
      let valorSistema = 0, diferenciaGs = 0, ajustes = 0;
      for (const it of d.items) {
        const p = porId.get(it.productoId)!;
        const saldo = saldos.get(it.productoId) ?? 0;
        const dif = Math.round((it.contado - saldo) * 1000) / 1000;
        const costo = p.costoPromedio != null ? Number(p.costoPromedio) : null;
        valorSistema += costo ? saldo * costo : 0;
        const difGs = costo ? Math.round(dif * costo) : 0;
        diferenciaGs += difGs;
        await tx.conteoInventarioItem.create({ data: { conteoId: cab.id, productoId: p.id, saldoSistema: saldo, contado: it.contado, diferencia: dif, costoUnitario: costo, diferenciaGs: BigInt(difGs), motivo: it.motivo || null } });
        if (dif === 0) continue;
        ajustes++;
        const nota = `Conteo físico del ${d.fecha.split("-").reverse().join("/")}: ${it.motivo}`;
        if (dif < 0) {
          // Falta: se descuenta (primero lo que vence antes, también lo vencido que sigue en el depósito)
          let resta = -dif;
          const lotes = await tx.loteInventario.findMany({ where: { tenantId: org, vacunaId: p.id, cantidadActual: { gt: 0 } }, orderBy: [{ fechaVencimiento: "asc" }, { fechaIngreso: "asc" }], select: { id: true, cantidadActual: true } });
          for (const l of lotes) {
            if (resta <= 0) break;
            const usa = Math.min(Number(l.cantidadActual), resta);
            await tx.loteInventario.update({ where: { id: l.id }, data: { cantidadActual: { decrement: usa } } });
            await tx.movimientoInventario.create({ data: { tenantId: org, productoId: p.id, loteId: l.id, tipo: "AJUSTE", cantidad: -usa, origen: "AJUSTE_MANUAL",
              referenciaId: cab.id, conteoId: cab.id, usuarioId: session.user.id, fecha: fechaMov, motivo: it.motivo, nota, etapaCodigo: p.etapaConsumoCodigo } });
            resta -= usa;
          }
        } else {
          // Sobra: se suma al lote más reciente (o a un lote de ajuste si no hay ninguno)
          let lote = await tx.loteInventario.findFirst({ where: { tenantId: org, vacunaId: p.id }, orderBy: [{ fechaVencimiento: "desc" }], select: { id: true } });
          if (!lote) {
            lote = await tx.loteInventario.create({ data: { tenantId: org, vacunaId: p.id, numeroLote: "AJUSTE-CONTEO", fechaVencimiento: new Date(Date.now() + 365 * 86_400_000),
              cantidadInicial: dif, cantidadActual: 0, costoUnitario: costo, observaciones: "Creado por un conteo físico" }, select: { id: true } });
          }
          await tx.loteInventario.update({ where: { id: lote.id }, data: { cantidadActual: { increment: dif } } });
          await tx.movimientoInventario.create({ data: { tenantId: org, productoId: p.id, loteId: lote.id, tipo: "AJUSTE", cantidad: dif, origen: "AJUSTE_MANUAL",
            referenciaId: cab.id, conteoId: cab.id, usuarioId: session.user.id, fecha: fechaMov, motivo: it.motivo, nota, etapaCodigo: p.etapaConsumoCodigo } });
        }
      }
      await tx.conteoInventario.update({ where: { id: cab.id }, data: { valorSistemaGs: BigInt(Math.round(valorSistema)), diferenciaGs: BigInt(diferenciaGs) } });
      return { diferenciaGs, ajustes };
    });
    refrescar(org);
    return { ok: true, diferenciaGs: String(res.diferenciaGs), ajustes: res.ajustes };
  } catch (e) { return manejar(e); }
}
