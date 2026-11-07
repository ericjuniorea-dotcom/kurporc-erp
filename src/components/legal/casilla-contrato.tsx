"use client";
// La casilla única de aceptación (decisión 18). Desmarcada por defecto.
// El texto tiene que coincidir con TEXTO_CASILLA de src/lib/legal/documentos.ts.
export function CasillaContrato({ marcada, onChange }: { marcada: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)", cursor: "pointer" }}>
      <input type="checkbox" checked={marcada} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0, cursor: "pointer" }} />
      <span>
        Soy mayor de 18 años y acepto los{" "}
        <a href="/terminos" target="_blank" rel="noopener" style={{ color: "var(--text-primary)", textDecoration: "underline" }}>Términos y Condiciones</a>{" "}
        y la{" "}
        <a href="/privacidad" target="_blank" rel="noopener" style={{ color: "var(--text-primary)", textDecoration: "underline" }}>Política de Privacidad</a>{" "}
        de KurPorc.
      </span>
    </label>
  );
}
