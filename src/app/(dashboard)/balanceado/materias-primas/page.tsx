"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { rawMaterialLotSchema, type RawMaterialLotInput } from "@/lib/validations/balanceado";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiAssistant } from "@/components/balanceado/ai-assistant";
import { Topbar } from "@/components/layout/topbar";
import {
  IconPackage, IconPlus, IconAlertTriangle, IconLoader2,
  IconSparkles, IconChevronDown, IconChevronRight,
} from "@tabler/icons-react";

interface MaterialLot {
  id:           string;
  lotCode:      string;
  receivedDate: string;
  quantityKg:   number;
  remainingKg:  number;
  pricePerKg:   number;
  crudProteinPct?: number;
  mycotoxinPpb?:   number;
}

interface RawMaterial {
  id:           string;
  name:         string;
  materialType: string;
  minStockKg:   number;
  lots:         MaterialLot[];
  _count:       { formulaIngredients: number };
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  PROTEIN:  { bg: "var(--info-subtle)",    color: "var(--info-text)" },
  ENERGY:   { bg: "var(--warning-subtle)", color: "var(--warning-text)" },
  NUCLEUS:  { bg: "var(--accent-subtle)",  color: "var(--accent-text)" },
  ADDITIVE: { bg: "var(--success-subtle)", color: "var(--success-text)" },
  MINERAL:  { bg: "var(--bg-overlay)",     color: "var(--text-secondary)" },
};
const TYPE_LABEL: Record<string, string> = {
  PROTEIN: "Proteína", ENERGY: "Energética", NUCLEUS: "Núcleo",
  ADDITIVE: "Aditivo", MINERAL: "Mineral",
};

const NUTRIENT_FIELDS = [
  { name: "crudProteinPct",          label: "Proteína (%)",      step: "0.01" },
  { name: "metabolizableEnergyKcal", label: "Energía (kcal/kg)", step: "1" },
  { name: "lysinePct",               label: "Lisina (%)",        step: "0.001" },
  { name: "methioninePct",           label: "Metionina (%)",     step: "0.001" },
  { name: "calciumPct",              label: "Calcio (%)",        step: "0.01" },
  { name: "phosphorusPct",           label: "Fósforo (%)",       step: "0.01" },
  { name: "moisturePct",             label: "Humedad (%)",       step: "0.1" },
  { name: "mycotoxinPpb",            label: "Micotoxinas (ppb)", step: "1" },
] as const;

