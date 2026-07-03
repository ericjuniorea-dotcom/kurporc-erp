"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconInfoCircle } from "@tabler/icons-react";

interface KpisRepro {
  totalServicios:     number;
  totalPartos:        number;
  tasaConcepcion:     number;
  nacidosVivoPromedio: number;
}

interface Servicio {
  id:           string;
  serviceDate:  string;
  serviceType:  string;
  boar?:        { identCode: string; erpCode: string | null } | null;
  semenDose?:   { doseCode: string } | null;
  pregnancyChecks: Array<{ result: string; checkDate: string; method: string }>;
}

interface Parto {
  id:           string;
  startDatetime: string;
  bornAlive:    number;
  bornDead:     number;
  totalBorn:    number;
  weaning?:     {
    weaningDate:       string;
    pigletsWeaned:     number;
    avgPigletWeightKg: string | null;
    lactationDays:     number;
  } | null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function KpiMini({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-md)", padding: "12px 14px", flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 9, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const CHECK_RESULT_LABEL: Record<string, string> = {
  PREGNANT:     "Gestante",
  NOT_PREGNANT: "No gestante",
  RECHECK:      "Re-control",
};

const CHECK_RESULT_COLOR: Record<string, string> = {
  PREGNANT:     "var(--success-text)",
  NOT_PREGNANT: "var(--danger-text)",
  RECHECK:      "var(--warning-text)",
};

export function TabReproductivo({ sowId }: { sowId: string }) {
  const [data,    setData]    = useState<{ kpis: KpisRepro; servicios: Servicio[]; partos: Parto[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/plantel/animales/${sowId}/historial-reproductivo`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sowId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
        <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando historial…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, servicios, partos } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Read-only notice */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-md)", padding: "7px 12px",
        fontSize: 11, color: "var(--text-muted)",
      }}>
        <IconInfoCircle size={13} style={{ flexShrink: 0 }} />
        Esta sección es de sólo lectura. Los eventos se registran desde los módulos correspondientes.
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 8 }}>
        <KpiMini label="Servicios"        value={kpis.totalServicios} />
        <KpiMini label="Partos"           value={kpis.totalPartos} />
        <KpiMini label="Tasa concepción"  value={`${kpis.tasaConcepcion}%`} />
        <KpiMini label="Nacidos vivos Ø"  value={kpis.nacidosVivoPromedio} sub="por parto" />
      </div>

      {/* Historial de servicios */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Historial de servicios ({servicios.length})
        </div>
        {servicios.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin servicios registrados</div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <table className="kp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Verraco / Dosis</th>
                  <th>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map(s => {
                  const chk = s.pregnancyChecks[0];
                  return (
                    <tr key={s.id}>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(s.serviceDate)}</td>
                      <td>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 4,
                          background: s.serviceType === "AI" ? "var(--info-subtle)" : "var(--accent-subtle)",
                          color: s.serviceType === "AI" ? "var(--info-text)" : "var(--accent-text)",
                          border: `0.5px solid ${s.serviceType === "AI" ? "var(--info-border)" : "var(--accent-border)"}`,
                          fontWeight: 500,
                        }}>
                          {s.serviceType === "AI" ? "IA" : "Monta"}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {s.boar?.erpCode ?? s.boar?.identCode ?? s.semenDose?.doseCode ?? "—"}
                      </td>
                      <td>
                        {chk ? (
                          <span style={{ fontSize: 11, color: CHECK_RESULT_COLOR[chk.result] ?? "var(--text-muted)" }}>
                            {CHECK_RESULT_LABEL[chk.result] ?? chk.result} · {fmtDate(chk.checkDate)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de partos */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Historial de partos ({partos.length})
        </div>
        {partos.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin partos registrados</div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <table className="kp-table">
              <thead>
                <tr>
                  <th>Fecha parto</th>
                  <th>NV</th>
                  <th>NM</th>
                  <th>Total</th>
                  <th>Destete</th>
                  <th>Días lact.</th>
                  <th>Kg/lechón</th>
                </tr>
              </thead>
              <tbody>
                {partos.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(p.startDatetime)}</td>
                    <td style={{ color: "var(--success-text)", fontWeight: 500 }}>{p.bornAlive}</td>
                    <td style={{ color: p.bornDead > 0 ? "var(--danger-text)" : "var(--text-muted)" }}>{p.bornDead}</td>
                    <td>{p.totalBorn}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
                      {fmtDate(p.weaning?.weaningDate)}
                    </td>
                    <td style={{ textAlign: "center" }}>{p.weaning?.lactationDays ?? "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {p.weaning?.avgPigletWeightKg ? `${Number(p.weaning.avgPigletWeightKg).toFixed(1)} kg` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
