"use client";
// Transferencias del módulo: órdenes para enviar (salen de acá) y animales por recibir (llegan acá).
// Recibir = aceptar: recién ahí los animales entran al módulo. Pensado para el celular (tarjetas, botones grandes).
import { useCallback, useEffect, useState, useTransition } from "react";
import { IconArrowRight, IconCheck, IconChevronDown, IconChevronUp, IconLoader2, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { enviarTransferencia, panelTransferencias, recibirTransferencia, rechazarTransferencia } from "@/app/acciones/transferencias";
import { CaravanaFicha } from "@/components/plantel/caravana-ficha";
import { CATEGORIAS } from "@/lib/transferencias/tipos";
import { InputNumero } from "@/components/ui/input-numero";

type Pantalla = Parameters<typeof panelTransferencias>[0];
type Datos = Awaited<ReturnType<typeof panelTransferencias>>;
type Fila = Datos["filas"][number];

const fecha = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
const kg = (v: number) => `${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`;
const numero = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

export function PanelTransferencias({ pantalla, onCambio }: { pantalla: Pantalla; onCambio?: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const cargar = useCallback(() => { panelTransferencias(pantalla).then(setDatos).catch(() => setDatos(null)); }, [pantalla]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!datos) return null;

  const paraEnviar = datos.filas.filter(f => f.estado === "ORDEN" && f.origen === pantalla);
  const porRecibir = datos.filas.filter(f => f.estado === "EN_CAMINO");
  const historial = datos.filas.filter(f => f.estado === "RECIBIDA" || f.estado === "RECHAZADA");
  if (!paraEnviar.length && !porRecibir.length && !historial.length) return null;
  const listo = () => { cargar(); onCambio?.(); };

  return (
    <section aria-labelledby={`tr-${pantalla}`} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--accent-border, var(--border-default))", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <IconTruckDelivery size={18} style={{ color: "var(--accent)" }} aria-hidden />
        <h3 id={`tr-${pantalla}`} style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Transferencias</h3>
        {porRecibir.length > 0 && <span className="badge badge-danger">{porRecibir.length} por recibir</span>}
        {paraEnviar.length > 0 && <span className="badge badge-warn">{paraEnviar.length} para enviar</span>}
      </div>

      {paraEnviar.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Órdenes de trabajo: hay que enviar</div>
          <div className="kp-transfer-lista">{paraEnviar.map(f => <TarjetaEnviar key={f.id} f={f} puede={datos.puedeEnviar} onListo={listo} />)}</div>
        </div>
      )}
      {porRecibir.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Llegan acá: revisá y aceptá la recepción</div>
          <div className="kp-transfer-lista">{porRecibir.map(f => <TarjetaRecibir key={f.id} f={f} puede={datos.puedeRecibir} onListo={listo} />)}</div>
        </div>
      )}
      {historial.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerHistorial(v => !v)} aria-expanded={verHistorial}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 0 }}>
            Últimos 7 días ({historial.length}) {verHistorial ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
          </button>
          {verHistorial && (
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {historial.map(f => (
                <li key={f.id} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <span className={f.estado === "RECIBIDA" ? "badge badge-ok" : "badge badge-danger"} style={{ fontSize: 10.5, marginRight: 6 }}>{f.estado === "RECIBIDA" ? "Recibida" : "Rechazada"}</span>
                  {f.motivo}{f.resueltaPor ? ` · ${f.resueltaPor}` : ""}{f.resueltaEn ? ` · ${fecha(f.resueltaEn)}` : ""}{f.nota ? ` · ${f.nota}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Encabezado({ f }: { f: Fila }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-muted)" }}>
        <span>{f.deDonde}</span><IconArrowRight size={12} aria-hidden /><span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{f.aDonde}</span>
        {f.fechaProgramada && <span>· para el {fecha(f.fechaProgramada)}</span>}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>
        {f.cerda ? <><CaravanaFicha sowId={f.cerda.id} caravana={f.cerda.caravana} /> · </> : null}{f.motivo}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span><strong>{f.cantidad}</strong> {CATEGORIAS[f.categoria as keyof typeof CATEGORIAS]?.unidad ?? "animales"}</span>
        {f.pesoTotalKg != null && <span>{kg(f.pesoTotalKg)} en total ({kg(f.pesoTotalKg / f.cantidad)} c/u)</span>}
        {f.edadDias != null && <span>{f.edadDias} días de edad</span>}
        {f.proveedor && <span>de {f.proveedor}</span>}
        {f.cerda?.ubicacion && <span>hoy en {f.cerda.ubicacion}</span>}
      </div>
      {f.animales && f.animales.length > 0 && (
        <details style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <summary style={{ cursor: "pointer" }}>Ver caravanas ({f.animales.length})</summary>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {f.animales.map((a, i) => <li key={i}>{a.caravana || "s/caravana"}{a.sexo ? ` · ${a.sexo === "H" ? "hembra" : "macho"}` : ""}{a.pesoKg ? ` · ${kg(a.pesoKg)}` : ""}{a.genetica ? ` · ${a.genetica}` : ""}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}

function TarjetaEnviar({ f, puede, onListo }: { f: Fila; puede: boolean; onListo: () => void }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <article className="kp-transfer">
      <Encabezado f={f} />
      {puede ? (
        <button type="button" className="btn btn-primary" disabled={pendiente} style={{ width: "100%", justifyContent: "center", minHeight: 42 }}
          onClick={() => iniciar(async () => { setError(null); const r = await enviarTransferencia(f.id); if (!r.ok) setError(r.error); else onListo(); })}>
          {pendiente ? <IconLoader2 size={14} className="animate-spin" aria-hidden /> : <IconTruckDelivery size={15} aria-hidden />} Ya salió: enviar a {f.aDonde}
        </button>
      ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Lo envía alguien con permiso en este módulo.</span>}
      {error && <span role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
    </article>
  );
}

function TarjetaRecibir({ f, puede, onListo }: { f: Fila; puede: boolean; onListo: () => void }) {
  const [cant, setCant] = useState(String(f.cantidad));
  const [peso, setPeso] = useState("");
  const [ubic, setUbic] = useState(f.ubicacion ?? "");
  const [nota, setNota] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const aceptar = () => {
    const c = numero(cant), p = peso ? numero(peso) : null;
    if (!Number.isInteger(c) || c < 1) { setError("Escribí cuántos llegaron."); return; }
    if (p != null && (!Number.isFinite(p) || p < 0)) { setError("El peso no es válido."); return; }
    iniciar(async () => {
      setError(null);
      const r = await recibirTransferencia({ id: f.id, cantidadRecibida: c, pesoRecibidoKg: p, ubicacion: ubic, nota });
      if (!r.ok) setError(r.error); else onListo();
    });
  };
  const rechazar = () => {
    const motivo = window.prompt("¿Por qué no la recibís? (queda registrado)");
    if (!motivo) return;
    iniciar(async () => { setError(null); const r = await rechazarTransferencia(f.id, motivo); if (!r.ok) setError(r.error); else onListo(); });
  };
  const etiqueta: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-secondary)", flex: "1 1 120px", minWidth: 0 };
  return (
    <article className="kp-transfer">
      <Encabezado f={f} />
      {puede ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={etiqueta}>¿Cuántos llegaron?<InputNumero className="kp-input" inputMode="numeric" value={cant} onChange={e => setCant(e.target.value)} /></label>
            {f.categoria === "LECHONES" && <label style={etiqueta}>Peso total (kg, opcional)<InputNumero className="kp-input" inputMode="decimal" placeholder={f.pesoTotalKg ? String(f.pesoTotalKg) : "—"} value={peso} onChange={e => setPeso(e.target.value)} /></label>}
            <label style={{ ...etiqueta, flex: "2 1 180px" }}>¿Dónde quedan?<input className="kp-input" placeholder={f.destino === "MATERNIDAD" ? "Sala / jaula" : "Galpón / corral"} value={ubic} onChange={e => setUbic(e.target.value)} /></label>
          </div>
          <label style={etiqueta}>Nota (opcional)<input className="kp-input" placeholder="Ej.: llegó una renga" value={nota} onChange={e => setNota(e.target.value)} /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={pendiente} onClick={aceptar} style={{ flex: "2 1 180px", justifyContent: "center", minHeight: 42 }}>
              {pendiente ? <IconLoader2 size={14} className="animate-spin" aria-hidden /> : <IconCheck size={15} aria-hidden />} Aceptar recepción
            </button>
            <button type="button" className="btn" disabled={pendiente} onClick={rechazar} style={{ flex: "1 1 120px", justifyContent: "center", minHeight: 42 }}>
              <IconX size={14} aria-hidden /> No recibir
            </button>
          </div>
        </>
      ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>La recibe alguien con permiso en este módulo.</span>}
      {error && <span role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
    </article>
  );
}
