"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/sesion-cliente";
import { useRouter }         from "next/navigation";
import { BatchCard }         from "@/components/recria/batch-card";
import { TareasModuloPanel } from "@/components/shared/tareas-modulo-panel";
import { Topbar }            from "@/components/layout/topbar";
import { IconBuildingWarehouse, IconSearch, IconRefresh, IconLoader2 } from "@tabler/icons-react";

interface Batch {
  id:           string;
  batchCode:    string;
  phase:        "PHASE_1" | "PHASE_2";
  currentCount: number;
  entryDate:    string;
  avgWeightKg:  number | null;
  pen:          { number: string; location: { name: string } } | null;
  weightRecords: Array<{ id: string; recordDate: string; avgWeightKg: number; dailyGainKg: number | null; animalCount: number }>;
  phaseChanges:  Array<{ toPhase: string; changeDate: string }>;
  _count:        { weanings: number };
}

export default function RecriaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,         setTab]         = useState("vision");
  const [batches,     setBatches]     = useState<Batch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("ALL");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
  }, [status, router]);

  const canEdit = session?.user.roles.some(r => [1, 2, 4, 5, 12, 13].includes(r)) ?? false;

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/nursery-batches?active=true")
      .then(r => r.json())
      .then(d => { setBatches(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = batches.filter(b => {
    const matchQ = !query || b.batchCode.toLowerCase().includes(query.toLowerCase());
    const matchP = phaseFilter === "ALL" || b.phase === phaseFilter;
    return matchQ && matchP;
  });

  const totalAnimals  = filtered.reduce((s, b) => s + b.currentCount, 0);
  const phase1Animals = filtered.filter(b => b.phase === "PHASE_1").reduce((s, b) => s + b.currentCount, 0);
  const phase2Animals = filtered.filter(b => b.phase === "PHASE_2").reduce((s, b) => s + b.currentCount, 0);
  const phase1Count   = filtered.filter(b => b.phase === "PHASE_1").length;
  const phase2Count   = filtered.filter(b => b.phase === "PHASE_2").length;

  const allPhase1    = batches.filter(b => b.phase === "PHASE_1");
  const allPhase2    = batches.filter(b => b.phase === "PHASE_2");
  const allP1Animals = allPhase1.reduce((s, b) => s + b.currentCount, 0);
  const allP2Animals = allPhase2.reduce((s, b) => s + b.currentCount, 0);
  const allTotal     = allP1Animals + allP2Animals;
  const p1Pct = allTotal > 0 ? Math.round((allP1Animals / allTotal) * 100) : 0;
  const p2Pct = allTotal > 0 ? Math.round((allP2Animals / allTotal) * 100) : 0;

  if (status === "loading" || !session) return null;

  return (
    <>
      <Topbar
        title="Iniciación"
        icon={IconBuildingWarehouse}
        iconColor="var(--info)"
        tabs={[
          { key: "vision",   label: "Visión general"      },
          { key: "analisis", label: "Central de análisis" },
        ]}
        activeTab={tab === "ingreso" ? "" : tab}
        onTabChange={setTab}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => setTab(tab === "ingreso" ? "vision" : "ingreso")}
          >
            Ingreso de datos
          </button>
        }
        configHref="/configuracion?modulo=RECRIA&tab=Metas"
      />

      {/* ── VISIÓN GENERAL ─────────────────────────────────────── */}
      {tab === "vision" && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {!loading && batches.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--info-border)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--info-text)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Fase 1 — Iniciación</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--info)", lineHeight: 1 }}>{allP1Animals.toLocaleString("es-PY")}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>animales en {allPhase1.length} lotes</div>
                <div style={{ marginTop: 8, height: 4, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p1Pct}%`, background: "var(--info)", borderRadius: 99 }} />
                </div>
              </div>
              <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--accent-border)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-text)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Fase 2 — Desarrollo</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{allP2Animals.toLocaleString("es-PY")}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>animales en {allPhase2.length} lotes</div>
                <div style={{ marginTop: 8, height: 4, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p2Pct}%`, background: "var(--accent)", borderRadius: 99 }} />
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ background: "var(--bg-overlay)", borderRadius: "var(--radius-lg)", height: 90, border: "0.5px solid var(--border-default)" }} />
              ))}
            </div>
          )}
          <TareasModuloPanel sector="iniciacion" accentColor="var(--info)" />
        </div>
      )}

      {/* ── INGRESO DE DATOS ──────────────────────────────────── */}
      {tab === "ingreso" && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input placeholder="Buscar lote..." value={query} onChange={e => setQuery(e.target.value)} className="kp-input" style={{ paddingLeft: 26, height: 28, fontSize: 11, width: 160 }} />
            </div>
            <div style={{ display: "flex", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 2, border: "0.5px solid var(--border-default)" }}>
              {[{ value: "ALL", label: "Todas" }, { value: "PHASE_1", label: "Fase 1" }, { value: "PHASE_2", label: "Fase 2" }].map(opt => (
                <button key={opt.value} onClick={() => setPhaseFilter(opt.value)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: phaseFilter === opt.value ? "var(--bg-surface)" : "transparent",
                  color:      phaseFilter === opt.value ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: phaseFilter === opt.value ? 500 : 400,
                }}>{opt.label}</button>
              ))}
            </div>
            <button className="btn" onClick={load} title="Actualizar"><IconRefresh size={13} /></button>
          </div>

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--info)", display: "inline-block" }} />
                {filtered.length} lotes · {totalAnimals.toLocaleString()} animales
              </span>
              {phase1Count > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--info-subtle)", border: "0.5px solid var(--info-border)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "var(--info-text)" }}>
                  Fase 1: <strong>{phase1Animals.toLocaleString()}</strong> animales <span style={{ opacity: 0.6 }}>({phase1Count} lotes)</span>
                </span>
              )}
              {phase2Count > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-subtle)", border: "0.5px solid var(--accent-border)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "var(--accent-text)" }}>
                  Fase 2: <strong>{phase2Animals.toLocaleString()}</strong> animales <span style={{ opacity: 0.6 }}>({phase2Count} lotes)</span>
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
              <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Cargando lotes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
              <IconBuildingWarehouse size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No hay lotes de iniciación activos</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Los lotes se crean automáticamente al registrar un destete</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(batch => (
                <BatchCard key={batch.id} batch={batch} canEdit={canEdit} onRefresh={load} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CENTRAL DE ANÁLISIS ──────────────────────────────── */}
      {tab === "analisis" && (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", flexDirection: "column", gap: 8 }}>
            <IconBuildingWarehouse size={32} style={{ color: "var(--text-muted)" }} />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Central de análisis — Iniciación</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Próximamente: GDP por fase, conversión alimenticia y proyecciones</div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
