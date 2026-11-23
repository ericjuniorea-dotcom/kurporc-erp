"use client";
// Pantalla de arranque (una vez por sesión): fondo blanco, el logo que aparece nítido, una línea roja que se carga
// y la frase de KurPorc. Corta, limpia y sin parpadeos; respeta «reducir movimiento».
import { useEffect, useState } from "react";
import { KurPorcLogo } from "./logo";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("kp-splash-shown");
    if (sessionStorage.getItem("kp-splash")) return;
    sessionStorage.setItem("kp-splash", "1");
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes kpSplashFondo { 0%, 80% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes kpSplashLogo  { 0% { opacity: 0; transform: scale(.96); filter: blur(6px) } 30% { opacity: 1; transform: scale(1); filter: blur(0) } 100% { opacity: 1 } }
        @keyframes kpSplashLinea { 0% { transform: scaleX(0) } 70% { transform: scaleX(1) } 100% { transform: scaleX(1) } }
        @keyframes kpSplashBrillo { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }
        @keyframes kpSplashTexto { 0%, 35% { opacity: 0; transform: translateY(6px) } 60%, 100% { opacity: 1; transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          .kp-splash *, .kp-splash { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
      <div className="kp-splash" aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none",
        background: "radial-gradient(1200px 600px at 50% 40%, #ffffff 0%, #fbf8f8 55%, #f5f0f0 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22,
        animation: "kpSplashFondo 1.9s ease forwards",
      }}>
        <div style={{ animation: "kpSplashLogo 1.9s cubic-bezier(.2,.8,.2,1) forwards" }}>
          <KurPorcLogo size="lg" />
        </div>
        {/* Línea de carga roja con un brillo que la recorre */}
        <div style={{ width: 180, height: 3, borderRadius: 3, background: "rgba(163,22,33,.12)", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #A31621, #D63A47)", transformOrigin: "left", animation: "kpSplashLinea 1.5s cubic-bezier(.65,0,.35,1) forwards" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent)", animation: "kpSplashBrillo 1.1s ease-in-out .3s 2" }} />
        </div>
        <div style={{ fontSize: 12.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#6b6262", fontWeight: 500, animation: "kpSplashTexto 1.9s ease forwards" }}>
          Inteligencia para la producción porcina
        </div>
      </div>
    </>
  );
}
