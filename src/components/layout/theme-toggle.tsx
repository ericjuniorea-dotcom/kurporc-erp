"use client";
import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
  // Siempre inicia en dark — la preferencia se persiste por sesión vía sessionStorage
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // sessionStorage se limpia al cerrar la pestaña → vuelve a dark por defecto
    const saved = sessionStorage.getItem("kurporc-theme") as "dark" | "light" | null;
    const resolved: "dark" | "light" = saved === "light" ? "light" : "dark";
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  const toggle = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    sessionStorage.setItem("kurporc-theme", next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      style={{
        width: 32,
        height: 32,
        borderRadius: "var(--radius-md)",
        border: "0.5px solid var(--border-strong)",
        background: "var(--bg-surface)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-overlay)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
    >
      {theme === "dark"
        ? <IconSun size={15} aria-hidden />
        : <IconMoon size={15} aria-hidden />}
    </button>
  );
}
