"use client";
import { useEffect, useState } from "react";
import { KurPorcLogo } from "./logo";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Solo una vez por sesión (limpia key anterior si existe)
    sessionStorage.removeItem("kp-splash-shown");
    if (sessionStorage.getItem("kp-splash")) return;
    sessionStorage.setItem("kp-splash", "1");
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes kpSplashBg {
          0%   { opacity: 1; }
          78%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes kpLogoRise {
          0%   { opacity: 0;   transform: translateY(20px); }
          10%  { opacity: 1;   transform: translateY(0px);  }
          70%  { opacity: 1;   transform: translateY(0px);  }
          100% { opacity: 0;   transform: translateY(-32px);}
        }
      `}</style>

      {/* Fondo oscuro */}
      <div style={{
        position:       "fixed",
        inset:          0,
        zIndex:         9999,
        background:     "#0F0F0F",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        animation:      "kpSplashBg 2.2s ease forwards",
        pointerEvents:  "none",
      }}>
        {/* Logo animado */}
        <div style={{ animation: "kpLogoRise 2.2s ease forwards" }}>
          <KurPorcLogo size="lg" showTagline />
        </div>
      </div>
    </>
  );
}
