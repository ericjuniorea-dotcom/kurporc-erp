import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoAuth, Aviso } from "@/components/auth/marco-auth";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { BotonSalir } from "./boton-salir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu cuenta · KurPorc" };

// Persona con sesión pero sin ninguna granja, empresa o tienda activa.
export default async function SinOrganizacionPage({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  if (usuario.faltaAceptarContrato) redirect("/legal/aceptar");
  if (!usuario.onboardingCompleto) redirect("/onboarding");

  const [{ solicitud }, perfil, pedidos] = await Promise.all([
    searchParams,
    prisma.user.findUnique({ where: { id: usuario.id }, select: { tipoRegistro: true } }),
    prisma.solicitudUnion.findMany({ where: { userId: usuario.id, estado: "PENDIENTE" }, select: { organizacionId: true } }),
  ]);
  const orgsPedidas = pedidos.length
    ? await prisma.tenant.findMany({ where: { id: { in: pedidos.map(p => p.organizacionId) } }, select: { farmName: true } })
    : [];
  const esComprador = perfil?.tipoRegistro === "COMPRADOR";

  return (
    <MarcoAuth titulo={`Hola, ${usuario.name.split(" ")[0]}`} subtitulo={esComprador ? "Tu cuenta de comprador está lista" : "Tu cuenta ya está creada"}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 10 }}>
        {solicitud === "enviada" && <Aviso tipo="ok">Enviamos tu pedido. Cuando el Administrador General lo apruebe, vas a poder entrar.</Aviso>}
        {orgsPedidas.length > 0 && (
          <p style={{ margin: 0 }}>Pedido pendiente para unirte a: <strong>{orgsPedidas.map(o => o.farmName).join(", ")}</strong>.</p>
        )}
        {esComprador && (
          <p style={{ margin: 0 }}>
            El <strong>Mercado KurPorc</strong> se está preparando: muy pronto vas a poder buscar proveedores, pedir cotizaciones y comprar desde acá.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <Link href="/onboarding?tipo=INDIVIDUAL" className="btn btn-primary" style={{ height: 36, justifyContent: "center" }}>Registrar mi granja</Link>
          <Link href="/onboarding?tipo=EMPRESA" className="btn" style={{ height: 34, justifyContent: "center" }}>Registrar una empresa con equipo</Link>
          <Link href="/onboarding?tipo=VENDEDOR" className="btn" style={{ height: 34, justifyContent: "center" }}>Abrir una tienda</Link>
          <Link href="/onboarding" className="btn" style={{ height: 34, justifyContent: "center" }}>Tengo un código de empresa</Link>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 12, marginTop: 4 }}>
          <Link href="/cuenta/privacidad">Privacidad</Link>
          <Link href="/cuenta/seguridad">Seguridad</Link>
        </div>
        <BotonSalir />
      </div>
    </MarcoAuth>
  );
}
