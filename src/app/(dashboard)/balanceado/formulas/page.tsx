"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormulaEditor } from "@/components/balanceado/formula-editor";
import { NutritionalProfile } from "@/components/balanceado/nutritional-profile";
import { Topbar } from "@/components/layout/topbar";
import { ROLES } from "@/lib/auth/config";
import {
  IconFlask, IconChevronDown, IconChevronRight, IconCircleCheck,
  IconClock, IconAlertTriangle, IconLoader2,
} from "@tabler/icons-react";

interface FormulaVersion {
  id:            string;
  versionNumber: number;
  status:        "ACTIVE" | "INACTIVE" | "SUPERSEDED";
  approvedAt?:   string;
  approvedBy?:   { name: string };
  totalProteinPct:    number;
  totalEnergyKcal:    number;
  totalLysinePct:     number;
  totalMethioninePct: number;
  totalCalciumPct:    number;
  totalPhosphorusPct: number;
  totalMoisturePct:   number;
  totalMycotoxinPpb:  number;
  ingredients: Array<{
    id: string;
    inclusionPct: number;
    rawMaterial: { name: string; materialType: string };
  }>;
}

interface Formula {
  id:       string;
  name:     string;
  feedType: { name: string; phase: string };
  versions: FormulaVersion[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    ACTIVE:     { label: "Activa",               bg: "var(--success-subtle)", color: "var(--success-text)", border: "var(--success-border)" },
    INACTIVE:   { label: "Pendiente aprobación", bg: "var(--warning-subtle)", color: "var(--warning-text)", border: "var(--warning-border)" },
    SUPERSEDED: { label: "Reemplazada",          bg: "var(--bg-overlay)",     color: "var(--text-muted)",   border: "var(--border-default)" },
  };
  const s = map[status] ?? map.SUPERSEDED;
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, border: `0.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export default function FormulasPage() {
  const { data: session } = useSession();
  const [formulas,   setFormulas]   = useState<Formula[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [newDialog,  setNewDialog]  = useState<string | null>(null);
  const [approving,  setApproving]  = useState<string | null>(null);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  const [versions,   setVersions]   = useState<Record<string, FormulaVersion[]>>({});

  const isVetChief = session?.user.roles.includes(ROLES.VET_CHIEF) ?? false;
  const canEdit    = session?.user.roles.some((r) => [1, 2, 4, 6].includes(r)) ?? false;

  function load() {
    setLoading(true);
    fetch("/api/formulas").then((r) => r.json()).then((data) => { setFormulas(data); setLoading(false); });
  }
  useEffect(load, []);

  async function loadVersions(formulaId: string) {
    const res = await fetch(`/api/formulas/${formulaId}/versions`);
    const v   = await res.json();
    setVersions((prev) => ({ ...prev, [formulaId]: v }));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id] && !versions[id]) loadVersions(id);
      return next;
    });
  }

  async function approveVersion(versionId: string) {
    setApproving(versionId); setApproveErr(null);
    const res = await fetch(`/api/formulas/${versionId}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (res.ok) {
      const ver = Object.entries(versions).find(([, vs]) => vs.some((v) => v.id === versionId));
      if (ver) loadVersions(ver[0]);
      load();
    } else {
      const err = await res.json();
      setApproveErr(err.error ?? "Error al aprobar");
    }
    setApproving(null);
  }

  return (
    <>
      <Topbar title="Fórmulas de alimento" icon={IconFlask} iconColor="var(--danger)" />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {approveErr && (
          <div className="kp-alert kp-alert-danger">
            <IconAlertTriangle size={13} aria-hidden /> {approveErr}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : formulas.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 0",
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
          }}>
            <IconFlask size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No hay fórmulas configuradas</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Contactá al administrador para crear las fórmulas base
            </div>
          </div>
        ) : (
          formulas.map((f) => {
            const activeVersion   = f.versions[0];
            const formulaVersions = versions[f.id];
            const pendingCount    = formulaVersions?.filter((v) => v.status === "INACTIVE").length ?? 0;

            return (
              <div key={f.id} style={{
                background: "var(--bg-surface)",
                border: "0.5px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
              }}>
                {/* Header row */}
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", cursor: "pointer",
                    background: "var(--bg-elevated)",
                  }}
                  onClick={() => toggleExpand(f.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-overlay)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {expanded[f.id]
                      ? <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {f.feedType.name} — {f.feedType.phase}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {pendingCount > 0 && isVetChief && (
                      <span className="badge" style={{
                        background: "var(--warning-subtle)", color: "var(--warning-text)",
                        border: "0.5px solid var(--warning-border)",
                      }}>
                        {pendingCount} por aprobar
                      </span>
                    )}
                    {activeVersion
                      ? <StatusBadge status={activeVersion.status} />
                      : <span className="badge" style={{ background: "var(--bg-overlay)", color: "var(--text-muted)", border: "0.5px solid var(--border-default)" }}>Sin versión activa</span>}
                  </div>
                </div>

                {/* Expanded body */}
                {expanded[f.id] && (
                  <div style={{ padding: "12px 14px", borderTop: "0.5px solid var(--border-default)" }}>
                    {canEdit && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                        <button className="btn btn-primary" style={{ height: 28, fontSize: 11 }} onClick={() => setNewDialog(f.id)}>
                          + Nueva versión
                        </button>
                      </div>
                    )}

                    {formulaVersions ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {formulaVersions.map((v) => {
                          const vBorder = v.status === "ACTIVE" ? "var(--success-border)" : v.status === "INACTIVE" ? "var(--warning-border)" : "var(--border-default)";
                          const vBg     = v.status === "ACTIVE" ? "var(--success-subtle)" : v.status === "INACTIVE" ? "var(--warning-subtle)" : "var(--bg-overlay)";
                          return (
                            <div key={v.id} style={{
                              borderRadius: "var(--radius-md)",
                              border: `0.5px solid ${vBorder}`,
                              background: vBg,
                              padding: "10px 12px",
                              opacity: v.status === "SUPERSEDED" ? 0.7 : 1,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {v.status === "ACTIVE"   && <IconCircleCheck size={13} style={{ color: "var(--success)" }} />}
                                  {v.status === "INACTIVE" && <IconClock size={13} style={{ color: "var(--warning)" }} />}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                                    Versión {v.versionNumber}
                                  </span>
                                  <StatusBadge status={v.status} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {v.approvedAt && (
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                      Aprobada por {v.approvedBy?.name} · {new Date(v.approvedAt).toLocaleDateString("es-PY")}
                                    </span>
                                  )}
                                  {v.status === "INACTIVE" && isVetChief && (
                                    <button
                                      className="btn btn-primary"
                                      style={{ height: 26, fontSize: 11 }}
                                      onClick={() => approveVersion(v.id)}
                                      disabled={approving === v.id}
                                    >
                                      {approving === v.id
                                        ? <IconLoader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                                        : "Aprobar (Regla 1)"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Ingredientes */}
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6, marginBottom: 10 }}>
                                {v.ingredients.map((ing) => (
                                  <div key={ing.id} style={{
                                    background: "var(--bg-surface)",
                                    border: "0.5px solid var(--border-default)",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "5px 8px",
                                  }}>
                                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {ing.rawMaterial.name}
                                    </div>
                                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
                                      {Number(ing.inclusionPct).toFixed(3)}%
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <NutritionalProfile
                                profile={{
                                  totalProteinPct:    Number(v.totalProteinPct),
                                  totalEnergyKcal:    Number(v.totalEnergyKcal),
                                  totalLysinePct:     Number(v.totalLysinePct),
                                  totalMethioninePct: Number(v.totalMethioninePct),
                                  totalCalciumPct:    Number(v.totalCalciumPct),
                                  totalPhosphorusPct: Number(v.totalPhosphorusPct),
                                  totalMoisturePct:   Number(v.totalMoisturePct),
                                  totalMycotoxinPpb:  Number(v.totalMycotoxinPpb),
                                }}
                                warnings={[]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                        <IconLoader2 size={18} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={newDialog !== null} onOpenChange={(o) => !o && setNewDialog(null)}>
        <DialogContent style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)", maxWidth: "42rem",
          maxHeight: "85vh", overflowY: "auto",
        }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              Nueva versión de fórmula
            </DialogTitle>
          </DialogHeader>
          {newDialog && (
            <FormulaEditor
              formulaId={newDialog}
              isVetChief={isVetChief}
              onSuccess={() => { setNewDialog(null); load(); }}
              onCancel={() => setNewDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
