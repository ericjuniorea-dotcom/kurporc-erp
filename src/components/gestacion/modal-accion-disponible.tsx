"use client";
import { useState } from "react";
import { IconX, IconHeart, IconDroplet } from "@tabler/icons-react";
import { ServicioFields, type SowLite } from "./servicio-fields";
import { RegistrarCeloForm } from "./registrar-celo-form";

export interface DisponibleSow extends SowLite {
  caravana:  string;
  ubicacion: string;
}

type Mode = "servicio" | "celo";

export function ModalAccionDisponible({
  sow,
  serviceBatchId,
  defaultServiceDate,
  zIndex = 320,
  onClose,
  onSuccess,
}: {
  sow: DisponibleSow;
  serviceBatchId?: string;
  defaultServiceDate?: string;
  zIndex?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const esPrimeriza = sow.currentParityCount === 0;
  const [mode, setMode] = useState<Mode>("servicio");

  function handleDone() {
    onSuccess();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 520,
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: "0.5px solid var(--border-default)",
            background: "var(--bg-elevated)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Cerda {sow.caravana}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {sow.ubicacion}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: "var(--radius-md)" }}
          >
            <IconX size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px 20px" }}>
          {/* Selector de acción — solo para primerizas */}
          {esPrimeriza && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setMode("celo")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 10px", fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${mode === "celo" ? "var(--info)" : "var(--border-default)"}`,
                  borderRadius: "var(--radius-md)",
                  background: mode === "celo" ? "var(--info-subtle)" : "var(--bg-surface)",
                  color: mode === "celo" ? "var(--info-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <IconDroplet size={13} />
                Registrar último celo
              </button>
              <button
                type="button"
                onClick={() => setMode("servicio")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 10px", fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${mode === "servicio" ? "var(--success)" : "var(--border-default)"}`,
                  borderRadius: "var(--radius-md)",
                  background: mode === "servicio" ? "var(--success-subtle)" : "var(--bg-surface)",
                  color: mode === "servicio" ? "var(--success-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <IconHeart size={13} />
                Registrar servicio
              </button>
            </div>
          )}

          {esPrimeriza && mode === "celo" ? (
            <RegistrarCeloForm sow={sow} onDone={handleDone} onCancel={onClose} />
          ) : (
            <ServicioFields
              sow={sow}
              serviceBatchId={serviceBatchId}
              defaultServiceDate={defaultServiceDate}
              onDone={handleDone}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
