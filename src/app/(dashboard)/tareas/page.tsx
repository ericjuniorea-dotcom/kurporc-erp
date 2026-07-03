"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession }       from "next-auth/react";
import { useRouter }        from "next/navigation";
import { IconClipboardCheck, IconCheck, IconLoader2, IconRefresh, IconPlus, IconX, IconUserSearch } from "@tabler/icons-react";
import { Topbar }           from "@/components/layout/topbar";

interface Task {
  id:                string;
  tipo:              string;
  sector:            string;
  titulo:            string;
  descripcion:       string;
  instrucciones:     string | null;
  prioridad:         string;
  fechaVencimiento:  string;
  fechaCompletada:   string | null;
  targetLabel:       string | null;
  generadaPor:       string;
  responsableNombre: string | null;
  responsableKey:    string | null;
}

interface Kpis {
  urgente: number;
  hoy: number;
  programada: number;
  completada: number;
  sinResp: number;
  manana: number;
}

const SECTOR_OPTS = [
  { key: "",           label: "Todos los módulos" },
  { key: "gestacion",  label: "Gestación"         },
  { key: "maternidad", label: "Maternidad"        },
  { key: "iniciacion", label: "Iniciación"        },
  { key: "engorde",    label: "Engorde"           },
  { key: "granja",     label: "General"           },
];

const PERIODO_OPTS = [
  { key: "hoy",    label: "Hoy"    },
  { key: "semana", label: "Semana" },
  { key: "mes",    label: "Mes"    },
];

const RESPONSABLE_OPTS = [
  { key: "",                label: "Todos"            },
  { key: "erwin-segovia",   label: "Dr. Erwin Segovia"             },
  { key: "bartolome-vera",  label: "Bartolomé Vera"                },
  { key: "graciela-duarte", label: "Graciela Duarte"               },
  { key: "alex-almada",     label: "Dr. Alex Almada"               },
  { key: "eric-acosta",     label: "Ing. Eric Acosta"              },
];

const AVATAR_MAP: Record<string, { iniciales: string; bg: string; bdr: string }> = {
  "erwin-segovia":   { iniciales: "ES", bg: "#A31621", bdr: "#7A0F18" },
  "bartolome-vera":  { iniciales: "BV", bg: "#E07C2E", bdr: "#B05E1A" },
  "graciela-duarte": { iniciales: "GD", bg: "#D4537E", bdr: "#A83060" },
  "alex-almada":     { iniciales: "AA", bg: "#1D9E75", bdr: "#16735A" },
  "eric-acosta":     { iniciales: "EA", bg: "#378ADD", bdr: "#2563B0" },
};

const TIPO_EMOJI: Record<string, string> = {
  "destete":              "🐷",
  "parto-esperado":       "🤱",
  "diagnostico-prenez":   "🔍",
  "vacuna-gestacion":     "💉",
  "vacuna-lechones":      "💉",
  "vacuna-ecoli":         "💉",
  "vacuna-circovirus":    "💉",
  "vacuna-mycoplasma":    "💉",
  "vacuna-influenza":     "💉",
  "hierro-fe":            "💉",
  "descolmillado":        "✂️",
  "castracion":           "✂️",
  "corte-cola":           "✂️",
  "pesaje":               "⚖️",
  "cambio-fase":          "📦",
  "tratamiento-curativo": "🏥",
  "limpieza-bebederos":   "🧹",
  "desinfeccion-corral":  "🧹",
  "limpieza-semanal":     "🧹",
  "control-temperatura":  "🌡️",
  "alimentacion":         "🌾",
  "repeticion-celo":      "🔄",
};

const SECTOR_COLOR: Record<string, string> = {
  gestacion:  "var(--success)",
  maternidad: "var(--accent)",
  iniciacion: "var(--info)",
  engorde:    "var(--warning)",
  granja:     "var(--text-muted)",
};

const SECTOR_LABEL: Record<string, string> = {
  gestacion:  "Gestación",
  maternidad: "Maternidad",
  iniciacion: "Iniciación",
  engorde:    "Engorde",
  granja:     "General",
};

