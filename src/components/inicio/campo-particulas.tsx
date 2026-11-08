"use client";
// Fondo del hero: una grilla de puntos que respira y se aparta del cursor.
// Liviano (un canvas, sin librerías), se pausa fuera de pantalla y respeta
// "reducir movimiento" del sistema operativo.
import { useEffect, useRef } from "react";

export function CampoParticulas({ color = "163, 22, 33" }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const raton = { x: -9999, y: -9999 };
    let puntos: { x: number; y: number; bx: number; by: number; fase: number }[] = [];
    let ancho = 0, alto = 0, raf = 0, visible = true, t = 0;

    function armar() {
      const r = canvas!.getBoundingClientRect();
      ancho = r.width; alto = r.height;
      canvas!.width = ancho * dpr; canvas!.height = alto * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const paso = ancho < 640 ? 26 : 32;
      puntos = [];
      for (let y = paso / 2; y < alto; y += paso) {
        for (let x = paso / 2; x < ancho; x += paso) {
          puntos.push({ x, y, bx: x, by: y, fase: Math.random() * Math.PI * 2 });
        }
      }
    }

    function dibujar() {
      ctx!.clearRect(0, 0, ancho, alto);
      t += 0.012;
      const cx = ancho / 2, cy = alto / 2, maxD = Math.hypot(cx, cy);
      for (const p of puntos) {
        // respiración suave
        const ox = Math.sin(t + p.fase) * 1.6, oy = Math.cos(t * 0.9 + p.fase) * 1.6;
        let tx = p.bx + ox, ty = p.by + oy;
        // se aparta del cursor
        const dx = tx - raton.x, dy = ty - raton.y, d = Math.hypot(dx, dy);
        if (d < 140) { const f = (1 - d / 140) * 26; tx += (dx / (d || 1)) * f; ty += (dy / (d || 1)) * f; }
        p.x += (tx - p.x) * 0.12; p.y += (ty - p.y) * 0.12;
        // más visibles hacia los bordes, casi invisibles detrás del texto
        const borde = Math.min(1, Math.hypot(p.x - cx, p.y - cy) / maxD * 1.6);
        const cerca = d < 140 ? (1 - d / 140) * 0.5 : 0;
        ctx!.fillStyle = `rgba(${color}, ${Math.min(0.55, 0.06 + borde * 0.28 + cerca)})`;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx!.fill();
      }
      if (!quieto && visible) raf = requestAnimationFrame(dibujar);
    }

    const mover = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      raton.x = e.clientX - r.left; raton.y = e.clientY - r.top;
    };
    const salir = () => { raton.x = -9999; raton.y = -9999; };
    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !quieto) { cancelAnimationFrame(raf); raf = requestAnimationFrame(dibujar); }
    });

    armar(); dibujar();
    observador.observe(canvas);
    window.addEventListener("resize", armar);
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerleave", salir);
    return () => {
      cancelAnimationFrame(raf); observador.disconnect();
      window.removeEventListener("resize", armar);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerleave", salir);
    };
  }, [color]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}
