export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { darDeBajaCerda, ErrorBaja } from "@/lib/plantel/baja";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "plantel.animales.dar_baja")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "plantel.animales.dar_baja" }, { status: 403 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id   as string;

  const sow = await prisma.sow.findFirst({ where: { id: params.id, tenantId } });
  if (!sow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    categoria,
    motivosEspecificos,
    motivoPrincipal,
    tipoDescarte,
    destination,
    discardDate,
    pesoKg,
    condicionCorporal,
    estadoSanitario,
    estadoReproductivo,
    estadoProductivo,
    numeroParto,
    diasUltimoParto,
    diasUltimoServicio,
    numeroServicios,
    lechonesDestetados,
    diagnostico,
    veterinario,
    observacionesClinicas,
    observaciones,
    responsableAutoriza,
  } = body;

  if (!categoria || !motivoPrincipal || !tipoDescarte) {
    return NextResponse.json(
      { error: "Campos obligatorios: categoria, motivoPrincipal, tipoDescarte" },
      { status: 400 },
    );
  }

  const date = discardDate ? new Date(discardDate) : new Date();
  const n = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  try {
    const r = await darDeBajaCerda({
      tenantId, sowId: params.id, userId, tipo: tipoDescarte === "Muerte" || categoria === "Muerte" ? "MUERTE" : "DESCARTE", fecha: date, motivo: motivoPrincipal,
      extra: {
        categoria, motivosEspecificos: motivosEspecificos ?? [], tipoDescarte, destination: destination ?? null, pesoKg: n(pesoKg), condicionCorporal: n(condicionCorporal),
        estadoSanitario: estadoSanitario ?? null, estadoReproductivo: estadoReproductivo ?? null, estadoProductivo: estadoProductivo ?? null,
        numeroParto: n(numeroParto), diasUltimoParto: n(diasUltimoParto), diasUltimoServicio: n(diasUltimoServicio), numeroServicios: n(numeroServicios),
        lechonesDestetados: n(lechonesDestetados), diagnostico: diagnostico ?? null, veterinario: veterinario ?? null, observacionesClinicas: observacionesClinicas ?? null,
        observaciones: observaciones ?? null, responsableAutoriza: responsableAutoriza ?? null,
      },
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ErrorBaja) return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: e.codigo === "NO_EXISTE" ? 404 : 409 });
    throw e;
  }
}
