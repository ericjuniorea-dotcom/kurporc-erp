"use client";
import { useState, useEffect } from "react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { serviceEventSchema, type ServiceEventInput } from "@/lib/validations/gestacion";
import { IconAlertTriangle, IconCircleCheck, IconLoader2, IconRefresh, IconLock, IconShieldCheck } from "@tabler/icons-react";

// Super Admin (1), Admin de granja (2), Veterinario Jefe (4) — únicos roles
// que pueden forzar una inseminación pese a bloqueos de elegibilidad.
const FORCE_OVERRIDE_ROLES = [1, 2, 4];

export interface SowLite {
  id: string;
  identCode: string;
  breed?: string | null;
  currentParityCount: number;
  entryWeightKg?: string | number | null;
  currentWeightKg?: string | number | null;
}

interface PreviousService {
  id: string;
  serviceDate: string;
  serviceBatch: { weekLabel: string };
}

interface EligibilityBlocker {
  tipo: "QUARANTINE" | "DIAS_INSUFICIENTES" | "VACUNAS_FALTANTES";
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
  sow: SowLite | undefined;
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
        position: "fixed", inset: 0, zIndex: 400,
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

/* ─── Campos de servicio (sin buscador — cerda fija por prop) ───── */

export function ServicioFields({
  sow,
  serviceBatchId,
  defaultServiceDate,
  onDone,
  onCancel,
}: {
  sow: SowLite;
  serviceBatchId?: string;
  defaultServiceDate?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: session } = useSession();
  const { alguno } = usePermisos();
  const canForce = alguno(["sanidad.carencias.liberar"]);
  const [forceOverride, setForceOverride]       = useState(false);

  const [doseExpiredAlert, setDoseExpiredAlert] = useState(false);
  const [successMsg, setSuccessMsg]             = useState<string | null>(null);
  const [serverError, setServerError]           = useState<string | null>(null);
  const [heatRepeatMsg, setHeatRepeatMsg]       = useState<string | null>(null);
  const [warnings, setWarnings]                 = useState<string[]>([]);

  const [previousService, setPreviousService]   = useState<PreviousService | null>(null);
  const [checkingPrevious, setCheckingPrevious] = useState(false);
  // Config del ciclo: leída una vez al montar
  const [cicloConfig, setCicloConfig]           = useState({ inseminaciones: 3, intervaloHoras: 12 });
  // Peso mínimo configurado para servicio — aviso en vivo, no bloqueo del form
  const [pesoMinimo, setPesoMinimo]             = useState<number | null>(null);
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
      sowId:       sow.id,
      serviceDate: defaultServiceDate ?? new Date().toISOString().substring(0, 10),
      serviceType: "AI",
      currentWeightKg: (sow.currentWeightKg ?? sow.entryWeightKg) != null
        ? Number(sow.currentWeightKg ?? sow.entryWeightKg)
        : undefined,
    },
  });

  const serviceType     = watch("serviceType");
  const currentWeightKg = watch("currentWeightKg");
  const expiryDate  = watch("expiryDate");

  useEffect(() => { setValue("sowId", sow.id); }, [sow.id, setValue]);

  // Cargar config del protocolo de inseminación + requisitos de servicio (peso mínimo)
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
        const req = procesos.find(x => x.procesoKey === "requisitos_servicio");
        const minimo = Number(req?.valor?.peso_minimo_kg ?? 0);
        if (minimo > 0) setPesoMinimo(minimo);
      })
      .catch(() => {});
  }, []);

  // Verificar elegibilidad + servicio reciente de la cerda fijada
  useEffect(() => {
    setCheckingPrevious(true);
    setCheckingEligibility(true);

    // Elegibilidad (cuarentena, peso, días, vacunas)
    fetch(`/api/gestacion/sow-eligibility?sowId=${sow.id}`)
      .then(r => r.json())
      .then((data: EligibilityResult) => setEligibility(data))
      .catch(() => setEligibility(null))
      .finally(() => setCheckingEligibility(false));

    // Verificar ciclo / repetición de celo
    fetch(`/api/service-events?sowId=${sow.id}`)
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
  }, [sow.id, cicloConfig]);

  const isDoseExpired     = expiryDate && new Date(expiryDate) < new Date();
  const hasBlockers       = eligibility !== null && !eligibility.eligible;
  const isFormDisabled    = submitting || (hasBlockers && !(canForce && forceOverride));

  // Lógica real de envío al servidor
  async function doSave(data: ServiceEventInput) {
    setSubmitting(true);
    setServerError(null);
    setDoseExpiredAlert(false);
    setHeatRepeatMsg(null);
    setWarnings([]);

    const res = await fetch("/api/service-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, force: canForce && forceOverride, serviceBatchId }),
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
    if (Array.isArray(json.warnings) && json.warnings.length > 0) setWarnings(json.warnings);

    if (json.heatRepeatAlert && json.previousServiceDate) {
      const fecha = new Date(json.previousServiceDate).toLocaleDateString("es-PY", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      setHeatRepeatMsg(`Repetición de celo registrada. Esta hembra fue servida el ${fecha}.`);
    }

    setSuccessMsg(`Servicio registrado para la cerda ${sow.identCode}`);
    setSubmitting(false);
    setTimeout(onDone, 1400);
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
          sow={sow}
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
        {warnings.length > 0 && (
          <div className="kp-alert kp-alert-warning" style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <IconShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Registrado con inseminación forzada — bloqueos ignorados: {warnings.join(" ")}</span>
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

        {/* ── Cerda (fija) ─────────────────────────────────────── */}
        <Section title="Cerda">
          <div
            style={{
              padding: "8px 12px",
              background: "var(--success-subtle)",
              border: "0.5px solid var(--success-border)",
              borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 500 }}>
              {sow.identCode}
            </span>
            {sow.breed && (
              <span style={{ fontSize: 11, color: "var(--success-text)", opacity: 0.8 }}>
                · {sow.breed}
              </span>
            )}
            {checkingPrevious && (
              <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)", marginLeft: "auto" }} />
            )}
          </div>

          {/* Peso actual — se pide siempre fresco acá, no se usa el peso de ingreso */}
          <div style={{ marginTop: 10 }}>
            <label className="kp-label" htmlFor="currentWeightKg">Peso actual (kg) *</label>
            <input
              id="currentWeightKg"
              type="number"
              step="0.1"
              className="kp-input"
              style={{ maxWidth: 160 }}
              placeholder="Ej: 145.0"
              {...register("currentWeightKg")}
            />
            {errors.currentWeightKg && (
              <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.currentWeightKg.message}</p>
            )}
            {!errors.currentWeightKg && pesoMinimo !== null && Number(currentWeightKg) > 0 && Number(currentWeightKg) < pesoMinimo && (
              <p style={{ fontSize: 11, color: "var(--warning-text)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <IconAlertTriangle size={12} />
                Por debajo del mínimo configurado ({pesoMinimo} kg) — vas a poder continuar solo si tenés permiso para forzar.
              </p>
            )}
          </div>

          {/* Cargando elegibilidad */}
          {checkingEligibility && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Verificando requisitos...</span>
            </div>
          )}

          {/* Bloqueantes de elegibilidad */}
          {!checkingEligibility && eligibility && !eligibility.eligible && (
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

              {canForce && (
                <label
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12,
                    padding: "8px 10px", borderRadius: "var(--radius-md)", cursor: "pointer",
                    background: forceOverride ? "var(--warning-subtle)" : "var(--bg-overlay)",
                    border: `0.5px solid ${forceOverride ? "var(--warning)" : "var(--border-default)"}`,
                    color: forceOverride ? "var(--warning-text)" : "var(--text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={forceOverride}
                    onChange={e => setForceOverride(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0, cursor: "pointer" }}
                  />
                  <span>
                    <strong>Forzar inseminación</strong> — ignora los bloqueos anteriores. Reservado a Admin/Veterinario y queda registrado en el historial de la cerda.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Mismo ciclo: mostrar contador verde */}
          {numeroCiclo !== null && !checkingPrevious && (
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
          {previousService && !checkingPrevious && numeroCiclo === null && (
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
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isFormDisabled}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              ...(hasBlockers && canForce && forceOverride
                ? { background: "var(--warning)", borderColor: "var(--warning)", color: "white" }
                : {}),
            }}
          >
            {submitting ? (
              <>
                <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                Guardando...
              </>
            ) : hasBlockers && canForce && forceOverride ? (
              <>
                <IconShieldCheck size={13} />
                Forzar registro de servicio
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