const P_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  urgente:    { bg: "var(--accent-subtle)",  border: "var(--accent-border)",  text: "var(--accent-text)"    },
  hoy:        { bg: "var(--warning-subtle)", border: "var(--warning-border)", text: "var(--warning-text)"   },
  programada: { bg: "var(--bg-overlay)",     border: "var(--border-default)", text: "var(--text-secondary)" },
  completada: { bg: "transparent",           border: "var(--border-default)", text: "var(--text-muted)"     },
};

const ALLOWED = [1, 2, 3, 4, 5, 6, 10, 11, 12, 13];

function ResponsableAvatar({ key: rKey, nombre }: { key: string | null; nombre: string | null }) {
  if (!rKey && !nombre) return (
    <div title="Sin asignar" style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: "var(--bg-overlay)", border: "1.5px dashed var(--border-default)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, color: "var(--text-muted)",
    }}>?</div>
  );
  const av = rKey ? AVATAR_MAP[rKey] : null;
  return (
    <div title={nombre ?? undefined} style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: av?.bg ?? "#64748B", border: `1.5px solid ${av?.bdr ?? "#475569"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "#fff",
    }}>
      {av?.iniciales ?? (nombre?.slice(0, 2).toUpperCase() ?? "?")}
    </div>
  );
}

function GroupHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 4px" }}>
      <div style={{ width: 3, height: 14, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({count})</span>
    </div>
  );
}

function TaskCard({
  task, completing, onToggle, onReasignar, canAdmin,
}: {
  task:         Task;
  completing:   string | null;
  onToggle:     (t: Task) => void;
  onReasignar:  (t: Task) => void;
  canAdmin:     boolean;
}) {
  const done    = !!task.fechaCompletada;
  const busy    = completing === task.id;
  const ps      = P_STYLE[task.prioridad as keyof typeof P_STYLE] ?? P_STYLE.programada;
  const emoji   = TIPO_EMOJI[task.tipo] ?? "📋";
  const sColor  = SECTOR_COLOR[task.sector] ?? "var(--text-muted)";

  const due   = new Date(task.fechaVencimiento);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due.getTime() - today.getTime()) / 86400000);
  const dueLabel = diff < 0  ? `Venció hace ${-diff}d`
    : diff === 0 ? "Hoy"
    : diff === 1 ? "Mañana"
    : `${due.toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: "var(--radius-lg)",
      background: done ? "transparent" : ps.bg,
      border: `0.5px solid ${ps.border}`,
      opacity: done ? 0.6 : 1,
    }}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task)}
        disabled={busy}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${done ? "var(--success)" : ps.text}`,
          background: done ? "var(--success)" : "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {busy
          ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite", color: done ? "#fff" : ps.text }} />
          : done ? <IconCheck size={12} color="white" /> : null
        }
      </button>

      {/* Emoji */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: done ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: done ? "line-through" : "none",
        }}>
          {task.titulo}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {task.targetLabel && <span>{task.targetLabel}</span>}
          <span style={{ color: sColor, fontWeight: 600 }}>
            {SECTOR_LABEL[task.sector] ?? task.sector}
          </span>
          {task.descripcion && (
            <span style={{ opacity: 0.8 }}>{task.descripcion}</span>
          )}
        </div>
      </div>

      {/* Responsable */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <ResponsableAvatar key={task.responsableKey} nombre={task.responsableNombre} />
        {canAdmin && !done && (
          <button
            onClick={() => onReasignar(task)}
            title="Reasignar responsable"
            style={{
              width: 22, height: 22, borderRadius: 6,
              border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)",
            }}
          >
            <IconUserSearch size={12} />
          </button>
        )}
      </div>

      {/* Due badge */}
      <span style={{
        fontSize: 10, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0,
        background: "var(--bg-surface)", border: `0.5px solid ${ps.border}`,
        color: ps.text, fontWeight: 500,
      }}>
        {dueLabel}
      </span>
    </div>
  );
}

function ReasignarModal({
  task,
  onClose,
  onDone,
}: {
  task:    Task;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [sel,    setSel]    = useState(task.responsableKey ?? "");

  async function submit() {
    const opt = RESPONSABLE_OPTS.find(o => o.key === sel);
    if (!opt || !sel) return;
    setSaving(true);
    await fetch(`/api/tareas/${task.id}/reasignar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsableNombre: opt.label, responsableKey: sel }),
    });
    setSaving(false);
    onDone();
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
    }}>
      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: "20px 24px", width: 340, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Reasignar responsable</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{task.titulo}</div>
        <select value={sel} onChange={e => setSel(e.target.value)} className="kp-input" style={{ fontSize: 12 }}>
          {RESPONSABLE_OPTS.filter(o => o.key).map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose} style={{ fontSize: 11 }}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !sel} style={{ fontSize: 11 }}>
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TareasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [periodo,    setPeriodo]    = useState("semana");
  const [sector,     setSector]     = useState("");
  const [responsable, setResponsable] = useState("");
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [kpis,       setKpis]       = useState<Kpis>({ urgente: 0, hoy: 0, programada: 0, completada: 0, sinResp: 0, manana: 0 });
  const [loading,    setLoading]    = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [tab,        setTab]        = useState("pendiente");
  const [showNew,    setShowNew]    = useState(false);
  const [newTitulo,  setNewTitulo]  = useState("");
  const [newSector,  setNewSector]  = useState("granja");
  const [newDate,    setNewDate]    = useState(() => new Date().toISOString().slice(0, 10));
  const [saving,     setSaving]     = useState(false);
  const [reasignTask, setReasignTask] = useState<Task | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s  = sp.get("sector") ?? "";
    setSector(s);
    if (s) setNewSector(s);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ periodo });
    if (sector)      p.set("sector",      sector);
    if (responsable) p.set("responsable", responsable);
    fetch(`/api/tareas?${p}`)
      .then(r => r.ok ? r.json() : { tasks: [], kpis: {} })
      .then(d => {
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
        if (d.kpis) setKpis(d.kpis);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo, sector, responsable]);

  useEffect(() => { if (status === "authenticated") load(); }, [load, status]);

  async function toggleComplete(task: Task) {
    setCompleting(task.id);
    const method = task.fechaCompletada ? "DELETE" : "POST";
    await fetch(`/api/tareas/${task.id}/completar`, {
      method, headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({}) : undefined,
    }).catch(() => {});
    setCompleting(null);
    load();
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitulo.trim()) return;
    setSaving(true);
    await fetch("/api/tareas/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector: newSector, titulo: newTitulo, fechaVencimiento: newDate, tipo: "tratamiento-curativo" }),
    }).catch(() => {});
    setSaving(false);
    setNewTitulo("");
    setShowNew(false);
    load();
  }

  if (status === "loading" || !session) return null;

  const canAdmin = session.user.roles.some(r => [1, 2, 5].includes(r));

  const pending    = tasks.filter(t => !t.fechaCompletada);
  const done       = tasks.filter(t =>  t.fechaCompletada);
  const urgentes   = pending.filter(t => t.prioridad === "urgente");
  const hoys       = pending.filter(t => t.prioridad === "hoy");
  const programadas = pending.filter(t => t.prioridad === "programada");
  const displayed  = tab === "pendiente" ? pending : done;

  return (
    <>
      <Topbar
        title="Órdenes de trabajo"
        icon={IconClipboardCheck}
        iconColor="var(--info)"
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn" onClick={load} title="Actualizar"><IconRefresh size={13} /></button>
            <button className="btn btn-primary" onClick={() => setShowNew(!showNew)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              {showNew ? <IconX size={13} /> : <IconPlus size={13} />}
              Nueva tarea
            </button>
          </div>
        }
        configHref="/configuracion"
      />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Nueva tarea inline */}
        {showNew && (
          <form onSubmit={createTask} style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--info-border)",
            borderRadius: "var(--radius-lg)", padding: "14px 16px",
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 200px" }}>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>TÍTULO</label>
              <input placeholder="Descripción de la tarea..." value={newTitulo} onChange={e => setNewTitulo(e.target.value)} className="kp-input" style={{ fontSize: 12 }} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 130px" }}>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>MÓDULO</label>
              <select value={newSector} onChange={e => setNewSector(e.target.value)} className="kp-input" style={{ fontSize: 12 }}>
                {SECTOR_OPTS.filter(s => s.key).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>FECHA</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="kp-input" style={{ fontSize: 12 }} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 36, fontSize: 12 }}>
              {saving ? "Guardando..." : "Agregar"}
            </button>
          </form>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Período */}
          <div style={{ display: "flex", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)" }}>
            {PERIODO_OPTS.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                background: periodo === p.key ? "var(--bg-surface)" : "transparent",
                color:      periodo === p.key ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: periodo === p.key ? 500 : 400,
              }}>{p.label}</button>
            ))}
          </div>

          {/* Módulo */}
          <select value={sector} onChange={e => setSector(e.target.value)} className="kp-input" style={{ fontSize: 11, height: 30 }}>
            {SECTOR_OPTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          {/* Responsable */}
          <select value={responsable} onChange={e => setResponsable(e.target.value)} className="kp-input" style={{ fontSize: 11, height: 30 }}>
            {RESPONSABLE_OPTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
          {[
            { label: "Urgentes",   value: kpis.urgente,    bg: "var(--accent-subtle)",  border: "var(--accent-border)",  color: "var(--accent)"  },
            { label: "Para hoy",   value: kpis.hoy,        bg: "var(--warning-subtle)", border: "var(--warning-border)", color: "var(--warning)" },
            { label: "Programadas", value: kpis.programada, bg: "var(--bg-overlay)",     border: "var(--border-default)", color: "var(--info)"    },
            { label: "Completadas", value: kpis.completada, bg: "var(--success-subtle)", border: "var(--success-border)", color: "var(--success)" },
            { label: "Sin asignar", value: kpis.sinResp,   bg: "var(--bg-overlay)",     border: "var(--border-default)", color: "var(--text-secondary)" },
            { label: "Mañana",      value: kpis.manana,    bg: "var(--bg-overlay)",     border: "var(--border-default)", color: "var(--text-secondary)" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: `0.5px solid ${k.border}`, borderRadius: "var(--radius-lg)", padding: "10px 12px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tab toggle */}
        <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border-default)" }}>
          {[
            { key: "pendiente",  label: `Pendientes (${pending.length})` },
            { key: "completada", label: `Completadas (${done.length})`   },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "7px 16px", fontSize: 12, background: "none", border: "none", cursor: "pointer",
              fontWeight: tab === t.key ? 600 : 400,
              color:      tab === t.key ? "var(--info)" : "var(--text-muted)",
              borderBottom: tab === t.key ? "2px solid var(--info)" : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
            <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando tareas...</span>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <IconClipboardCheck size={32} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {tab === "pendiente" ? "Sin tareas pendientes" : "Sin tareas completadas"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tab === "pendiente" && urgentes.length > 0 && (
              <GroupHeader label="Vencidas / Urgentes" color="var(--accent)" count={urgentes.length} />
            )}
            {tab === "pendiente" && urgentes.map(t => (
              <TaskCard key={t.id} task={t} completing={completing} onToggle={toggleComplete} onReasignar={setReasignTask} canAdmin={canAdmin} />
            ))}

            {tab === "pendiente" && hoys.length > 0 && (
              <GroupHeader label="Para hoy" color="var(--warning)" count={hoys.length} />
            )}
            {tab === "pendiente" && hoys.map(t => (
              <TaskCard key={t.id} task={t} completing={completing} onToggle={toggleComplete} onReasignar={setReasignTask} canAdmin={canAdmin} />
            ))}

            {tab === "pendiente" && programadas.length > 0 && (
              <GroupHeader label="Próximas" color="var(--info)" count={programadas.length} />
            )}
            {tab === "pendiente" && programadas.map(t => (
              <TaskCard key={t.id} task={t} completing={completing} onToggle={toggleComplete} onReasignar={setReasignTask} canAdmin={canAdmin} />
            ))}

            {tab === "completada" && done.map(t => (
              <TaskCard key={t.id} task={t} completing={completing} onToggle={toggleComplete} onReasignar={setReasignTask} canAdmin={canAdmin} />
            ))}
          </div>
        )}
      </div>

      {reasignTask && (
        <ReasignarModal task={reasignTask} onClose={() => setReasignTask(null)} onDone={load} />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
