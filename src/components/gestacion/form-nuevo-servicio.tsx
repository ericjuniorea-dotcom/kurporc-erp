"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { serviceEventSchema, type ServiceEventInput } from "@/lib/validations/gestacion";
import { IconAlertTriangle, IconCircleCheck, IconLoader2, IconSearch, IconRefresh, IconLock } from "@tabler/icons-react";

interface Sow {
  id: string;
  identCode: string;
  breed: string | null;
  currentParityCount: number;
}

interface PreviousService {
  id: string;
  serviceDate: string;
  serviceBatch: { weekLabel: string };
}

interface EligibilityBlocker {
  tipo: "QUARANTINE" | "PESO_INSUFICIENTE" | "DIAS_INSUFICIENTES" | "VACUNAS_FALTANTES";
  mensaje: string;
}

interface EligibilityResult {
  eligible: boolean;
  blockers: EligibilityBlocker[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "0.5px solid var(--border-default)",
          background: "var(--bg-elevated)",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

/* ─── Modal de confirmación de repetición de celo ──────────────── */

function RepeatCeloModal({
  sow,
  previousService,
  onConfirm,
  onCancel,
}: {
  sow: Sow | undefined;
  previousService: PreviousService;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fechaAnterior = new Date(previousService.serviceDate).toLocaleDateString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "0.5px solid var(--warning)",
          borderRadius: "var(--radius-xl)",
          width: "100%", maxWidth: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "0.5px solid var(--warning)",
            background: "var(--warning-subtle)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <IconRefresh size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--warning-text)" }}>
            Repetición de celo detectada
          </span>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "20px 20px 16px" }}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.65 }}>
            La cerda <strong>{sow?.identCode}</strong> ya fue servida el{" "}
            <strong>{fechaAnterior}</strong> (Lote {previousService.serviceBatch.weekLabel}) y
            no tiene parto confirmado.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "12px 0 0", lineHeight: 1.65 }}>
            Al continuar se registrará automáticamente una{" "}
            <strong style={{ color: "var(--warning-text)" }}>repetición de celo</strong> en
            su historial. La cerda pasará al nuevo lote de servicio.
          </p>
        </div>

        {/* Pie */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "0.5px solid var(--border-default)",
            display: "flex", justifyContent: "flex-end", gap: 8,
            background: "var(--bg-elevated)",
          }}
        >
          <button className="btn" style={{ fontSize: 12 }} onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{
              fontSize: 12, fontWeight: 600,
              background: "var(--warning)", borderColor: "var(--warning)", color: "white",
            }}
            onClick={onConfirm}
          >
            <IconRefresh size={13} />
            Aceptar — Registrar como repetición
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulario principal ──────────────────────────────────────── */

