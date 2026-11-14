"use client";
// Fila de tabla que lleva a una ficha al hacer clic en cualquier parte (los controles de adentro no la disparan).
import { useRouter } from "next/navigation";

export function FilaEnlace({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={e => { if (!(e.target as HTMLElement).closest("a, button, select, input, [role=menu]")) router.push(href); }} style={{ cursor: "pointer" }}>
      {children}
    </tr>
  );
}
