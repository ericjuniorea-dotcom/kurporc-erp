"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconShoppingCart } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export function EncabezadoCompras({ porAprobar, puedeCotizar }: { porAprobar: number; puedeCotizar: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const vista = useSearchParams().get("vista") ?? "pedidos";
  const tabs = [
    { key: "pedidos", label: "Pedidos" },
    { key: "cotizaciones", label: "Cotizaciones" },
    ...(porAprobar >= 0 ? [{ key: "aprobar", label: porAprobar > 0 ? `Por aprobar (${porAprobar})` : "Por aprobar" }] : []),
  ];
  return (
    <Topbar title="Compras" icon={IconShoppingCart} iconColor="var(--accent)"
      tabs={ruta === "/compras" ? tabs : undefined} activeTab={vista}
      onTabChange={k => router.push(k === "pedidos" ? "/compras" : `/compras?vista=${k}`)}
      actions={<span style={{ display: "flex", gap: 6 }}>
        {ruta !== "/compras" && <Link href="/compras" className="btn">Volver a Compras</Link>}
        {puedeCotizar && <Link href="/compras/cotizaciones/nueva" className="btn">Pedir cotización</Link>}
        <Link href="/mercado" className="btn btn-primary">Ir al Mercado</Link>
      </span>} />
  );
}
