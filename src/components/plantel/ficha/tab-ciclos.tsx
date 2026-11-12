"use client";
// Ficha de la cerda → Ciclos: línea de tiempo desde la compra o el ingreso, ciclo por ciclo.
import { useEffect, useState } from "react";
import { IconLoader2, IconPigMoney, IconBuildingWarehouse } from "@tabler/icons-react";

type Nodo = { tipo: string; fecha: string; arriba: string; centro: string; abajo: string[]; previsto?: boolean };
type Tramo = { dias: number; etiqueta: string; abajo: string[]; perdida: boolean; previsto?: boolean };
type Fila = { numero: number; nodos: Nodo[]; tramos: Tramo[] };

const CIRCULO = 46;
const color = (perdida: boolean) => (perdida ? "var(--danger)" : "var(--text-muted)");

function Circulo({ n }: { n: Nodo }) {
  const fin = n.tipo === "FIN" || n.tipo === "HOY" || n.tipo === "DESCARTE" || n.tipo === "REPETICION" || n.tipo === "ABORTO" || n.tipo === "VACIA";
  if (fin) {
    const rojo = n.tipo !== "FIN" && n.tipo !== "HOY";
    return <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, border: `3px solid ${rojo ? "var(--danger)" : "var(--text-muted)"}`, background: "var(--bg-surface)" }} />;
  }
  const Icono = n.tipo === "COMPRA" ? IconPigMoney : n.tipo === "INGRESO" ? IconBuildingWarehouse : null;
  return (
    <span style={{ width: CIRCULO, height: CIRCULO, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: `3px ${n.previsto ? "dashed" : "solid"} ${n.previsto ? "var(--border-strong, var(--border-default))" : "var(--text-muted)"}`,
      background: "var(--bg-surface)", fontSize: n.centro.length > 4 ? 12 : 14, fontWeight: 700, color: n.previsto ? "var(--text-muted)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
      {Icono ? <Icono size={20} aria-hidden /> : n.centro}
    </span>
  );
}

function Punto({ n }: { n: Nodo }) {
  const fin = ["FIN", "HOY", "DESCARTE", "REPETICION", "ABORTO", "VACIA"].includes(n.tipo);
  const [titulo, fecha] = n.arriba.split("\n");
  return (
    <div style={{ width: fin ? 110 : 96, flexShrink: 0, display: "flex", flexDirection: fin ? "row" : "column", alignItems: "center", gap: fin ? 8 : 4, textAlign: fin ? "left" : "center" }}>
      {!fin && <div style={{ fontSize: 11, lineHeight: 1.3, minHeight: 28 }}><strong style={{ color: "var(--text-primary)" }}>{titulo}</strong><br /><span style={{ color: "var(--text-secondary)" }}>{fecha}</span></div>}
      <Circulo n={n} />
      {fin ? (
        <div style={{ fontSize: 11.5, lineHeight: 1.35, color: n.tipo === "FIN" || n.tipo === "HOY" ? "var(--text-secondary)" : "var(--danger-text)" }}>
          <div style={{ fontWeight: 600 }}>{titulo}</div><div>{fecha ?? n.abajo[0]}</div>
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.35, minHeight: 14 }}>{n.abajo.map(x => <div key={x}>{x}</div>)}</div>
      )}
    </div>
  );
}

function Segmento({ t }: { t: Tramo }) {
  return (
    <div style={{ flex: "1 1 120px", minWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 30 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.perdida ? "var(--danger-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{t.dias} días</div>
      <div aria-hidden style={{ width: "100%", height: 0, borderTop: `3px ${t.previsto ? "dashed" : "solid"} ${t.previsto ? "var(--border-strong, var(--border-default))" : color(t.perdida)}`, margin: "5px 0" }} />
      <div style={{ fontSize: 11, color: t.perdida ? "var(--danger-text)" : "var(--text-secondary)" }}>{t.etiqueta}</div>
      {t.abajo.length > 0 && <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.35, marginTop: 2, textAlign: "center" }}>{t.abajo.map(x => <div key={x}>{x}</div>)}</div>}
    </div>
  );
}

export function TabCiclos({ sowId }: { sowId: string }) {
  const [datos, setDatos] = useState<{ filas: Fila[]; idsMax: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setDatos(null); setError(false);
    fetch(`/api/plantel/animales/${sowId}/ciclos`).then(r => (r.ok ? r.json() : Promise.reject())).then(setDatos).catch(() => setError(true));
  }, [sowId]);
  if (error) return <div style={{ fontSize: 13, color: "var(--danger-text)" }}>No se pudo cargar la línea de tiempo.</div>;
  if (!datos) return <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><IconLoader2 size={18} className="animate-spin" aria-label="Cargando" /></div>;

  const leyenda = (estilo: string, c: string, texto: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden style={{ width: 22, height: 0, borderTop: `3px ${estilo} ${c}` }} />{texto}
    </span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-secondary)" }}>
        {leyenda("solid", "var(--text-muted)", "Evento normal")}
        {leyenda("solid", "var(--danger)", `Pérdida productiva (más de ${datos.idsMax} días vacía)`)}
        {leyenda("dashed", "var(--border-strong, var(--text-muted))", "Previsto")}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>En el parto: nacidos vivos / muertos y momificados. En el servicio: cantidad de montas o inseminaciones del celo.</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 640 }}>
          {datos.filas.map((f, i) => (
            <div key={i} style={{ display: "flex", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <div style={{ width: 52, flexShrink: 0, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }} title={f.numero === 0 ? "Antes del primer parto" : `Parto ${f.numero}`}>{f.numero}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-start", padding: "12px 14px" }}>
                {f.nodos.map((n, j) => (
                  <div key={j} style={{ display: "contents" }}>
                    <Punto n={n} />
                    {f.tramos[j] && <Segmento t={f.tramos[j]} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
