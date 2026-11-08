"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { guardarCurva } from "@/app/acciones/engorde";

type Punto = { dia: number; pesoKg: number; consumoKgDia?: number };
type Curva = { id: string; nombre: string; predeterminada: boolean; puntos: Punto[] };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
// Punto de partida editable (no es una curva oficial de ninguna genética: ajustala con tus datos)
const EJEMPLO: Punto[] = [{ dia: 0, pesoKg: 25, consumoKgDia: 1.2 }, { dia: 30, pesoKg: 47, consumoKgDia: 1.9 }, { dia: 60, pesoKg: 72, consumoKgDia: 2.5 }, { dia: 90, pesoKg: 98, consumoKgDia: 2.9 }, { dia: 105, pesoKg: 110, consumoKgDia: 3.1 }];

export function EditorCurvas({ curvas, editable }: { curvas: Curva[]; editable: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: string | null; nombre: string; predeterminada: boolean; puntos: { dia: string; pesoKg: string; consumoKgDia: string }[] } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const abrir = (c: Curva | null) => setEdit({
    id: c?.id ?? null, nombre: c?.nombre ?? "", predeterminada: c?.predeterminada ?? curvas.length === 0,
    puntos: (c?.puntos ?? EJEMPLO).map(p => ({ dia: String(p.dia), pesoKg: String(p.pesoKg), consumoKgDia: p.consumoKgDia === undefined ? "" : String(p.consumoKgDia) })),
  });
  const n = (v: string) => Number(v.replace(",", "."));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Peso esperado por día de engorde. Sirve para comparar los pesajes y estimar cuándo sale cada lote.</div>
        {editable && !edit && <button type="button" className="btn" onClick={() => abrir(null)}><IconPlus size={14} aria-hidden /> Nueva curva</button>}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {edit && (
        <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => {
          const r = await guardarCurva({ id: edit.id, nombre: edit.nombre, predeterminada: edit.predeterminada, puntos: edit.puntos.filter(p => p.dia !== "" && p.pesoKg !== "").map(p => ({ dia: Math.round(n(p.dia)), pesoKg: n(p.pesoKg), ...(p.consumoKgDia ? { consumoKgDia: n(p.consumoKgDia) } : {}) })) });
          if (r.ok) { setEdit(null); setMsg({ tipo: "ok", texto: "Curva guardada." }); router.refresh(); } else setMsg({ tipo: "error", texto: r.error });
        }); }} style={{ ...tarjeta, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 200 }}><span className="kp-label">Nombre</span><input className="kp-input" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} required maxLength={80} placeholder="Ej: Machos castrados" /></label>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", paddingBottom: 8 }}><input type="checkbox" checked={edit.predeterminada} onChange={e => setEdit({ ...edit, predeterminada: e.target.checked })} /> Usarla por defecto</label>
          </div>
          <table className="kp-table">
            <thead><tr><th>Día</th><th>Peso (kg)</th><th>Consumo (kg/día)</th><th></th></tr></thead>
            <tbody>
              {edit.puntos.map((p, i) => (
                <tr key={i}>
                  {(["dia", "pesoKg", "consumoKgDia"] as const).map(k => (
                    <td key={k} style={{ padding: 2 }}><input className="kp-input" inputMode="decimal" value={p[k]} aria-label={k} style={{ height: 30 }}
                      onChange={e => setEdit({ ...edit, puntos: edit.puntos.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} /></td>
                  ))}
                  <td><button type="button" className="btn" aria-label="Quitar punto" style={{ height: 26 }} onClick={() => setEdit({ ...edit, puntos: edit.puntos.filter((_, j) => j !== i) })}><IconTrash size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <button type="button" className="btn" onClick={() => setEdit({ ...edit, puntos: [...edit.puntos, { dia: "", pesoKg: "", consumoKgDia: "" }] })}><IconPlus size={13} aria-hidden /> Punto</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setEdit(null)} disabled={pendiente}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar curva</button>
            </div>
          </div>
          {!edit.id && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Los valores de arriba son un punto de partida: reemplazalos por los de tu genética y tu granja.</div>}
        </form>
      )}
      {curvas.map(c => (
        <div key={c.id} style={{ ...tarjeta, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{c.nombre}{c.predeterminada && <span style={{ fontSize: 11, color: "var(--accent-text)" }}> · por defecto</span>}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.puntos.map(p => `día ${p.dia}: ${p.pesoKg} kg`).join(" · ")}</div>
          </div>
          {editable && <button type="button" className="btn" style={{ height: 28 }} onClick={() => abrir(c)}>Editar</button>}
        </div>
      ))}
      {curvas.length === 0 && !edit && <div style={{ ...tarjeta, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay curvas. Sin curva, la salida se estima con la ganancia diaria.</div>}
    </>
  );
}
