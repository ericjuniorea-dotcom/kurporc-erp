"use client";

const SOW_STATE_LABELS: Record<string, { label: string; cls: string }> = {
  QUARANTINE:            { label: "Cuarentena",              cls: "badge badge-warn" },
  REPLACEMENT_DEVELOPING:{ label: "Reemplazo en desarrollo", cls: "badge badge-info" },
  REPLACEMENT_READY:     { label: "Lista para servicio",     cls: "badge badge-ok" },
  MATED:                 { label: "Servida",                 cls: "badge badge-ges" },
  PREGNANT:              { label: "Gestante",                cls: "badge badge-ges" },
  FARROWING:             { label: "En paridera",             cls: "badge badge-mat" },
  LACTATING:             { label: "Lactante",                cls: "badge badge-mat" },
  EMPTY:                 { label: "Vacía",                   cls: "badge badge-info" },
  CULLED:                { label: "Descartada",              cls: "badge badge-danger" },
  DEAD:                  { label: "Muerta",                  cls: "badge" },
};

const BOAR_STATE_LABELS: Record<string, { label: string; cls: string }> = {
  QUARANTINE: { label: "Cuarentena", cls: "badge badge-warn" },
  ACTIVE:     { label: "Activo",     cls: "badge badge-ok" },
  RESTING:    { label: "Descanso",   cls: "badge badge-info" },
  CULLED:     { label: "Descartado", cls: "badge badge-danger" },
  DEAD:       { label: "Muerto",     cls: "badge" },
};

export function EstadoBadgeSow({ state }: { state: string | null }) {
  const s = state ? (SOW_STATE_LABELS[state] ?? { label: state, cls: "badge" }) : { label: "—", cls: "badge" };
  return <span className={s.cls}>{s.label}</span>;
}

export function EstadoBadgeBoar({ state }: { state: string | null }) {
  const s = state ? (BOAR_STATE_LABELS[state] ?? { label: state, cls: "badge" }) : { label: "—", cls: "badge" };
  return <span className={s.cls}>{s.label}</span>;
}
