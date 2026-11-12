"use client";
import { useEffect, useState, useCallback } from "react";
import { ModalMuerteLechon } from "./modal-muerte-lechon";
import { ModalDestete }      from "./modal-destete";
import { ModalAdopcion }     from "./modal-adopcion";
import { formatDate, formatWeight } from "@/lib/utils";
import {
  IconBabyCarriage, IconAlertTriangle, IconClock, IconCircleCheck,
  IconSkull, IconArrowsLeftRight, IconScale,
} from "@tabler/icons-react";

import { CaravanaFicha } from "@/components/plantel/caravana-ficha";
interface FarrowingRow {
  id:                  string;
  codigo?:             string | null;
  sow:                 { id: string; identCode: string; currentParityCount: number };
  startDatetime:       string;
  bornAlive:           number;
  bornDead:            number;
  mummified:           number;
  totalLitterWeightKg: number;
  avgPigletWeightKg:   number | null;
  pen:                 { number: string; location: { name: string } } | null;
  currentStock:        number;
  lactationDays:       number;
  expectedWeaningDate: string;
  hasActiveWithdrawal: boolean;
  healthTasks:         { protocolTask: { taskName: string; taskType: string }; dueDate: string }[];
  withdrawalPeriods:   { endDate: string; medicine: { name: string } }[];
}

interface ListaMaternidadProps {
  canRegisterEvents:     boolean;
  canApproveAdjustments: boolean;
}

