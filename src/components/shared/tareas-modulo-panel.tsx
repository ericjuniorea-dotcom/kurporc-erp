"use client";
import { useState, useEffect, useCallback } from "react";
import { IconCheck, IconLoader2, IconListCheck, IconChevronRight, IconPlus, IconX } from "@tabler/icons-react";
import Link from "next/link";

interface Task {
  id:                string;
  tipo:              string;
  titulo:            string;
  descripcion:       string;
  prioridad:         string;
  fechaVencimiento:  string;
  fechaCompletada:   string | null;
  targetLabel:       string | null;
  sector:            string;
  responsableNombre: string | null;
  responsableKey:    string | null;
}

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

const AVATAR_MINI: Record<string, { in: string; bg: string }> = {
  "veterinario":   { in: "VE", bg: "#A31621" },
  "gestacion":  { in: "GE", bg: "#E07C2E" },
  "maternidad": { in: "MA", bg: "#D4537E" },
  "produccion":     { in: "JP", bg: "#1D9E75" },
  "admin":     { in: "AD", bg: "#378ADD" },
};

const P_STYLE = {
  urgente:    { bg: "var(--accent-subtle)",  border: "var(--accent-border)",  dot: "var(--accent)",  text: "var(--accent-text)"  },
  hoy:        { bg: "var(--warning-subtle)", border: "var(--warning-border)", dot: "var(--warning)", text: "var(--warning-text)" },
  programada: { bg: "var(--bg-overlay)",     border: "var(--border-default)", dot: "var(--text-muted)", text: "var(--text-secondary)" },
  completada: { bg: "transparent",           border: "var(--border-default)", dot: "var(--success)", text: "var(--text-muted)"   },
};

interface Props {
  sector:       string;
  accentColor?: string;
}

