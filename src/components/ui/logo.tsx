import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  color?: string;
}

const SIZES = {
  sm: { wordmark: 18, dot: 5,  dotInner: 2,  tagline: 10, gap: 3 },
  md: { wordmark: 26, dot: 7,  dotInner: 2.8, tagline: 12, gap: 5 },
  lg: { wordmark: 36, dot: 10, dotInner: 4,  tagline: 14, gap: 8 },
};

export function KurPorcLogo({ size = "md", showTagline = false, color = "#A31621" }: LogoProps) {
  const s = SIZES[size];

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: s.gap, userSelect: "none" }}>
      {/* Wordmark: KUR-P + O(con punto) + RC */}
      <div style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
        <span style={{
          fontFamily:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize:      s.wordmark,
          fontWeight:    800,
          color,
          letterSpacing: "-0.03em",
        }}>
          KUR-P
        </span>

        {/* O con punto interior */}
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{
            fontFamily:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontSize:      s.wordmark,
            fontWeight:    800,
            color,
            letterSpacing: "-0.03em",
          }}>
            O
          </span>
          {/* Punto central */}
          <span style={{
            position:    "absolute",
            width:       s.dotInner * 2,
            height:      s.dotInner * 2,
            borderRadius: "50%",
            background:  color,
            // El O tiene un "hueco" visual — necesitamos el fondo detrás
            boxShadow:   `0 0 0 ${s.dot - s.dotInner}px var(--bg-base, #0F0F0F)`,
          }} />
        </span>

        <span style={{
          fontFamily:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize:      s.wordmark,
          fontWeight:    800,
          color,
          letterSpacing: "-0.03em",
        }}>
          RC
        </span>
      </div>

      {/* Tagline */}
      {showTagline && (
        <span style={{
          fontFamily:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize:      s.tagline,
          fontWeight:    400,
          color,
          opacity:       0.65,
          letterSpacing: "0.08em",
        }}>
          genética porcina
        </span>
      )}
    </div>
  );
}
