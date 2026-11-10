// Fase 9 · Peso real del lote contra la curva esperada (SVG del servidor; cada punto muestra su valor al pasar el mouse).
type Punto = { dia: number; pesoKg: number };

export function GraficoPeso({ curva, pesajes, objetivo }: { curva: Punto[]; pesajes: { dia: number; real: number; esperado: number | null; fecha: string }[]; objetivo: number }) {
  if (!curva.length || !pesajes.length) return null;
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 30;
  const maxDia = Math.max(...curva.map(p => p.dia), ...pesajes.map(p => p.dia)) || 1;
  const maxKg = Math.ceil(Math.max(objetivo, ...curva.map(p => p.pesoKg), ...pesajes.map(p => p.real)) / 20) * 20;
  const x = (d: number) => L + (d / maxDia) * (W - L - R);
  const y = (k: number) => T + (1 - k / maxKg) * (H - T - B);
  const lineaCurva = [...curva].sort((a, b) => a.dia - b.dia).map((p, i) => `${i ? "L" : "M"}${x(p.dia).toFixed(1)},${y(p.pesoKg).toFixed(1)}`).join(" ");
  const lineaReal = pesajes.map((p, i) => `${i ? "L" : "M"}${x(p.dia).toFixed(1)},${y(p.real).toFixed(1)}`).join(" ");
  const marcasKg = Array.from({ length: maxKg / 20 + 1 }, (_, i) => i * 20);
  const pasoDia = maxDia > 100 ? 20 : 10;
  const marcasDia = Array.from({ length: Math.floor(maxDia / pasoDia) + 1 }, (_, i) => i * pasoDia);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Peso real del lote contra la curva esperada; último pesaje ${pesajes[pesajes.length - 1].real.toFixed(1)} kg`} style={{ maxWidth: W, display: "block" }}>
        {marcasKg.map(k => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} stroke="var(--border-default)" strokeWidth={0.5} />
            <text x={L - 6} y={y(k) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">{k}</text>
          </g>
        ))}
        {marcasDia.map(d => <text key={d} x={x(d)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d}</text>)}
        <text x={W - R} y={H - 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">días en el lote</text>
        <text x={4} y={T + 2} fontSize={10} fill="var(--text-muted)">kg</text>
        <line x1={L} x2={W - R} y1={y(objetivo)} y2={y(objetivo)} stroke="var(--text-muted)" strokeDasharray="2 4" strokeWidth={1} />
        <text x={W - R} y={y(objetivo) - 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">objetivo {objetivo} kg</text>
        <path d={lineaCurva} fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 4" />
        <path d={lineaReal} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {pesajes.map(p => {
          const dif = p.esperado === null ? null : p.real - p.esperado;
          return (
            <g key={p.dia}>
              <circle cx={x(p.dia)} cy={y(p.real)} r={4.5} fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth={2} />
              <circle cx={x(p.dia)} cy={y(p.real)} r={12} fill="transparent">
                <title>{`${p.fecha} · día ${p.dia}: ${p.real.toFixed(1)} kg${p.esperado !== null ? ` (esperado ${p.esperado.toFixed(1)} kg, ${dif! >= 0 ? "+" : ""}${dif!.toFixed(1)} kg)` : ""}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
        <span><svg width={18} height={8} aria-hidden><line x1={0} x2={18} y1={4} y2={4} stroke="var(--accent)" strokeWidth={2} /></svg> Peso real (pesajes)</span>
        <span><svg width={18} height={8} aria-hidden><line x1={0} x2={18} y1={4} y2={4} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 4" /></svg> Curva esperada</span>
      </figcaption>
    </figure>
  );
}
