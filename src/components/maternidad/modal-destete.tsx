"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weaningEventSchema, type WeaningEventInput } from "@/lib/validations/maternidad";
import { IconAlertTriangle, IconLoader2, IconScale, IconX } from "@tabler/icons-react";

const SOW_DESTINATIONS = [
  { value: "GESTATION", label: "Gestación" },
  { value: "CULL",      label: "Descarte"  },
  { value: "OTHER",     label: "Otro"      },
];

const BODY_SCORES = [1, 2, 3, 4, 5];
const BODY_LABELS = ["Muy delgada", "Delgada", "Normal", "Buena", "Obesa"];

interface Props {
  farrowing: {
    id:                  string;
    sow:                 { identCode: string };
    currentStock:        number;
    lactationDays:       number;
    hasActiveWithdrawal: boolean;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function ModalDestete({ farrowing, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<WeaningEventInput>({
      resolver: zodResolver(weaningEventSchema),
      defaultValues: {
        farrowingId:        farrowing.id,
        weaningDate:        new Date().toISOString().substring(0, 10),
        pigletsWeaned:      farrowing.currentStock,
        lastMinuteDeaths:   0,
        lastMinuteReceived: 0,
        lastMinuteDonated:  0,
        sowDestination:     "GESTATION",
      },
    });

  const [pigletsWeaned, totalWeight] = [watch("pigletsWeaned"), watch("totalLitterWeightKg")];
  const avgWeight = Number(pigletsWeaned) > 0 && Number(totalWeight) > 0
    ? (Number(totalWeight) / Number(pigletsWeaned)).toFixed(2)
    : null;

  async function onSubmit(data: WeaningEventInput) {
    setServerError(null);
    setBlockedUntil(null);
    const res = await fetch(`/api/farrowing-events/${farrowing.id}/weaning`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.blockedUntil) setBlockedUntil(err.blockedUntil);
      setServerError(err.error ?? "Error al guardar");
      return;
    }
    onSaved();
  }

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      zIndex:         50,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "rgba(0,0,0,0.55)",
    }}>
      <div className="kp-modal" style={{ width: 500 }}>
        {/* Header */}
        <div className="kp-modal-title">
          <IconScale size={15} style={{ color: "var(--success)" }} aria-hidden />
          Destete — Cerda {farrowing.sow.identCode}
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
          >
            <IconX size={16} aria-hidden />
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Stock disponible: <strong style={{ color: "var(--text-primary)" }}>{farrowing.currentStock} lechones</strong>
          {" · "}{farrowing.lactationDays} días de lactancia
        </p>

        {farrowing.hasActiveWithdrawal && (
          <div className="kp-alert kp-alert-danger" style={{ marginBottom: 12 }}>
            <IconAlertTriangle size={13} aria-hidden />
            Hay un período de retiro activo. El sistema bloqueará el registro si la fecha de destete está dentro del retiro.
          </div>
        )}

        {serverError && (
          <div className="kp-alert kp-alert-danger" style={{ marginBottom: 12 }}>
            <IconAlertTriangle size={13} aria-hidden />
            <div>
              <div>{serverError}</div>
              {blockedUntil && (
                <div style={{ fontWeight: 500, marginTop: 4 }}>
                  Habilitado a partir de: {new Date(blockedUntil).toLocaleDateString("es-PY")}
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Fecha + lechones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="kp-label">Fecha de destete *</label>
              <input className="kp-input" type="date" {...register("weaningDate")} />
              {errors.weaningDate && (
                <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.weaningDate.message}</p>
              )}
            </div>
            <div>
              <label className="kp-label">Lechones destetados *</label>
              <input className="kp-input" type="number" min={1} max={farrowing.currentStock + 10} {...register("pigletsWeaned")} />
              {errors.pigletsWeaned && (
                <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.pigletsWeaned.message}</p>
              )}
            </div>
          </div>

          {/* Peso total */}
          <div style={{ marginBottom: 12 }}>
            <label className="kp-label">Peso TOTAL de la camada (kg) *</label>
            <input
              className="kp-input"
              type="number"
              step="0.1"
              min={0}
              placeholder="Ej: 87.5 — peso todos juntos en la balanza"
              {...register("totalLitterWeightKg")}
            />
            {avgWeight && (
              <p style={{ fontSize: 11, color: "var(--success-text)", marginTop: 3, fontWeight: 500 }}>
                Peso medio calculado: {avgWeight} kg/lechón
              </p>
            )}
            {errors.totalLitterWeightKg && (
              <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.totalLitterWeightKg.message}</p>
            )}
          </div>

          {/* Movimientos último momento */}
          <div style={{
            background:   "var(--bg-overlay)",
            borderRadius: "var(--radius-md)",
            padding:      "10px 12px",
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
              Movimientos de último momento (opcional)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Muertes finales", field: "lastMinuteDeaths"   as const },
                { label: "Recibidos",        field: "lastMinuteReceived" as const },
                { label: "Donados",          field: "lastMinuteDonated"  as const },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="kp-label" style={{ fontSize: 10 }}>{label}</label>
                  <input className="kp-input" type="number" min={0} {...register(field)} />
                </div>
              ))}
            </div>
          </div>

          {/* Destino cerda + condición corporal */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label className="kp-label">Destino de la madre</label>
              <select
                className="kp-input"
                style={{ appearance: "auto" }}
                defaultValue="GESTATION"
                onChange={(e) => setValue("sowDestination", e.target.value as WeaningEventInput["sowDestination"])}
              >
                {SOW_DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="kp-label">Condición corporal</label>
              <select
                className="kp-input"
                style={{ appearance: "auto" }}
                defaultValue=""
                onChange={(e) => setValue("bodyConditionScore", e.target.value as WeaningEventInput["bodyConditionScore"])}
              >
                <option value="">Opcional</option>
                {BODY_SCORES.map((n) => (
                  <option key={n} value={`SCORE_${n}`}>
                    {n} — {BODY_LABELS[n - 1]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ minWidth: 140 }}>
              {isSubmitting ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Registrar destete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
