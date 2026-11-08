"use client";
// El ícono es un componente: se elige acá (cliente), no se pasa desde la página de servidor.
import { IconUsersGroup } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export function EncabezadoEquipo() {
  return <Topbar title="Equipo" icon={IconUsersGroup} iconColor="var(--accent)" />;
}
