"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/sesion-cliente";
import {
  IconChevronDown, IconChevronUp, IconLoader2, IconLayoutGrid,
  IconCircleCheck, IconClock, IconX, IconVaccine, IconArrowLeft,
  IconTrash, IconAlertTriangle,
} from "@tabler/icons-react";
import { FichaDrawer } from "@/components/plantel/ficha-drawer";

// Super Admin (1), Admin de granja (2), Jefe de Producción (5) — únicos
// roles que pueden eliminar un lote reproductivo.
const DELETE_LOTE_ROLES = [1, 2, 5];

type Estado =
  | "SERVIDA" | "REPITIO_CELO" | "PRENADA"
  | "EN_MATERNIDAD" | "DESTETADA" | "DESCARTADA";

interface Etapa { fecha: string; }
interface EtapaDiagnostico extends Etapa { resultado: string; }
interface EtapaParto extends Etapa { bornAlive: number; }
interface EtapaDestete extends Etapa { pigletsWeaned: number; }

interface CerdaLote {
  sowId:         string;
  caravana:      string;
  ubicacion:     string;
  estadoGeneral: Estado;
  etapas: {
    servicio:    Etapa;
    diagnostico: EtapaDiagnostico | null;
    parto:       EtapaParto | null;
    destete:     EtapaDestete | null;
  };
  ultimaVacunacion: { nombre: string | null; fecha: string } | null;
}

interface Lote {
  batchId:       string;
  code:          string | null;
  weekLabel:     string;
  notes:         string | null;
  fechaServicio: string | null;
  fechaPartoProyectada: string | null;
  totalCerdas:   number;
  resumen:       Record<Estado, number>;
  cerdas:        CerdaLote[];
}

const ESTADO_LABEL: Record<Estado, string> = {
  SERVIDA:       "Servida",
  REPITIO_CELO:  "Repitió celo",
  PRENADA:       "Preñada",
  EN_MATERNIDAD: "En maternidad",
  DESTETADA:     "Destetada",
  DESCARTADA:    "Descartada",
};

const ESTADO_COLOR: Record<Estado, string> = {
  SERVIDA:       "var(--text-secondary)",
  REPITIO_CELO:  "var(--warning-text)",
  PRENADA:       "var(--info-text)",
  EN_MATERNIDAD: "var(--accent)",
  DESTETADA:     "var(--success-text)",
  DESCARTADA:    "var(--danger-text)",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StageChip({ label, done, pending, sub }: { label: string; done: boolean; pending: boolean; sub?: string }) {
  const color = done ? "var(--success-text)" : pending ? "var(--text-muted)" : "var(--warning-text)";
  const bg    = done ? "var(--success-subtle)" : pending ? "var(--bg-overlay)" : "var(--warning-subtle)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500,
      padding: "3px 7px", borderRadius: "var(--radius-sm)", background: bg, color,
      border: `0.5px solid ${done ? "var(--success-border)" : "var(--border-default)"}`,
      whiteSpace: "nowrap",
    }}>
      {done ? <IconCircleCheck size={10} /> : <IconClock size={10} />}
      {label}{sub ? `: ${sub}` : ""}
    </div>
  );
}

