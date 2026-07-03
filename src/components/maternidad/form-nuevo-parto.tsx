"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { farrowingEventSchema, type FarrowingEventInput } from "@/lib/validations/maternidad";
import {
  IconAlertTriangle, IconCircleCheck, IconLoader2, IconSearch,
} from "@tabler/icons-react";

interface Sow { id: string; identCode: string; currentParityCount: number }
interface ServiceEvent {
  id: string; serviceDate: string; serviceType: string;
  serviceBatch: { weekLabel: string };
}

export function FormNuevoParto() {
  const router = useRouter();
  const [sows, setSows]               = useState<Sow[]>([]);
  const [sowSearch, setSowSearch]     = useState("");
  const [sowServices, setSowServices] = useState<ServiceEvent[]>([]);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<FarrowingEventInput>({
      resolver: zodResolver(farrowingEventSchema),
      defaultValues: {
        farrowingType:      "NORMAL",
        bornDead:           0,
        mummified:          0,
        lowViabilityCount:  0,
        startDatetime:      new Date().toISOString().slice(0, 16),
      },
    });

  const [sowId, bornAlive, bornDead, mummified, totalLitterWeightKg, startDatetime, endDatetime] = [
    watch("sowId"), watch("bornAlive"), watch("bornDead"),
    watch("mummified"), watch("totalLitterWeightKg"),
    watch("startDatetime"), watch("endDatetime"),
  ];

  const totalBorn    = (Number(bornAlive) || 0) + (Number(bornDead) || 0) + (Number(mummified) || 0);
  const avgWeight    = bornAlive > 0 && totalLitterWeightKg > 0
    ? (Number(totalLitterWeightKg) / Number(bornAlive)).toFixed(2)
    : null;
  const avgWeightNum = avgWeight ? parseFloat(avgWeight) : null;
  const durationMin  = startDatetime && endDatetime
    ? Math.round((new Date(endDatetime).getTime() - new Date(startDatetime).getTime()) / 60000)
    : null;

  const liveAlerts: string[] = [];
  if (avgWeightNum && avgWeightNum < 1.10) liveAlerts.push(`Peso medio bajo: ${avgWeight} kg (mínimo 1,10 kg)`);
  if (durationMin && durationMin > 240)    liveAlerts.push(`Parto largo: ${Math.floor(durationMin/60)}h ${durationMin%60}min (supera 4 horas — posible distocia)`);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/sows?q=${encodeURIComponent(sowSearch)}&active=true`)
        .then((r) => r.json()).then(setSows);
    }, 300);
    return () => clearTimeout(t);
  }, [sowSearch]);

  useEffect(() => {
    if (!sowId) { setSowServices([]); return; }
    fetch(`/api/service-events?sowId=${sowId}`)
      .then((r) => r.json())
      .then((data: any[]) => setSowServices(data.filter((e) => !e.farrowing)));
  }, [sowId]);

  async function onSubmit(data: FarrowingEventInput) {
    setServerError(null);
    const res = await fetch("/api/farrowing-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setServerError(
        err.error?.formErrors?.[0] ??
        JSON.stringify(err.error?.fieldErrors ?? err.error) ??
        "Error al guardar"
      );
      return;
    }
    setSuccessMsg("Parto registrado. Tareas sanitarias y fecha de destete generadas automáticamente.");
    setTimeout(() => router.push("/maternidad"), 2000);
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background:   "var(--bg-surface)",
      border:       "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      overflow:     "hidden",
    }}>
      <div style={{
        padding:      "10px 14px",
        borderBottom: "0.5px solid var(--border-default)",
        background:   "var(--bg-elevated)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{title}</span>
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {successMsg && (
        <div className="kp-alert kp-alert-ok">
          <IconCircleCheck size={13} aria-hidden /> {successMsg}
        </div>
      )}
      {serverError && (
        <div className="kp-alert kp-alert-danger">
          <IconAlertTriangle size={13} aria-hidden /> {serverError}
        </div>
      )}
      {liveAlerts.map((a, i) => (
        <div key={i} className="kp-alert kp-alert-warn">
          <IconAlertTriangle size={13} aria-hidden /> {a}
        </div>
      ))}

      {/* Cerda */}
      <Section title="Cerda">
        <div style={{ position: "relative", marginBottom: 10 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} aria-hidden />
          <input
            className="kp-input"
            style={{ paddingLeft: 30 }}
            placeholder="Buscar por código..."
            value={sowSearch}
            onChange={(e) => setSowSearch(e.target.value)}
          />
        </div>
        {sows.length > 0 && (
          <div style={{
            maxHeight: 160, overflowY: "auto",
            border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            marginBottom: 10,
          }}>
            {sows.map((sow) => (
              <button
                key={sow.id}
                type="button"
                onClick={() => { setValue("sowId", sow.id); setSowSearch(sow.identCode); setSows([sow]); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: sowId === sow.id ? "var(--accent-subtle)" : "transparent",
                  border: "none",
                  borderBottom: "0.5px solid var(--border-default)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { if (sowId !== sow.id) e.currentTarget.style.background = "var(--bg-overlay)"; }}
                onMouseLeave={(e) => { if (sowId !== sow.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: sowId === sow.id ? "var(--accent-text)" : "var(--text-primary)" }}>
                  {sow.identCode}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Parto #{sow.currentParityCount + 1}</span>
              </button>
            ))}
          </div>
        )}
        {errors.sowId && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 4 }}>{errors.sowId.message}</p>}

        {sowServices.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <label className="kp-label">Vincular con servicio (opcional)</label>
            <select
              className="kp-input"
              style={{ appearance: "auto" }}
              defaultValue=""
              onChange={(e) => setValue("serviceEventId", e.target.value || undefined)}
            >
              <option value="">Sin vincular</option>
              {sowServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serviceBatch.weekLabel} · {s.serviceType} · {new Date(s.serviceDate).toLocaleDateString("es-PY")}
                </option>
              ))}
            </select>
          </div>
        )}
      </Section>

      {/* Datos del parto */}
      <Section title="Datos del parto">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="kp-label">Inicio (1er lechón) *</label>
            <input type="datetime-local" className="kp-input" {...register("startDatetime")} />
            {errors.startDatetime && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.startDatetime.message}</p>}
          </div>
          <div>
            <label className="kp-label">Fin (último lechón)</label>
            <input type="datetime-local" className="kp-input" {...register("endDatetime")} />
            {durationMin != null && durationMin > 0 && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Duración: {Math.floor(durationMin/60)}h {durationMin%60}min
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="kp-label">Tipo de parto *</label>
          <select
            className="kp-input"
            style={{ appearance: "auto" }}
            defaultValue="NORMAL"
            onChange={(e) => setValue("farrowingType", e.target.value as FarrowingEventInput["farrowingType"])}
          >
            <option value="NORMAL">Normal</option>
            <option value="ASSISTED">Asistido</option>
            <option value="CESAREAN">Cesárea</option>
            <option value="DYSTOCIA">Distocia</option>
          </select>
        </div>
      </Section>

      {/* Lechones */}
      <Section title="Lechones nacidos">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="kp-label">Nacidos vivos *</label>
            <input type="number" min={0} className="kp-input" {...register("bornAlive")} />
            {errors.bornAlive && <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.bornAlive.message}</p>}
          </div>
          <div>
            <label className="kp-label">Nacidos muertos</label>
            <input type="number" min={0} className="kp-input" {...register("bornDead")} />
          </div>
          <div>
            <label className="kp-label">Momificados</label>
            <input type="number" min={0} className="kp-input" {...register("mummified")} />
          </div>
        </div>

        {totalBorn > 0 && (
          <div style={{
            background:   "var(--bg-overlay)",
            borderRadius: "var(--radius-md)",
            padding:      "8px 12px",
            fontSize:     12,
            color:        "var(--text-secondary)",
            display:      "flex",
            gap:          16,
            marginBottom: 10,
          }}>
            <span>Total nacidos: <strong style={{ color: "var(--text-primary)" }}>{totalBorn}</strong></span>
            {(Number(bornDead)||0) + (Number(mummified)||0) > 0 && (
              <span style={{ color: "var(--danger-text)" }}>
                % pérdidas: {(((Number(bornDead)||0) + (Number(mummified)||0)) / totalBorn * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="kp-label">Hembras vivas</label>
            <input type="number" min={0} className="kp-input" {...register("femalesBornAlive")} />
          </div>
          <div>
            <label className="kp-label">Machos vivos</label>
            <input type="number" min={0} className="kp-input" {...register("malesBornAlive")} />
          </div>
          <div>
            <label className="kp-label">Baja viabilidad</label>
            <input type="number" min={0} className="kp-input" {...register("lowViabilityCount")} />
          </div>
        </div>

        <div>
          <label className="kp-label">Peso TOTAL de la camada (kg) *</label>
          <input
            type="number" step="0.1" min={0} className="kp-input"
            placeholder="Pesá todos los lechones juntos en la balanza"
            {...register("totalLitterWeightKg")}
          />
          {avgWeight && (
            <p style={{ fontSize: 11, marginTop: 4, fontWeight: 500, color: avgWeightNum! < 1.10 ? "var(--danger-text)" : "var(--success-text)" }}>
              Peso medio calculado: {avgWeight} kg/lechón
              {avgWeightNum! < 1.10 && " — por debajo del mínimo (1,10 kg)"}
            </p>
          )}
          {errors.totalLitterWeightKg && (
            <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>{errors.totalLitterWeightKg.message}</p>
          )}
        </div>
      </Section>

      {/* Observaciones */}
      <div>
        <label className="kp-label">Observaciones</label>
        <textarea
          {...register("notes")}
          rows={3}
          style={{
            width:        "100%",
            padding:      "8px 10px",
            borderRadius: "var(--radius-md)",
            border:       "0.5px solid var(--border-strong)",
            background:   "var(--bg-surface)",
            color:        "var(--text-primary)",
            fontSize:     13,
            resize:       "vertical",
            fontFamily:   "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" onClick={() => router.back()} disabled={isSubmitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !sowId} style={{ minWidth: 140 }}>
          {isSubmitting
            ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
            : "Registrar parto"}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </form>
  );
}