export default function MateriasPrimasPage() {
  const { data: session } = useSession();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [lotDialog, setLotDialog] = useState<string | null>(null);
  const [showAi,    setShowAi]    = useState(false);

  const canEdit = session?.user.roles.some((r) => [1, 2, 4, 6].includes(r)) ?? false;

  function load() {
    fetch("/api/raw-materials").then((r) => r.json()).then((d) => { setMaterials(d); setLoading(false); });
  }
  useEffect(load, []);

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<RawMaterialLotInput>({ resolver: zodResolver(rawMaterialLotSchema) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyAiData(data: any) {
    const fields: Array<keyof RawMaterialLotInput> = [
      "lotCode", "crudProteinPct", "metabolizableEnergyKcal", "lysinePct",
      "methioninePct", "calciumPct", "phosphorusPct", "moisturePct", "mycotoxinPpb",
    ];
    fields.forEach((k) => { if (data[k] != null) setValue(k, data[k]); });
    setShowAi(false);
  }

  async function onSubmitLot(data: RawMaterialLotInput) {
    const res = await fetch("/api/raw-materials/lots", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...data, rawMaterialId: lotDialog }),
    });
    if (res.ok) { setLotDialog(null); reset(); setShowAi(false); load(); }
  }

  return (
    <>
      <Topbar title="Materias primas" icon={IconPackage} iconColor="var(--info)" />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : materials.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "48px 0",
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
          }}>
            <IconPackage size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No hay materias primas registradas</div>
          </div>
        ) : (
          materials.map((m) => {
            const totalStock = m.lots.reduce((s, l) => s + Number(l.remainingKg), 0);
            const isLow      = totalStock < Number(m.minStockKg ?? 0);
            const latestLot  = m.lots[0];

            return (
              <div key={m.id} style={{
                background: "var(--bg-surface)",
                border: `0.5px solid ${isLow ? "var(--danger-border)" : "var(--border-default)"}`,
                borderRadius: "var(--radius-lg)", overflow: "hidden",
              }}>
                {/* Header */}
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", cursor: "pointer",
                    background: "var(--bg-elevated)",
                  }}
                  onClick={() => setExpanded((p) => ({ ...p, [m.id]: !p[m.id] }))}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-overlay)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {expanded[m.id]
                      ? <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</span>
                        {TYPE_STYLE[m.materialType] && (
                          <span className="badge" style={{
                            background: TYPE_STYLE[m.materialType].bg,
                            color: TYPE_STYLE[m.materialType].color,
                            border: "none",
                          }}>
                            {TYPE_LABEL[m.materialType] ?? m.materialType}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {m._count.formulaIngredients} fórmulas
                        {latestLot && ` · Lote: ${latestLot.lotCode}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: isLow ? "var(--danger)" : "var(--text-primary)" }}>
                        {totalStock.toFixed(0)} kg
                      </div>
                      {isLow && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--danger)" }}>
                          <IconAlertTriangle size={11} />
                          <span style={{ fontSize: 10 }}>Stock bajo</span>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        className="btn"
                        style={{ height: 28, fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); setLotDialog(m.id); }}
                      >
                        <IconPlus size={12} aria-hidden /> Lote
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded lots table */}
                {expanded[m.id] && m.lots.length > 0 && (
                  <div style={{ overflowX: "auto", borderTop: "0.5px solid var(--border-default)" }}>
                    <table className="kp-table" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Lote</th>
                          <th>Recibido</th>
                          <th style={{ textAlign: "right" }}>Qty kg</th>
                          <th style={{ textAlign: "right" }}>Restante</th>
                          <th style={{ textAlign: "right" }}>Precio/kg</th>
                          <th style={{ textAlign: "right" }}>Proteína</th>
                          <th style={{ textAlign: "right" }}>Micotox.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.lots.map((lot) => (
                          <tr key={lot.id}>
                            <td style={{ fontFamily: "monospace" }}>{lot.lotCode}</td>
                            <td>{new Date(lot.receivedDate).toLocaleDateString("es-PY")}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{Number(lot.quantityKg).toFixed(0)}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{Number(lot.remainingKg).toFixed(0)}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>${Number(lot.pricePerKg).toLocaleString("es-PY")}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                              {lot.crudProteinPct != null ? `${Number(lot.crudProteinPct).toFixed(1)}%` : "—"}
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                              {lot.mycotoxinPpb != null ? (
                                <span style={{ color: Number(lot.mycotoxinPpb) > 200 ? "var(--danger)" : undefined, fontWeight: Number(lot.mycotoxinPpb) > 200 ? 500 : 400 }}>
                                  {Number(lot.mycotoxinPpb).toFixed(0)} ppb
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dialog: registrar lote */}
      <Dialog open={lotDialog !== null} onOpenChange={(o) => { if (!o) { setLotDialog(null); reset(); setShowAi(false); } }}>
        <DialogContent style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)", maxWidth: "42rem",
          maxHeight: "85vh", overflowY: "auto",
        }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              Registrar nuevo lote
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              type="button"
              className="btn"
              style={{ width: "100%", justifyContent: "center", height: 34 }}
              onClick={() => setShowAi((p) => !p)}
            >
              <IconSparkles size={13} style={{ color: "var(--accent)" }} aria-hidden />
              {showAi ? "Ocultar asistente IA" : "Extraer datos del PDF con IA (recomendado)"}
            </button>

            {showAi && <AiAssistant onApply={applyAiData} />}

            <form onSubmit={handleSubmit(onSubmitLot)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" {...register("rawMaterialId")} value={lotDialog ?? ""} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="kp-label">Código de lote *</label>
                  <input className="kp-input" {...register("lotCode")} placeholder="LOT-2026-001" />
                  {errors.lotCode && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.lotCode.message}</div>}
                </div>
                <div>
                  <label className="kp-label">Fecha de recepción *</label>
                  <input type="date" className="kp-input" {...register("receivedDate")} />
                  {errors.receivedDate && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.receivedDate.message}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="kp-label">Cantidad recibida (kg) *</label>
                  <input type="number" step="0.1" className="kp-input" {...register("quantityKg")} />
                  {errors.quantityKg && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.quantityKg.message}</div>}
                </div>
                <div>
                  <label className="kp-label">Precio por kg (Gs.) *</label>
                  <input type="number" step="1" className="kp-input" {...register("pricePerKg")} />
                  {errors.pricePerKg && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>{errors.pricePerKg.message}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="kp-label">N.º de factura</label>
                  <input className="kp-input" {...register("invoiceNumber")} placeholder="001-001-0001234" />
                </div>
                <div>
                  <label className="kp-label">Fecha de vencimiento</label>
                  <input type="date" className="kp-input" {...register("expiryDate")} />
                </div>
              </div>

              <div style={{ borderTop: "0.5px solid var(--border-default)", paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Análisis nutricional (del certificado del proveedor)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {NUTRIENT_FIELDS.map((f) => (
                    <div key={f.name}>
                      <label className="kp-label">{f.label}</label>
                      <input
                        type="number" step={f.step} min={0} className="kp-input"
                        style={{ height: 30, fontSize: 12 }}
                        {...register(f.name as keyof RawMaterialLotInput)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                <button type="button" className="btn" onClick={() => { setLotDialog(null); reset(); setShowAi(false); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</> : "Registrar lote"}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
