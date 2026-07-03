"use client";
import { useState, useEffect, useCallback } from "react";
import { IconSearch, IconLoader2, IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";
import { EstadoBadgeSow } from "./estado-badge";

interface SowDescartada {
  id: string;
  erpCode: string | null;
  caravanaCode: string | null;
  identCode: string;
  plantelState: string | null;
  geneticLine: string | null;
  breed: string | null;
  birthDate: string | null;
  currentParityCount: number;
  updatedAt: string;
  lastDiscard: {
    id: string;
    discardDate: string;
    categoria: string | null;
    motivosEspecificos: string[];
    motivoPrincipal: string | null;
    tipoDescarte: string | null;
    destination: string | null;
    pesoKg: number | null;
    condicionCorporal: number | null;
    estadoSanitario: string | null;
    estadoReproductivo: string | null;
    estadoProductivo: string | null;
    numeroParto: number | null;
    diasUltimoParto: number | null;
    diasUltimoServicio: number | null;
    numeroServicios: number | null;
    lechonesDestetados: number | null;
    diagnostico: string | null;
    veterinario: string | null;
    observacionesClinicas: string | null;
    observaciones: string | null;
    responsableAutoriza: string | null;
    employeeName: string | null;
    reason: string;
  } | null;
  lastEvent: { eventType: string; eventDate: string; description: string | null } | null;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" });
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const days = Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000);
  if (days < 60)  return `${days}d`;
  if (days < 730) return `${Math.floor(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "4px 0", borderBottom: "0.5px solid var(--border-subtle)" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function DetailPanel({ sow, onClose }: { sow: SowDescartada; onClose: () => void }) {
  const d = sow.lastDiscard;
  const isDead = sow.plantelState === "DEAD";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)", borderLeft: "0.5px solid var(--border-default)",
          width: 440, height: "100%", overflowY: "auto", padding: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {sow.caravanaCode || sow.identCode}
              {sow.erpCode && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--accent)", fontFamily: "monospace" }}>{sow.erpCode}</span>}
            </div>
            <div style={{ marginTop: 2 }}>
              <EstadoBadgeSow state={sow.plantelState} />
            </div>
          </div>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
            onClick={onClose}
          >
            <IconX size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Animal info */}
          <Section title="Animal">
            <FieldRow label="Código ERP" value={sow.erpCode} />
            <FieldRow label="Caravana" value={sow.caravanaCode} />
            <FieldRow label="Línea genética" value={sow.geneticLine} />
            <FieldRow label="Raza" value={sow.breed} />
            <FieldRow label="Edad al descarte" value={calcAge(sow.birthDate)} />
            <FieldRow label="N° partos" value={sow.currentParityCount} />
          </Section>

          {/* Categorización */}
          {d ? (
            <>
              <Section title="Motivo del descarte">
                <FieldRow label="Fecha" value={fmtDateLong(d.discardDate)} />
                <FieldRow label="Categoría" value={d.categoria} />
                <FieldRow label="Motivo principal" value={
                  <span style={{ fontWeight: 600, color: isDead ? "var(--danger-text)" : "var(--warning-text)" }}>
                    {d.motivoPrincipal}
                  </span>
                } />
                <FieldRow label="Tipo de descarte" value={d.tipoDescarte} />
                <FieldRow label="Destino" value={d.destination} />
                {d.motivosEspecificos.length > 1 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Todos los motivos:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {d.motivosEspecificos.map(m => (
                        <span key={m} style={{ fontSize: 11, background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "2px 6px", color: "var(--text-secondary)" }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Estado al descarte */}
              {(d.pesoKg !== null || d.condicionCorporal !== null || d.estadoSanitario || d.estadoReproductivo || d.estadoProductivo) && (
                <Section title="Estado al momento del descarte">
                  <FieldRow label="Peso" value={d.pesoKg !== null ? `${d.pesoKg} kg` : null} />
                  <FieldRow label="Condición corporal" value={d.condicionCorporal !== null ? `${d.condicionCorporal}/5` : null} />
                  <FieldRow label="Estado sanitario" value={d.estadoSanitario} />
                  <FieldRow label="Estado reproductivo" value={d.estadoReproductivo} />
                  <FieldRow label="Estado productivo" value={d.estadoProductivo} />
                </Section>
              )}

              {/* Info reproductiva */}
              {(d.numeroParto !== null || d.diasUltimoParto !== null || d.diasUltimoServicio !== null || d.lechonesDestetados !== null) && (
                <Section title="Info reproductiva">
                  <FieldRow label="N° parto al descarte" value={d.numeroParto} />
                  <FieldRow label="Días desde último parto" value={d.diasUltimoParto !== null ? `${d.diasUltimoParto} días` : null} />
                  <FieldRow label="Días desde último servicio" value={d.diasUltimoServicio !== null ? `${d.diasUltimoServicio} días` : null} />
                  <FieldRow label="N° servicios realizados" value={d.numeroServicios} />
                  <FieldRow label="Lechones destetados (último parto)" value={d.lechonesDestetados} />
                </Section>
              )}

              {/* Info sanitaria */}
              {(d.diagnostico || d.veterinario || d.observacionesClinicas) && (
                <Section title="Info sanitaria">
                  <FieldRow label="Diagnóstico" value={d.diagnostico} />
                  <FieldRow label="Veterinario" value={d.veterinario} />
                  {d.observacionesClinicas && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: "8px 10px" }}>
                      {d.observacionesClinicas}
                    </div>
                  )}
                </Section>
              )}

              {/* Observaciones */}
              {d.observaciones && (
                <Section title="Observaciones">
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: "8px 10px" }}>
                    {d.observaciones}
                  </div>
                </Section>
              )}

              {/* Responsable */}
              <Section title="Registro">
                <FieldRow label="Registrado por" value={d.employeeName} />
                <FieldRow label="Autorizado por" value={d.responsableAutoriza} />
                <FieldRow label="Fecha registro" value={fmtDateLong(d.discardDate)} />
              </Section>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
              Sin registro detallado de descarte.
              <br />
              <span style={{ fontSize: 11 }}>{sow.lastEvent?.description ?? ""}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DescartadosTab() {
  const [sows, setSows]         = useState<SowDescartada[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<SowDescartada | null>(null);
  const [catFilter, setCatFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plantel/descartados");
      if (res.ok) setSows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cats = Array.from(new Set(sows.map(s => s.lastDiscard?.categoria).filter(Boolean))) as string[];

  const filtered = sows.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || [s.erpCode, s.caravanaCode, s.identCode, s.lastDiscard?.motivoPrincipal]
      .some(v => v?.toLowerCase().includes(q));
    const matchCat = !catFilter || s.lastDiscard?.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const totalCulled = sows.filter(s => s.plantelState === "CULLED").length;
  const totalDead   = sows.filter(s => s.plantelState === "DEAD").length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Descartadas", value: totalCulled, color: "var(--warning-text)" },
          { label: "Muertes", value: totalDead, color: "var(--danger-text)" },
          { label: "Total historial", value: sows.length, color: "var(--text-primary)" },
        ].map(k => (
          <div key={k.label} className="panel" style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: k.color, lineHeight: 1 }}>{loading ? "—" : k.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="kp-input"
            placeholder="Buscar por código, caravana o motivo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        {cats.length > 0 && (
          <select className="kp-input" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ appearance: "auto", minWidth: 160 }}>
            <option value="">Todas las categorías</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {sows.length === 0
              ? "Sin animales descartados registrados."
              : "No hay resultados con los filtros actuales."}
          </div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Código ERP</th>
                <th>Caravana</th>
                <th>Estado</th>
                <th>Categoría</th>
                <th>Motivo principal</th>
                <th>Tipo descarte</th>
                <th>Destino</th>
                <th>Fecha descarte</th>
                <th>Partos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sow => {
                const d = sow.lastDiscard;
                return (
                  <tr key={sow.id} style={{ cursor: "pointer" }} onClick={() => setSelected(sow)}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                      {sow.erpCode ?? "—"}
                    </td>
                    <td style={{ fontWeight: 500 }}>{sow.caravanaCode || sow.identCode}</td>
                    <td><EstadoBadgeSow state={sow.plantelState} /></td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {d?.categoria ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td>
                      {d?.motivoPrincipal
                        ? <span style={{ fontSize: 11, fontWeight: 500 }}>{d.motivoPrincipal}</span>
                        : <span style={{ color: "var(--text-muted)" }}>{d?.reason || "—"}</span>}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>{d?.tipoDescarte ?? "—"}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 11 }}>{d?.destination ?? "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtDate(d?.discardDate ?? sow.updatedAt)}</td>
                    <td style={{ textAlign: "center" }}>{sow.currentParityCount}</td>
                    <td>
                      <button
                        className="btn"
                        style={{ fontSize: 10, height: 26 }}
                        onClick={e => { e.stopPropagation(); setSelected(sow); }}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <DetailPanel sow={selected} onClose={() => setSelected(null)} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