export function FormNuevoServicio() {
  const router = useRouter();
  const [sows, setSows]         = useState<Sow[]>([]);
  const [sowSearch, setSowSearch] = useState("");

  const [doseExpiredAlert, setDoseExpiredAlert] = useState(false);
  const [successMsg, setSuccessMsg]             = useState<string | null>(null);
  const [serverError, setServerError]           = useState<string | null>(null);
  const [heatRepeatMsg, setHeatRepeatMsg]       = useState<string | null>(null);

  const [previousService, setPreviousService]   = useState<PreviousService | null>(null);
  const [checkingPrevious, setCheckingPrevious] = useState(false);
  // Config del ciclo: leída una vez al montar
  const [cicloConfig, setCicloConfig]           = useState({ inseminaciones: 3, intervaloHoras: 12 });
  // Número de inseminación en el ciclo actual (si aplica)
  const [numeroCiclo, setNumeroCiclo]           = useState<number | null>(null);

  // Elegibilidad de la cerda seleccionada
  const [eligibility, setEligibility]           = useState<EligibilityResult | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Modal de confirmación
  const [showRepeatModal, setShowRepeatModal]   = useState(false);
  const [pendingData, setPendingData]           = useState<ServiceEventInput | null>(null);
  const [submitting, setSubmitting]             = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceEventInput>({
    resolver: zodResolver(serviceEventSchema),
    defaultValues: {
      serviceDate: new Date().toISOString().substring(0, 10),
      serviceType: "AI",
    },
  });

  const serviceType = watch("serviceType");
  const expiryDate  = watch("expiryDate");
  const sowId       = watch("sowId");

  // Cargar config del protocolo de inseminación
  useEffect(() => {
    fetch("/api/config/procesos?modulo=GESTACION")
      .then(r => r.json())
      .then((procesos: Array<{ procesoKey: string; valor: Record<string, unknown> }>) => {
        const p = procesos.find(x => x.procesoKey === "protocolo_inseminacion");
        if (p?.valor) {
          setCicloConfig({
            inseminaciones: Number(p.valor.inseminaciones_por_ciclo ?? 3),
            intervaloHoras: Number(p.valor.intervalo_horas ?? 12),
          });
        }
      })
      .catch(() => {});
  }, []);

  // Buscar cerdas con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/sows?q=${encodeURIComponent(sowSearch)}&active=true`)
        .then(r => r.json())
        .then(setSows);
    }, 300);
    return () => clearTimeout(timer);
  }, [sowSearch]);

  // Al seleccionar cerda, verificar elegibilidad + servicio reciente
  useEffect(() => {
    if (!sowId) {
      setPreviousService(null);
      setNumeroCiclo(null);
      setEligibility(null);
      return;
    }

    setCheckingPrevious(true);
    setCheckingEligibility(true);

    // Elegibilidad (cuarentena, peso, días, vacunas)
    fetch(`/api/gestacion/sow-eligibility?sowId=${sowId}`)
      .then(r => r.json())
      .then((data: EligibilityResult) => setEligibility(data))
      .catch(() => setEligibility(null))
      .finally(() => setCheckingEligibility(false));

    // Verificar ciclo / repetición de celo
    fetch(`/api/service-events?sowId=${sowId}`)
      .then(r => r.json())
      .then((events: Array<{
        id: string; serviceDate: string;
        farrowing: null | object;
        pregnancyChecks: Array<{ result: string }>;
        serviceBatch: { weekLabel: string };
      }>) => {
        const now      = new Date();
        const cutoff60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const cicloWindowMs = (cicloConfig.inseminaciones - 1) * cicloConfig.intervaloHoras * 60 * 60 * 1000 * 1.5;
        const cicloStart    = new Date(now.getTime() - Math.max(cicloWindowMs, 12 * 60 * 60 * 1000));

        const enCiclo = events.filter(ev => {
          if (ev.farrowing) return false;
          return new Date(ev.serviceDate) >= cicloStart;
        });

        if (enCiclo.length > 0) {
          setNumeroCiclo(enCiclo.length + 1);
          setPreviousService(null);
          return;
        }

        setNumeroCiclo(null);

        const candidate = events.find(ev => {
          if (ev.farrowing) return false;
          const d = new Date(ev.serviceDate);
          if (d < cutoff60) return false;
          if (ev.pregnancyChecks?.[0]?.result === "PREGNANT") return false;
          return true;
        });
        setPreviousService(candidate ?? null);
      })
      .catch(() => { setPreviousService(null); setNumeroCiclo(null); })
      .finally(() => setCheckingPrevious(false));
  }, [sowId, cicloConfig]);

  const isDoseExpired     = expiryDate && new Date(expiryDate) < new Date();
  const selectedSow       = sows.find(s => s.id === sowId);
  const hasBlockers       = eligibility !== null && !eligibility.eligible;
  const isFormDisabled    = submitting || hasBlockers;

  // Lógica real de envío al servidor
  async function doSave(data: ServiceEventInput) {
    setSubmitting(true);
    setServerError(null);
    setDoseExpiredAlert(false);
    setHeatRepeatMsg(null);

    const res = await fetch("/api/service-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      const msg = typeof err.error === "string"
        ? err.error
        : (err.error?.formErrors?.[0] ?? "Error al guardar");
      setServerError(msg);
      setSubmitting(false);
      return;
    }

    const json = await res.json();
    if (json.doseExpiredAlert) setDoseExpiredAlert(true);

    if (json.heatRepeatAlert && json.previousServiceDate) {
      const fecha = new Date(json.previousServiceDate).toLocaleDateString("es-PY", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      setHeatRepeatMsg(`Repetición de celo registrada. Esta hembra fue servida el ${fecha}.`);
    }

    setSuccessMsg(`Servicio registrado para la cerda ${selectedSow?.identCode ?? ""}`);
    setSubmitting(false);
    setTimeout(() => router.push("/gestacion"), 2200);
  }

  // Interceptor del form: si hay servicio previo, mostrar modal primero
  function onSubmit(data: ServiceEventInput) {
    if (previousService) {
      setPendingData(data);
      setShowRepeatModal(true);
      return;
    }
    doSave(data);
  }

  function handleModalConfirm() {
    setShowRepeatModal(false);
    if (pendingData) {
      doSave(pendingData);
      setPendingData(null);
    }
  }

  function handleModalCancel() {
    setShowRepeatModal(false);
    setPendingData(null);
  }

  return (
    <>
      {/* Modal de repetición de celo */}
      {showRepeatModal && previousService && (
        <RepeatCeloModal
          sow={selectedSow}
          previousService={previousService}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 0 }}>

        {/* ── Alertas globales ─────────────────────────────────── */}
        {successMsg && (
          <div className="kp-alert kp-alert-success" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <IconCircleCheck size={15} />
            {successMsg}
          </div>
        )}
        {heatRepeatMsg && (
          <div className="kp-alert kp-alert-warning" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <IconRefresh size={15} />
            {heatRepeatMsg}
          </div>
        )}
        {doseExpiredAlert && (
          <div className="kp-alert kp-alert-warning" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={15} />
            La dosis de semen estaba vencida al registrar el servicio. Verificar con el veterinario.
          </div>
        )}
        {serverError && (
          <div className="kp-alert kp-alert-danger" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={15} />
            {serverError}
          </div>
        )}

        {/* ── Cerda ───────────────────────────────────────────── */}
        <Section title="Cerda">
          <div style={{ position: "relative", marginBottom: 10 }}>
            <IconSearch
              size={14}
              style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)", pointerEvents: "none",
              }}
            />
            <input
              className="kp-input"
              placeholder="Buscar por código de tatuaje..."
              value={sowSearch}
              onChange={e => setSowSearch(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>

          {sows.length > 0 && (
            <div
              style={{
                maxHeight: 200, overflowY: "auto",
                border: "0.5px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
              }}
            >
              {sows.map((sow, i) => (
                <button
                  key={sow.id}
                  type="button"
                  onClick={() => {
                    setValue("sowId", sow.id);
                    setSowSearch(sow.identCode);
                    setSows([sow]);
                  }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 14px",
                    background: sowId === sow.id ? "var(--success-subtle)" : "transparent",
                    border: "none",
                    borderTop: i > 0 ? "0.5px solid var(--border-default)" : "none",
                    cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (sowId !== sow.id) (e.currentTarget as HTMLElement).style.background = "var(--bg-overlay)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sowId === sow.id ? "var(--success-subtle)" : "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{sow.identCode}</span>
                    {sow.breed && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sow.breed}</span>}
                  </div>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4,
                      background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
                      color: "var(--text-secondary)", whiteSpace: "nowrap",
                    }}
                  >
                    Parto #{sow.currentParityCount + 1}
                  </span>
                </button>
              ))}
            </div>
          )}

          {sowId && selectedSow && (
            <div
              style={{
                marginTop: 8, padding: "8px 12px",
                background: "var(--success-subtle)",
                border: "0.5px solid var(--success-border)",
                borderRadius: "var(--radius-md)",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 500 }}>
                Seleccionada: {selectedSow.identCode}
              </span>
              {selectedSow.breed && (
                <span style={{ fontSize: 11, color: "var(--success-text)", opacity: 0.8 }}>
                  · {selectedSow.breed}
                </span>
              )}
              {checkingPrevious && (
                <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)", marginLeft: "auto" }} />
              )}
            </div>
          )}

          {/* Cargando elegibilidad */}
          {sowId && checkingEligibility && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Verificando requisitos...</span>
            </div>
          )}

          {/* Bloqueantes de elegibilidad */}
          {sowId && !checkingEligibility && eligibility && !eligibility.eligible && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {eligibility.blockers.map(blocker => (
                <div
                  key={blocker.tipo}
                  className="kp-alert kp-alert-danger"
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}
                >
                  <IconLock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{blocker.mensaje}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mismo ciclo: mostrar contador verde */}
          {sowId && numeroCiclo !== null && !checkingPrevious && (
            <div
              className="kp-alert kp-alert-success"
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
            >
              <IconCircleCheck size={15} style={{ flexShrink: 0 }} />
              <span>
                Inseminación <strong>N° {numeroCiclo}</strong> de {cicloConfig.inseminaciones} en este ciclo.
                No se generará alerta de repetición de celo.
              </span>
            </div>
          )}

          {/* Repetición de celo: aviso naranja antes de guardar */}
          {sowId && previousService && !checkingPrevious && numeroCiclo === null && (
            <div
              className="kp-alert kp-alert-warning"
              style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}
            >
              <IconRefresh size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Esta cerda fue servida el{" "}
                <strong>
                  {new Date(previousService.serviceDate).toLocaleDateString("es-PY", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </strong>{" "}
                (Lote {previousService.serviceBatch.weekLabel}). Al guardar se pedirá confirmación de repetición de celo.
              </span>
            </div>
          )}

          {errors.sowId && (
            <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{errors.sowId.message}</p>
          )}
        </Section>

        {/* ── Datos del servicio ───────────────────────────────── */}
        <Section title="Datos del servicio">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="kp-label">Fecha del servicio *</label>
              <input className="kp-input" type="date" {...register("serviceDate")} />
              {errors.serviceDate && (
                <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.serviceDate.message}</p>
              )}
            </div>
            <div>
              <label className="kp-label">Tipo de servicio *</label>
              <select className="kp-input" {...register("serviceType")}>
                <option value="AI">IA — Inseminación artificial</option>
                <option value="NATURAL_MOUNT">Monta natural</option>
              </select>
            </div>
          </div>
          <div style={{ maxWidth: 200 }}>
            <label className="kp-label">Duración (minutos)</label>
            <input className="kp-input" type="number" min={0} placeholder="Ej: 4" {...register("durationMinutes")} />
          </div>
        </Section>

        {/* ── Dosis / Reproductor ──────────────────────────────── */}
        <Section title={serviceType === "AI" ? "Dosis de semen" : "Reproductor"}>
          {serviceType === "NATURAL_MOUNT" ? (
            <div>
              <label className="kp-label">Código del reproductor *</label>
              <input className="kp-input" placeholder="Ej: R-204" style={{ maxWidth: 240 }} {...register("boarCode")} />
              {errors.boarCode && (
                <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.boarCode.message}</p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="kp-label">Código de la dosis *</label>
                <input className="kp-input" placeholder="Ej: DOSE-2026-001" style={{ maxWidth: 280 }} {...register("doseCode")} />
                {errors.doseCode && (
                  <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.doseCode.message}</p>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Fecha de elaboración *</label>
                  <input className="kp-input" type="date" {...register("elaborationDate")} />
                  {errors.elaborationDate && (
                    <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.elaborationDate.message}</p>
                  )}
                </div>
                <div>
                  <label className="kp-label">Fecha de caducidad *</label>
                  <input
                    className="kp-input" type="date"
                    style={isDoseExpired ? { borderColor: "var(--danger)" } : {}}
                    {...register("expiryDate")}
                  />
                  {isDoseExpired && (
                    <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <IconAlertTriangle size={12} /> Esta dosis está VENCIDA
                    </p>
                  )}
                  {errors.expiryDate && !isDoseExpired && (
                    <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.expiryDate.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Observaciones ────────────────────────────────────── */}
        <Section title="Observaciones">
          <textarea
            {...register("notes")}
            placeholder="Observaciones opcionales..."
            className="kp-input"
            style={{ height: 72, resize: "vertical" }}
          />
        </Section>

        {/* ── Acciones ─────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="btn"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isFormDisabled || !sowId}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {submitting ? (
              <>
                <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                Guardando...
              </>
            ) : hasBlockers ? (
              <>
                <IconLock size={13} />
                Cerda no habilitada
              </>
            ) : (
              "Registrar servicio"
            )}
          </button>
        </div>
      </form>
    </>
  );
}
