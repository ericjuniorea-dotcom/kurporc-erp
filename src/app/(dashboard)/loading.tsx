// Se muestra al instante al tocar un módulo mientras llega del servidor (y permite precargar los módulos).
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ height: 52, borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: "var(--bg-base)" }}>
        <div className="kp-esqueleto" style={{ width: 26, height: 26, borderRadius: 7 }} />
        <div className="kp-esqueleto" style={{ width: 160, height: 14 }} />
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="kp-esqueleto" style={{ height: 76, borderRadius: "var(--radius-lg)" }} />)}
        </div>
        <div className="kp-esqueleto" style={{ height: 260, borderRadius: "var(--radius-lg)" }} />
      </div>
    </div>
  );
}
