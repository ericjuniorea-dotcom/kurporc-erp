"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconShoppingCart } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export function EncabezadoCompras({ porAprobar, puedeCotizar }: { porAprobar: number; puedeCotizar: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const qv = useSearchParams().get("vista");
  const vista = ruta === "/compras/necesidades" ? "necesidades" : qv ?? "pedidos";
  const tabs = [
    { key: "necesidades", label: "Lo que te va a faltar" },
    { key: "pedidos", label: "Pedidos" },
    { key: "cotizaciones", label: "Cotizaciones" },
    ...(porAprobar >= 0 ? [{ key: "aprobar", label: porAprobar > 0 ? `Por aprobar (${porAprobar})` : "Por aprobar" }] : []),
  ];
  return (
    <Topbar title="Compras" icon={IconShoppingCart} iconColor="var(--accent)"
      tabs={ruta === "/compras" || ruta === "/compras/necesidades" ? tabs : undefined} activeTab={vista}
      onTabChange={k => router.push(k === "pedidos" ? "/compras" : k === "necesidades" ? "/compras/necesidades" : `/compras?vista=${k}`)}
      actions={<span style={{ display: "flex", gap: 6 }}>
        {ruta !== "/compras" && ruta !== "/compras/necesidades" && <Link href="/compras" className="btn">Volver a Compras</Link>}
        {puedeCotizar && <Link href="/compras/cotizaciones/nueva" className="btn">Pedir cotización</Link>}
        <Link href="/mercado" className="btn btn-primary">Ir al Mercado</Link>
      </span>} />
  );
}
