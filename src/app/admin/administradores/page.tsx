import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";
import { PanelAdministradores } from "./panel";

export default async function AdministradoresAdmin() {
  const admin = await requireAdmin();
  const lista = await prisma.adminPlataforma.findMany({ orderBy: { createdAt: "asc" }, select: { userId: true, nivel: true, otorgadoPor: true, createdAt: true, perfil: { select: { name: true, email: true } } } });
  const otorgantes = await prisma.user.findMany({ where: { id: { in: lista.map(l => l.otorgadoPor).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nombre = new Map(otorgantes.map(o => [o.id, o.name]));
  return (
    <PanelAdministradores
      yo={admin.usuario.id}
      puedeGestionar={admin.nivel === "TOTAL"}
      admins={lista.map(l => ({
        userId: l.userId, nivel: l.nivel, nombre: l.perfil.name, email: l.perfil.email,
        otorgadoPor: l.otorgadoPor ? (nombre.get(l.otorgadoPor) ?? "—") : "Configuración inicial", desde: l.createdAt.toISOString().slice(0, 10),
      }))}
    />
  );
}
