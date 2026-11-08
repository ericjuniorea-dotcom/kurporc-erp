export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

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
  const prevState = sow.plantelState;

  const [updated, discard] = await prisma.$transaction([
    prisma.sow.update({
      where: { id: params.id },
      data: {
        plantelState: "CULLED",
        isActive: false,
        animalEvents: {
          create: {
            tenantId,
            eventType: "DISCARD",
            eventDate: date,
            previousState: prevState ?? undefined,
            newState: "CULLED",
            description: `Descarte: ${categoria} — ${motivoPrincipal}. Tipo: ${tipoDescarte}.`,
            moduleSource: "PLANTEL",
            userId,
            metadata: { categoria, motivoPrincipal, tipoDescarte },
          },
        },
      },
    }),
    prisma.sowDiscard.create({
      data: {
        tenantId,
        sowId: params.id,
        discardDate: date,
        reason: motivoPrincipal,
        destination: destination ?? null,
        employeeId: userId,
        categoria,
        motivosEspecificos: motivosEspecificos ?? [],
        motivoPrincipal,
        tipoDescarte,
        pesoKg: pesoKg ? parseFloat(pesoKg) : null,
        condicionCorporal: condicionCorporal ? parseInt(condicionCorporal) : null,
        estadoSanitario: estadoSanitario ?? null,
        estadoReproductivo: estadoReproductivo ?? null,
        estadoProductivo: estadoProductivo ?? null,
        numeroParto: numeroParto ? parseInt(numeroParto) : null,
        diasUltimoParto: diasUltimoParto ? parseInt(diasUltimoParto) : null,
        diasUltimoServicio: diasUltimoServicio ? parseInt(diasUltimoServicio) : null,
        numeroServicios: numeroServicios ? parseInt(numeroServicios) : null,
        lechonesDestetados: lechonesDestetados ? parseInt(lechonesDestetados) : null,
        diagnostico: diagnostico ?? null,
        veterinario: veterinario ?? null,
        observacionesClinicas: observacionesClinicas ?? null,
        observaciones: observaciones ?? null,
        responsableAutoriza: responsableAutoriza ?? null,
      },
    }),
  ]);

  return NextResponse.json({ sow: updated, discard }, { status: 201 });
}
