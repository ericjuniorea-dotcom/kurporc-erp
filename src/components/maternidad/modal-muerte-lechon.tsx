"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pigletDeathSchema, type PigletDeathInput } from "@/lib/validations/maternidad";
import { IconAlertTriangle, IconLoader2, IconX } from "@tabler/icons-react";

const CAUSES = [
  { value: "WEAKNESS",    label: "Flaqueza"          },
  { value: "CRUSHING",    label: "Aplastamiento"      },
  { value: "DIARRHEA",    label: "Diarrea"            },
  { value: "DEFICIENT",   label: "Deficiente"         },
  { value: "DISEASE",     label: "Enfermedad"         },
  { value: "SHELTER",     label: "Refugio"            },
  { value: "HYPOTHERMIA", label: "Hipotermia"         },
  { value: "ACCIDENT",    label: "Accidente"          },
  { value: "CONGENITAL",  label: "Defecto congénito"  },
  { value: "ELIMINATED",  label: "Eliminado"          },
  { value: "OTHER",       label: "Otra"               },
] as const;

interface Props {
  farrowing: { id: string; sow: { identCode: string }; currentStock: number };
  onClose:   () => void;
  onSaved:   () => void;
}

export function ModalMuerteLechon({ farrowing, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<PigletDeathInput>({
      resolver: zodResolver(pigletDeathSchema),
      defaultValues: {
        farrowingId:   farrowing.id,
        deathDatetime: new Date().toISOString().slice(0, 16),
        quantity:      1,
      },
    });

  const quantity = watch("quantity");

  async function onSubmit(data: PigletDeathInput) {
    setServerError(null);
    const res = await fetch(`/api/farrowing-events/${farrowing.id}/deaths`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setServerError(err.error ?? "Error al guardar");
      return;
    }
    onSaved();
  }

  return (
    <div style={{
      position:  "fixed",
      inset:     0,
      zIndex:    50,
      display:   "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
    }}>
      <div className="kp-modal" style={{ width: 460 }}>
        {/* Header */}
        <div className="kp-modal-title">
          <IconAlertTriangle size={15} style={{ color: "var(--danger)" }} aria-hidden />
          Muerte de lechón — Cerda {farrowing.sow.identCode}
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
          >
            <IconX size={16} aria-hidden />
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Stock actual: <strong style={{ color: "var(--text-primary)" }}>{farrowing.currentStock} lechones</strong>
        </p>

        {serverError && (
          <div className="kp-alert kp-alert-danger" style={{ marginBottom: 14 }}>
            <IconAlertTriangle size={13} aria-hidden />
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="kp-label">Fecha y hora *</label>
              <input className="kp-input" type="datetime-local" {...register("deathDatetime")} />
              {errors.deathDatetime && (
                <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.deathDatetime.message}</p>
              )}
            </div>
            <div>
              <label className="kp-label">Cantidad *</label>
              <input className="kp-input" type="number" min={1} max={farrowing.currentStock} {...register("quantity")} />
              {Number(quantity) > farrowing.currentStock && (
                <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>
                  Supera el stock disponible ({farrowing.currentStock})
                </p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="kp-label">Causa *</label>
            <select
              className="kp-input"
              style={{ appearance: "auto" }}
              onChange={(e) => setValue("cause", e.target.value as PigletDeathInput["cause"])}
              defaultValue=""
            >
              <option value="" disabled>Seleccioná la causa</option>
              {CAUSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.cause && (
              <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.cause.message}</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-danger" disabled={isSubmitting} style={{ minWidth: 130 }}>
              {isSubmitting ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Registrar muerte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
