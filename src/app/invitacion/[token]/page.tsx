import Link from "next/link";
import { createHash } from "crypto";
import { MarcoAuth, Aviso } from "@/components/auth/marco-auth";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { BotonAceptarInvitacion } from "./boton-aceptar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación · KurPorc", robots: { index: false } };

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invitacion.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { email: true, estado: true, expiraEn: true, cargo: true, invitadoPor: true,
      organizacion: { select: { farmName: true } } },
  });
  const valida = inv && inv.estado === "PENDIENTE" && inv.expiraEn > new Date();
  if (!valida) {
    return (
      <MarcoAuth titulo="Invitación no válida" subtitulo="Puede haber vencido o haber sido usada">
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Pedile a quien te invitó que te mande un enlace nuevo.</p>
      </MarcoAuth>
    );
  }
  const [usuario, quien, rol] = await Promise.all([
    getUsuario(),
    prisma.user.findUnique({ where: { id: inv.invitadoPor }, select: { name: true } }),
    prisma.invitacion.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, select: { rolId: true } })
      .then(i => i ? prisma.rol.findUnique({ where: { id: i.rolId }, select: { nombre: true, descripcion: true } }) : null),
  ]);
  const aqui = `/invitacion/${token}`;
  const correoDistinto = usuario && usuario.email.toLowerCase() !== inv.email.toLowerCase();

  return (
    <MarcoAuth titulo={`Te invitaron a ${inv.organizacion.farmName}`} subtitulo={`${quien?.name ?? "El Administrador General"} te suma al equipo en KurPorc`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        <div style={{ background: "var(--bg-base)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
          <div><strong style={{ color: "var(--text-primary)" }}>Rol:</strong> {rol?.nombre ?? "—"}</div>
          {inv.cargo && <div><strong style={{ color: "var(--text-primary)" }}>Cargo:</strong> {inv.cargo}</div>}
          {rol?.descripcion && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{rol.descripcion}</div>}
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Para: {inv.email}</div>
        </div>
        {!usuario ? (
          <>
            <Link href={`/login?next=${encodeURIComponent(aqui)}`} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>Ingresar para aceptar</Link>
            <Link href={`/registro?next=${encodeURIComponent(aqui)}`} className="btn" style={{ height: 36, justifyContent: "center" }}>Crear mi cuenta</Link>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Usá el correo {inv.email} (o tu cuenta de Google con ese correo).</p>
          </>
        ) : correoDistinto ? (
          <Aviso tipo="error">Ingresaste como {usuario.email}, pero la invitación es para {inv.email}. Cerrá sesión y entrá con ese correo.</Aviso>
        ) : usuario.faltaAceptarContrato ? (
          <Link href={`/legal/aceptar?next=${encodeURIComponent(aqui)}`} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>
            Aceptar los Términos para continuar
          </Link>
        ) : (
          <BotonAceptarInvitacion token={token} />
        )}
      </div>
    </MarcoAuth>
  );
}
