"use client";
import { IconClockPause } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export function EncabezadoParadas() {
  return <Topbar title="Cerdas paradas" icon={IconClockPause} iconColor="var(--danger)" actions={<a href="/gestacion" className="btn">Volver a Gestación</a>} />;
}
