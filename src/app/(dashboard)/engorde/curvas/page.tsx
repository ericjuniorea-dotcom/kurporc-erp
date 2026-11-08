import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { EncabezadoEngorde } from "../lotes/[id]/formularios";
import { EditorCurvas } from "./editor";

export const dynamic = "force-dynamic";

export default async function CurvasPage() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "engorde.lotes.ver")) redirect("/dashboard");
  const curvas = await prisma.curvaEngorde.findMany({ where: { organizacionId: session.user.tenantId }, orderBy: [{ predeterminada: "desc" }, { nombre: "asc" }] });
  return (
    <>
      <EncabezadoEngorde />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
        <Link href="/engorde/comparativo" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Comparativo de lotes</Link>
        <EditorCurvas editable={puede(permisos, "engorde.curvas.configurar")}
          curvas={curvas.map(c => ({ id: c.id, nombre: c.nombre, predeterminada: c.predeterminada, puntos: c.puntos as { dia: number; pesoKg: number; consumoKgDia?: number }[] }))} />
      </div>
    </>
  );
}
