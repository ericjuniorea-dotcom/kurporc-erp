import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede, type Permisos } from "@/lib/permisos/servidor";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

/** Eliminar una genética: solo el dueño, el Administrador general o el Jefe de producción. */
function puedeEliminarGenetica(p: Permisos | null): boolean {
  return !!p && (p.esPropietario || p.rol === "ADMIN_GENERAL" || p.rol === "JEFE_PRODUCCION");
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "configuracion.parametros_productivos.editar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "configuracion.parametros_productivos.editar" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const genetica = await prisma.genetica.findFirst({ where: { id: params.id, tenantId } });
  if (!genetica) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Nunca se aceptan desde el cliente: id, organización ni fechas de sistema (evita mover el registro a otra organización)
  const { id: _id, tenantId: _t, createdAt: _c, updatedAt: _u, ...body } = await req.json();
  const updated = await prisma.genetica.update({ where: { id: params.id }, data: { ...body, updatedAt: new Date() } });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeEliminarGenetica(await getPermisos())) return NextResponse.json({ error: "Solo el Administrador o el Jefe de producción pueden eliminar una genética." }, { status: 403 });
  const tenantId = session.user.tenantId;

  const genetica = await prisma.genetica.findFirst({ where: { id: params.id, tenantId } });
  if (!genetica) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si ya hay animales con esa genética no se elimina (se perdería el dato): se desactiva
  const nombre = { equals: genetica.nombre, mode: "insensitive" as const };
  const [cerdas, verracos, lotes] = await Promise.all([
    prisma.sow.count({ where: { tenantId, geneticLine: nombre } }),
    prisma.boar.count({ where: { tenantId, geneticLine: nombre } }),
    prisma.growingBatch.count({ where: { tenantId, genetica: nombre } }),
  ]);
  const enUso = cerdas + verracos + lotes;
  if (enUso > 0) {
    return NextResponse.json({ error: `«${genetica.nombre}» ya está en ${enUso.toLocaleString("es-PY")} ${enUso === 1 ? "animal o lote" : "animales o lotes"}: no se puede eliminar. Desactivala para que no aparezca al cargar.` }, { status: 409 });
  }

  await prisma.genetica.delete({ where: { id: params.id } });
  await registrarAuditoria("CONFIG_ELIMINADA", "config_genetica", params.id,
    { nombre: genetica.nombre, empresa: genetica.empresa, composicion: genetica.composicionRacial },
    { actorId: session.user.id, organizacionId: tenantId, ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) });
  return NextResponse.json({ ok: true });
}