export function ListaMaternidad({ canRegisterEvents }: ListaMaternidadProps) {
  const [farrowings, setFarrowings] = useState<FarrowingRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalDeath,  setModalDeath]  = useState<FarrowingRow | null>(null);
  const [modalWean,   setModalWean]   = useState<FarrowingRow | null>(null);
  const [modalAdopt,  setModalAdopt]  = useState<FarrowingRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/farrowing-events?active=true")
      .then((r) => r.json())
      .then((d) => { setFarrowings(Array.isArray(d) ? d : []); })
      .catch(() => { setFarrowings([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            height: 120,
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border-default)",
            opacity: 0.5,
          }} />
        ))}
      </div>
    );
  }

  if (farrowings.length === 0) {
    return (
      <div style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "40px 20px",
        textAlign: "center",
      }}>
        <IconBabyCarriage size={32} style={{ color: "var(--text-muted)", marginBottom: 10 }} aria-hidden />
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>Sin partos activos</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Registrá el primer parto para comenzar.</p>
      </div>
    );
  }

  const overdueWeaning = farrowings.filter(
    (f) => new Date(f.expectedWeaningDate) < new Date()
  );

  return (
    <>
      {overdueWeaning.length > 0 && (
        <div className="kp-alert kp-alert-warn" style={{ marginBottom: 8 }}>
          <IconAlertTriangle size={13} aria-hidden />
          <span>
            <strong>{overdueWeaning.length} cerda{overdueWeaning.length > 1 ? "s" : ""}</strong>{" "}
            superaron la fecha esperada de destete.
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {farrowings.map((f) => (
          <CardCerdaMaternidad
            key={f.id}
            farrowing={f}
            canRegister={canRegisterEvents}
            onDeath={() => setModalDeath(f)}
            onAdopt={() => setModalAdopt(f)}
            onWean={() => setModalWean(f)}
            onRefresh={load}
          />
        ))}
      </div>

      {modalDeath && (
        <ModalMuerteLechon
          farrowing={modalDeath}
          onClose={() => setModalDeath(null)}
          onSaved={() => { setModalDeath(null); load(); }}
        />
      )}

      {modalAdopt && (
        <ModalAdopcion
          farrowing={modalAdopt}
          onClose={() => setModalAdopt(null)}
          onSaved={() => { setModalAdopt(null); load(); }}
        />
      )}

      {modalWean && (
        <ModalDestete
          farrowing={modalWean}
          onClose={() => setModalWean(null)}
          onSaved={() => { setModalWean(null); load(); }}
        />
      )}
    </>
  );
}

interface CardProps {
  farrowing:   FarrowingRow;
  canRegister: boolean;
  onDeath:     () => void;
  onAdopt:     () => void;
  onWean:      () => void;
  onRefresh:   () => void;
}

function CardCerdaMaternidad({ farrowing: f, canRegister, onDeath, onAdopt, onWean }: CardProps) {
  const isOverdueWeaning = new Date(f.expectedWeaningDate) < new Date();
  const nextTask         = f.healthTasks[0];
  const isOverdueTask    = nextTask && new Date(nextTask.dueDate) < new Date();

  const stockBg    = f.currentStock <= 0 ? "var(--danger-subtle)"  : f.currentStock <= 3 ? "var(--warning-subtle)" : "var(--success-subtle)";
  const stockColor = f.currentStock <= 0 ? "var(--danger-text)"    : f.currentStock <= 3 ? "var(--warning-text)"   : "var(--success-text)";

  return (
    <div style={{
      background:   "var(--bg-surface)",
      border:       `0.5px solid ${isOverdueWeaning ? "var(--warning-border)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-lg)",
      padding:      "14px",
    }}>
      {/* Fila superior: identidad + stock */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
            Cerda <CaravanaFicha sowId={f.sow.id} caravana={f.sow.identCode} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {f.codigo ? `${f.codigo} · ` : ""}Parto #{f.sow.currentParityCount} · {formatDate(f.startDatetime)}
            {f.pen && ` · ${f.pen.location.name} corral ${f.pen.number}`}
          </div>
        </div>

        {/* Stock lechones */}
        <div style={{
          background:   stockBg,
          borderRadius: "var(--radius-md)",
          padding:      "6px 14px",
          textAlign:    "center",
          flexShrink:   0,
        }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: stockColor, lineHeight: 1 }}>
            {f.currentStock}
          </div>
          <div style={{ fontSize: 10, color: stockColor, marginTop: 2 }}>lechones</div>
        </div>
      </div>

      {/* Datos del parto */}
      <div style={{
        display:       "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap:           1,
        background:    "var(--border-default)",
        borderRadius:  "var(--radius-md)",
        overflow:      "hidden",
        marginBottom:  10,
      }}>
        {[
          { label: "Nacidos vivos", value: f.bornAlive },
          { label: "Peso medio",    value: f.avgPigletWeightKg ? formatWeight(Number(f.avgPigletWeightKg)) : "—" },
          { label: "Días lactancia",value: f.lactationDays },
        ].map((item) => (
          <div key={item.label} style={{
            background: "var(--bg-overlay)",
            padding:    "8px 10px",
            textAlign:  "center",
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Badges de estado */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: canRegister ? 10 : 0 }}>
        {isOverdueWeaning ? (
          <span className="badge badge-warn">
            <IconAlertTriangle size={10} aria-hidden />
            Destete vencido ({formatDate(f.expectedWeaningDate)})
          </span>
        ) : (
          <span className="badge" style={{ background: "var(--bg-overlay)", color: "var(--text-muted)", border: "0.5px solid var(--border-strong)" }}>
            <IconClock size={10} aria-hidden />
            Destete: {formatDate(f.expectedWeaningDate)}
          </span>
        )}
        {f.hasActiveWithdrawal && (
          <span className="badge badge-danger">
            <IconAlertTriangle size={10} aria-hidden />
            Retiro activo hasta {formatDate(f.withdrawalPeriods[0]?.endDate)}
          </span>
        )}
        {nextTask && (
          <span className={`badge ${isOverdueTask ? "badge-danger" : "badge-info"}`}>
            <IconCircleCheck size={10} aria-hidden />
            {nextTask.protocolTask.taskName} — {formatDate(nextTask.dueDate)}
          </span>
        )}
      </div>

      {/* Acciones */}
      {canRegister && (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" onClick={onDeath} style={{ fontSize: 11 }}>
            <IconSkull size={12} aria-hidden />
            Muerte lechón
          </button>
          <button className="btn" onClick={onAdopt} style={{ fontSize: 11 }}>
            <IconArrowsLeftRight size={12} aria-hidden />
            Adopción
          </button>
          <button
            className="btn"
            onClick={onWean}
            disabled={f.hasActiveWithdrawal}
            title={f.hasActiveWithdrawal ? "Período de retiro activo" : ""}
            style={{ fontSize: 11, opacity: f.hasActiveWithdrawal ? 0.4 : 1 }}
          >
            <IconScale size={12} aria-hidden />
            Destetar
          </button>
        </div>
      )}
    </div>
  );
}