export function TareasModuloPanel({ sector, accentColor = "var(--text-primary)" }: Props) {
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [counts,         setCounts]         = useState({ urgente: 0, hoy: 0, programada: 0, completada: 0 });
  const [loading,        setLoading]        = useState(true);
  const [completing,     setCompleting]     = useState<string | null>(null);
  const [showDone,       setShowDone]       = useState(false);
  const [showNewTask,    setShowNewTask]    = useState(false);
  const [newTaskTitulo,  setNewTaskTitulo]  = useState("");
  const [newTaskDate,    setNewTaskDate]    = useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  const [saving,         setSaving]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/tareas/hoy?sector=${sector}`)
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => {
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
        setCounts({ urgente: d.urgente ?? 0, hoy: d.hoy ?? 0, programada: d.programada ?? 0, completada: d.completada ?? 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sector]);

  useEffect(() => { load(); }, [load]);

  async function toggleComplete(task: Task) {
    setCompleting(task.id);
    const method = task.fechaCompletada ? "DELETE" : "POST";
    await fetch(`/api/tareas/${task.id}/completar`, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    method === "POST" ? JSON.stringify({}) : undefined,
    }).catch(() => {});
    setCompleting(null);
    load();
  }

  async function createManualTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitulo.trim()) return;
    setSaving(true);
    await fetch("/api/tareas/manual", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sector, titulo: newTaskTitulo, fechaVencimiento: newTaskDate, tipo: "tratamiento-curativo" }),
    }).catch(() => {});
    setSaving(false);
    setNewTaskTitulo("");
    setShowNewTask(false);
    load();
  }

  const pending    = tasks.filter(t => !t.fechaCompletada);
  const done       = tasks.filter(t =>  t.fechaCompletada);
  const urgente    = pending.filter(t => t.prioridad === "urgente");
  const hoy        = pending.filter(t => t.prioridad === "hoy");
  const programada = pending.filter(t => t.prioridad === "programada");
  const totalPending = urgente.length + hoy.length;

  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", background: "var(--bg-overlay)",
        borderBottom: "0.5px solid var(--border-default)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <IconListCheck size={13} style={{ color: accentColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>
          Órdenes de trabajo
        </span>
        {totalPending > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
            background: counts.urgente > 0 ? "var(--accent-subtle)"  : "var(--warning-subtle)",
            color:      counts.urgente > 0 ? "var(--accent-text)"    : "var(--warning-text)",
            border:     `0.5px solid ${counts.urgente > 0 ? "var(--accent-border)" : "var(--warning-border)"}`,
          }}>
            {totalPending} pendiente{totalPending !== 1 ? "s" : ""}
          </span>
        )}
        <button
          onClick={() => setShowNewTask(!showNewTask)}
          title="Nueva tarea manual"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 6, border: "0.5px solid var(--border-default)",
            background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-muted)",
          }}
        >
          {showNewTask ? <IconX size={11} /> : <IconPlus size={11} />}
        </button>
        <Link
          href={`/tareas?sector=${sector}`}
          style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}
        >
          Ver todas <IconChevronRight size={10} />
        </Link>
      </div>

      {/* New task form */}
      {showNewTask && (
        <form onSubmit={createManualTask} style={{
          padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)",
          background: "var(--bg-overlay)", display: "flex", gap: 8, alignItems: "center",
        }}>
          <input
            placeholder="Título de la tarea..."
            value={newTaskTitulo}
            onChange={e => setNewTaskTitulo(e.target.value)}
            className="kp-input"
            style={{ flex: 1, fontSize: 11, height: 28 }}
            required
          />
          <input
            type="date"
            value={newTaskDate}
            onChange={e => setNewTaskDate(e.target.value)}
            className="kp-input"
            style={{ fontSize: 11, height: 28, width: 130 }}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ fontSize: 11, height: 28 }} disabled={saving}>
            {saving ? "..." : "Agregar"}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ padding: "20px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <IconLoader2 size={14} style={{ animation: "kp-spin 1s linear infinite", color: "var(--text-muted)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Cargando...</span>
        </div>
      ) : (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {pending.length === 0 && done.length === 0 ? (
            <div style={{ padding: "14px 0", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
              Sin tareas para los próximos 7 días
            </div>
          ) : (
            <>
              {urgente.map(t => (
                <TaskRow key={t.id} task={t} completing={completing} onToggle={toggleComplete} />
              ))}
              {hoy.map(t => (
                <TaskRow key={t.id} task={t} completing={completing} onToggle={toggleComplete} />
              ))}
              {programada.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", marginTop: 6, marginBottom: 1, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Próximos 7 días
                  </div>
                  {programada.map(t => (
                    <TaskRow key={t.id} task={t} completing={completing} onToggle={toggleComplete} />
                  ))}
                </>
              )}
              {done.length > 0 && (
                <>
                  <button
                    onClick={() => setShowDone(!showDone)}
                    style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "1px 0" }}
                  >
                    {showDone ? "▾" : "▸"} {done.length} completada{done.length !== 1 ? "s" : ""} hoy
                  </button>
                  {showDone && done.map(t => (
                    <TaskRow key={t.id} task={t} completing={completing} onToggle={toggleComplete} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
      <style>{`@keyframes kp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function TaskRow({ task, completing, onToggle }: {
  task:       Task;
  completing: string | null;
  onToggle:   (t: Task) => void;
}) {
  const done      = !!task.fechaCompletada;
  const isLoading = completing === task.id;
  const ps        = P_STYLE[task.prioridad as keyof typeof P_STYLE] ?? P_STYLE.programada;
  const emoji     = TIPO_EMOJI[task.tipo] ?? "📋";

  const due   = new Date(task.fechaVencimiento);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due.getTime() - today.getTime()) / 86400000);
  const dueLabel = diff < 0  ? `Venció hace ${-diff}d`
    : diff === 0 ? "Hoy"
    : diff === 1 ? "Mañana"
    : `En ${diff} días`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 8px", borderRadius: "var(--radius-md)",
      background: done ? "transparent" : ps.bg,
      border: `0.5px solid ${ps.border}`,
      opacity: done ? 0.55 : 1,
    }}>
      <button
        onClick={() => onToggle(task)}
        disabled={isLoading}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${done ? "var(--success)" : ps.dot}`,
          background: done ? "var(--success)" : "transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {isLoading
          ? <IconLoader2 size={10} style={{ animation: "kp-spin 1s linear infinite", color: done ? "white" : ps.dot }} />
          : done
          ? <IconCheck size={10} color="white" />
          : null
        }
      </button>

      <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ marginRight: 4 }}>{emoji}</span>
        <span style={{ fontWeight: done ? 400 : 500, color: done ? "var(--text-muted)" : ps.text, textDecoration: done ? "line-through" : "none" }}>
          {task.titulo}
        </span>
        {task.targetLabel && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
            {task.targetLabel}
          </span>
        )}
      </span>

      {/* Responsable mini avatar */}
      {task.responsableKey && AVATAR_MINI[task.responsableKey] && (
        <div
          title={task.responsableNombre ?? undefined}
          style={{
            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
            background: AVATAR_MINI[task.responsableKey].bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#fff",
          }}
        >
          {AVATAR_MINI[task.responsableKey].in}
        </div>
      )}

      <span style={{
        fontSize: 9, padding: "2px 5px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
        background: "var(--bg-surface)", color: ps.text,
        border: `0.5px solid ${ps.border}`, fontWeight: 500,
      }}>
        {dueLabel}
      </span>
    </div>
  );
}