function ResumenBar({ resumen, total }: { resumen: Record<Estado, number>; total: number }) {
  const order: Estado[] = ["PRENADA", "EN_MATERNIDAD", "DESTETADA", "SERVIDA", "REPITIO_CELO", "DESCARTADA"];
  const parts = order.filter(e => resumen[e] > 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", height: 6, width: 120, borderRadius: 99, overflow: "hidden", background: "var(--border-default)" }}>
        {parts.map(e => (
          <div key={e} style={{ width: `${(resumen[e] / total) * 100}%`, background: ESTADO_COLOR[e] }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {parts.map(e => `${resumen[e]} ${ESTADO_LABEL[e].toLowerCase()}`).join(" · ")}
      </span>
    </div>
  );
}

function ConfirmDeleteModal({
  lote, onCancel, onConfirm, deleting,
}: {
  lote: Lote; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  const serviced = lote.resumen.SERVIDA + lote.resumen.PRENADA + lote.resumen.EN_MATERNIDAD
    + lote.resumen.DESTETADA + lote.resumen.REPITIO_CELO + lote.resumen.DESCARTADA;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onCancel}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "0.5px solid var(--danger)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "14px 20px", background: "var(--danger-subtle)", borderBottom: "0.5px solid var(--danger)", display: "flex", alignItems: "center", gap: 10 }}>
          <IconAlertTriangle size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--danger-text)" }}>Eliminar lote {lote.code}</span>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>
            Se va a eliminar el lote <strong>{lote.code}</strong> ({lote.totalCerdas} cerdas).
          </p>
          {serviced > 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "10px 0 0", lineHeight: 1.6 }}>
              {serviced} cerda{serviced > 1 ? "s" : ""} de este lote ya {serviced > 1 ? "fueron servidas" : "fue servida"} — esos servicios{" "}
              <strong>no se van a borrar</strong>, las cerdas siguen figurando como servidas. Solo se elimina la agrupación del lote.
            </p>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8, background: "var(--bg-elevated)" }}>
          <button className="btn" onClick={onCancel} disabled={deleting}>Cancelar</button>
          <button
            className="btn"
            style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "white", display: "flex", alignItems: "center", gap: 6 }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Eliminando…</> : <><IconTrash size={13} /> Eliminar lote</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CerdaRow({ cerda, isFirst, onVerFicha }: { cerda: CerdaLote; isFirst: boolean; onVerFicha: (sowId: string) => void }) {
  const { etapas } = cerda;
  return (
    <div style={{ padding: "10px 16px", borderTop: isFirst ? undefined : "0.5px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 140 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{cerda.caravana}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: ESTADO_COLOR[cerda.estadoGeneral] }}>
              ● {ESTADO_LABEL[cerda.estadoGeneral]}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{cerda.ubicacion}</div>
        </div>

        <button
          onClick={() => onVerFicha(cerda.sowId)}
          className="btn"
          style={{ fontSize: 10, height: 24 }}
        >
          Ver ficha
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <StageChip label="Servicio" done pending={false} sub={fmtDate(etapas.servicio.fecha)} />
        <StageChip
          label="Diagnóstico"
          done={!!etapas.diagnostico}
          pending={!etapas.diagnostico}
          sub={etapas.diagnostico
            ? (etapas.diagnostico.resultado === "PREGNANT" ? "Preñada" : etapas.diagnostico.resultado === "NOT_PREGNANT" ? "No preñada" : "Re-control")
            : undefined}
        />
        <StageChip label="Parto" done={!!etapas.parto} pending={!etapas.parto} sub={etapas.parto ? fmtDate(etapas.parto.fecha) : undefined} />
        <StageChip label="Destete" done={!!etapas.destete} pending={!etapas.destete} sub={etapas.destete ? fmtDate(etapas.destete.fecha) : undefined} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
          <IconVaccine size={11} />
          {cerda.ultimaVacunacion ? `${cerda.ultimaVacunacion.nombre ?? "Vacuna"} · ${fmtDate(cerda.ultimaVacunacion.fecha)}` : "Sin vacunas registradas"}
        </div>
      </div>
    </div>
  );
}

export function LotesView({ onBack }: { onBack?: () => void }) {
  const { data: session } = useSession();
  const canDelete = !!session?.user.roles.some((r) => DELETE_LOTE_ROLES.includes(r));

  const [lotes,   setLotes]   = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fichaSowId, setFichaSowId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/gestacion/lotes")
      .then(r => r.ok ? r.json() : [])
      .then((d: Lote[]) => {
        setLotes(d);
        if (d.length > 0) setExpanded(prev => prev ?? d[0].batchId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gestacion/lotes/${confirmDelete.batchId}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDelete(null);
        load();
      }
    } finally {
      setDeleting(false);
    }
  }

  const backLink = onBack && (
    <button
      onClick={onBack}
      style={{
        display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)",
        background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 14,
      }}
    >
      <IconArrowLeft size={13} /> Volver a Visión general
    </button>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
          <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando lotes…</span>
        </div>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div>
        {backLink}
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "40px 20px", textAlign: "center" }}>
          <IconLayoutGrid size={28} style={{ color: "var(--text-muted)", marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>Sin lotes creados aún</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
            Creá un lote seleccionando varias hembras en "Ingreso de datos → Registrar servicio".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {backLink}
      {fichaSowId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 340, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "flex-end" }}
          onClick={() => setFichaSowId(null)}
        >
          <div style={{ width: "min(460px, 100vw)", height: "100%", boxShadow: "-8px 0 32px rgba(0,0,0,0.3)", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setFichaSowId(null)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 1, background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", cursor: "pointer", padding: 5, display: "flex" }}
            >
              <IconX size={14} style={{ color: "var(--text-muted)" }} />
            </button>
            <FichaDrawer sowId={fichaSowId} canEdit={false} onClose={() => setFichaSowId(null)} />
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          lote={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lotes.map(lote => {
          const isOpen = expanded === lote.batchId;
          return (
            <div key={lote.batchId} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isOpen ? null : lote.batchId)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(isOpen ? null : lote.batchId); }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <IconLayoutGrid size={14} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{lote.code}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Servicio: {lote.fechaServicio ? fmtDate(lote.fechaServicio) : "—"}
                    {" · "}Parto estimado: {lote.fechaPartoProyectada ? fmtDate(lote.fechaPartoProyectada) : "—"}
                    {" · "}{lote.totalCerdas} cerdas
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ResumenBar resumen={lote.resumen} total={lote.totalCerdas} />
                  {canDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(lote); }}
                      title="Eliminar lote"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: "var(--radius-md)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                  {isOpen ? <IconChevronUp size={13} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={13} style={{ color: "var(--text-muted)" }} />}
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: "0.5px solid var(--border-default)" }}>
                  {lote.notes && (
                    <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", borderBottom: "0.5px solid var(--border-subtle)" }}>
                      {lote.notes}
                    </div>
                  )}
                  {lote.cerdas.map((cerda, i) => (
                    <CerdaRow key={cerda.sowId} cerda={cerda} isFirst={i === 0} onVerFicha={setFichaSowId} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
