import { MarcoAuth } from "@/components/auth/marco-auth";
import { getUsuario } from "@/lib/auth/config";
import { BotonSalir } from "./boton-salir";

export const metadata = { title: "Tu cuenta · KurPorc" };

// Persona con sesión pero sin ninguna granja o empresa activa.
// El registro de organizaciones llega con el onboarding (Fase 6).
export default async function SinOrganizacionPage() {
  const usuario = await getUsuario();
  return (
    <MarcoAuth titulo={`Hola${usuario ? `, ${usuario.name.split(" ")[0]}` : ""}`} subtitulo="Tu cuenta ya está creada">
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0 }}>
          Todavía no pertenecés a ninguna granja ni empresa en KurPorc.
        </p>
        <p style={{ margin: 0 }}>
          Si alguien te invitó, abrí el enlace de invitación que te mandó. Si trabajás en una empresa que ya usa KurPorc,
          pedile al Administrador General que te agregue con este correo: <strong>{usuario?.email}</strong>.
        </p>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>
          Muy pronto vas a poder registrar tu propia granja desde acá.
        </p>
        <BotonSalir />
      </div>
    </MarcoAuth>
  );
}
