"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconPlus, IconLoader2, IconBabyCarriage, IconSkull,
  IconArrowsLeftRight, IconScale, IconAdjustments, IconSearch,
  IconX, IconAlertTriangle,
} from "@tabler/icons-react";
import { ModalMuerteLechon } from "./modal-muerte-lechon";
import { ModalAdopcion }     from "./modal-adopcion";
import { ModalDestete }      from "./modal-destete";

// ─── shared types ─────────────────────────────────────────────────────────────
interface FarrowingRow {
  id:                  string;
  sow:                 { identCode: string };
  startDatetime:       string;
  bornAlive:           number;
  currentStock:        number;
  lactationDays:       number;
  hasActiveWithdrawal: boolean;
  pen:                 { number: string; location: { name: string } } | null;
  deaths:              Array<{ id: string; deathDatetime: string; quantity: number; cause: string }>;
  movements:           Array<{ id: string; movementDate: string; quantity: number; destinationId: string; originId: string }>;
  weaning?:            { id: string; weaningDate: string; pigletsWeaned: number; avgPigletWeightKg: number | null } | null;
}

const CAUSE_LABELS: Record<string, string> = {
  WEAKNESS: "Flaqueza", CRUSHING: "Aplastamiento", DIARRHEA: "Diarrea",
  DEFICIENT: "Deficiente", DISEASE: "Enfermedad", SHELTER: "Refugio",
  HYPOTHERMIA: "Hipotermia", ACCIDENT: "Accidente", CONGENITAL: "Defecto congénito",
  ELIMINATED: "Eliminado", OTHER: "Otra",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + dt.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
}

// ─── sub-tab: Partos ──────────────────────────────────────────────────────────
function PartosList({ canRegister }: { canRegister: boolean }) {
  const [rows,    setRows]    = useState<FarrowingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/farrowing-events?active=false")
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? rows.filter(r => r.sow.identCode.toLowerCase().includes(query.toLowerCase()))
    : rows;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="Buscar por hembra..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canRegister && (
          <Link href="/maternidad/nuevo-parto" className="btn btn-primary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
            <IconPlus size={13} /> Nuevo parto
          </Link>
        )}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={IconBabyCarriage} text="Sin partos históricos" />
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Hembra</th>
              <th>Fecha parto</th>
              <th style={{ textAlign: "right" }}>Nacidos vivos</th>
              <th>Ubicación</th>
              <th style={{ textAlign: "right" }}>Días lactancia</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.sow.identCode}</td>
                <td>{fmtDateTime(f.startDatetime)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.bornAlive}</td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {f.pen ? `${f.pen.location.name} — corral ${f.pen.number}` : "—"}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.lactationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── sub-tab: Muerte Lechón ───────────────────────────────────────────────────
function MuerteList({ canRegister }: { canRegister: boolean }) {
  const [active,  setActive]  = useState<FarrowingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [step,    setStep]    = useState<"list" | "search" | "form">("list");
  const [search,  setSearch]  = useState("");
  const [chosen,  setChosen]  = useState<FarrowingRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/farrowing-events?active=true")
      .then(r => r.json())
      .then(d => setActive(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allDeaths = active.flatMap(f =>
    (f.deaths ?? []).map(d => ({ ...d, sowCode: f.sow.identCode }))
  );
  const filteredDeaths = query
    ? allDeaths.filter(d => d.sowCode.toLowerCase().includes(query.toLowerCase()))
    : allDeaths;
  const searchResults = search
    ? active.filter(f => f.sow.identCode.toLowerCase().includes(search.toLowerCase()))
    : active;

  if (step === "search") return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button className="btn" onClick={() => setStep("list")}>← Volver</button>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="ID de la hembra..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Seleccioná la cerda con partos activos:</div>
      {searchResults.slice(0, 10).map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => { setChosen(f); setStep("form"); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "10px 12px", marginBottom: 4,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface)")}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>{f.sow.identCode}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.currentStock} lechones · {f.lactationDays} días</span>
        </button>
      ))}
    </div>
  );

  if (step === "form" && chosen) return (
    <ModalMuerteLechon
      farrowing={chosen}
      onClose={() => { setStep("list"); setChosen(null); }}
      onSaved={() => { setStep("list"); setChosen(null); load(); }}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="Buscar por hembra..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canRegister && (
          <button className="btn btn-primary" onClick={() => { setStep("search"); setSearch(""); }}>
            <IconPlus size={13} /> Registrar muerte
          </button>
        )}
      </div>

      {loading ? <Spinner /> : filteredDeaths.length === 0 ? (
        <EmptyState icon={IconSkull} text="Sin muertes registradas" />
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Hembra</th>
              <th>Fecha y hora</th>
              <th style={{ textAlign: "right" }}>Cantidad</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeaths.slice(0, 50).map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 500 }}>{d.sowCode}</td>
                <td>{fmtDateTime(d.deathDatetime)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.quantity}</td>
                <td>{CAUSE_LABELS[d.cause] ?? d.cause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── sub-tab: Movimiento lechón ───────────────────────────────────────────────
function MovimientoList({ canRegister }: { canRegister: boolean }) {
  const [active,  setActive]  = useState<FarrowingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [step,    setStep]    = useState<"list" | "search" | "form">("list");
  const [search,  setSearch]  = useState("");
  const [chosen,  setChosen]  = useState<FarrowingRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/farrowing-events?active=true")
      .then(r => r.json())
      .then(d => setActive(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allMov = active.flatMap(f =>
    (f.movements ?? []).map(m => ({
      ...m,
      sowCode: f.sow.identCode,
      tipo: m.originId === f.id ? "Donó" : "Recibió",
    }))
  );
  const filteredMov = query
    ? allMov.filter(m => m.sowCode.toLowerCase().includes(query.toLowerCase()))
    : allMov;
  const searchResults = search
    ? active.filter(f => f.sow.identCode.toLowerCase().includes(search.toLowerCase()))
    : active;

  if (step === "search") return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button className="btn" onClick={() => setStep("list")}>← Volver</button>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="ID de la hembra..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Seleccioná la cerda:</div>
      {searchResults.slice(0, 10).map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => { setChosen(f); setStep("form"); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "10px 12px", marginBottom: 4,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface)")}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>{f.sow.identCode}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.currentStock} lechones</span>
        </button>
      ))}
    </div>
  );

  if (step === "form" && chosen) return (
    <ModalAdopcion
      farrowing={chosen}
      onClose={() => { setStep("list"); setChosen(null); }}
      onSaved={() => { setStep("list"); setChosen(null); load(); }}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="Buscar por hembra..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canRegister && (
          <button className="btn btn-primary" onClick={() => { setStep("search"); setSearch(""); }}>
            <IconPlus size={13} /> Registrar movimiento
          </button>
        )}
      </div>

      {loading ? <Spinner /> : filteredMov.length === 0 ? (
        <EmptyState icon={IconArrowsLeftRight} text="Sin movimientos registrados" />
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Hembra</th>
              <th>Fecha</th>
              <th>Acción</th>
              <th style={{ textAlign: "right" }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {filteredMov.slice(0, 50).map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 500 }}>{m.sowCode}</td>
                <td>{fmtDate(m.movementDate)}</td>
                <td>
                  <span className={`badge ${m.tipo === "Donó" ? "badge-warn" : "badge-ok"}`}>{m.tipo}</span>
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── sub-tab: Destete ─────────────────────────────────────────────────────────
function DesteteList({ canRegister }: { canRegister: boolean }) {
  const [active,  setActive]  = useState<FarrowingRow[]>([]);
  const [hist,    setHist]    = useState<FarrowingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [step,    setStep]    = useState<"list" | "search" | "form">("list");
  const [search,  setSearch]  = useState("");
  const [chosen,  setChosen]  = useState<FarrowingRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/farrowing-events?active=true").then(r => r.json()),
      fetch("/api/farrowing-events?active=false").then(r => r.json()),
    ])
      .then(([a, h]) => { setActive(Array.isArray(a) ? a : []); setHist(Array.isArray(h) ? h : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const weaned = hist.filter(f => f.weaning).map(f => ({ ...f.weaning!, sowCode: f.sow.identCode }));
  const filteredW = query ? weaned.filter(w => w.sowCode.toLowerCase().includes(query.toLowerCase())) : weaned;
  const searchResults = search ? active.filter(f => f.sow.identCode.toLowerCase().includes(search.toLowerCase())) : active;

  if (step === "search") return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button className="btn" onClick={() => setStep("list")}>← Volver</button>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="ID de la hembra..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Seleccioná la cerda (partos activos sin destete):</div>
      {searchResults.filter(f => !f.weaning).slice(0, 10).map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => { setChosen(f); setStep("form"); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "10px 12px", marginBottom: 4,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface)")}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>{f.sow.identCode}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.currentStock} lechones · {f.lactationDays} días lactancia</span>
        </button>
      ))}
    </div>
  );

  if (step === "form" && chosen) return (
    <ModalDestete
      farrowing={chosen}
      onClose={() => { setStep("list"); setChosen(null); }}
      onSaved={() => { setStep("list"); setChosen(null); load(); }}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="kp-input" style={{ paddingLeft: 26 }} placeholder="Buscar por hembra..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canRegister && (
          <button className="btn btn-primary" onClick={() => { setStep("search"); setSearch(""); }}>
            <IconPlus size={13} /> Registrar destete
          </button>
        )}
      </div>

      {loading ? <Spinner /> : filteredW.length === 0 ? (
        <EmptyState icon={IconScale} text="Sin destetes registrados" />
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Hembra</th>
              <th>Fecha destete</th>
              <th style={{ textAlign: "right" }}>Destetados</th>
              <th style={{ textAlign: "right" }}>Peso medio (kg)</th>
            </tr>
          </thead>
          <tbody>
            {filteredW.slice(0, 50).map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 500 }}>{w.sowCode}</td>
                <td>{fmtDate(w.weaningDate)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{w.pigletsWeaned}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {w.avgPigletWeightKg != null ? Number(w.avgPigletWeightKg).toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── sub-tab: Ajuste de stock ─────────────────────────────────────────────────
function AjusteList() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 0", background: "var(--bg-surface)",
      border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)",
    }}>
      <IconAdjustments size={28} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Ajustes de stock</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "center", maxWidth: 300 }}>
        Los ajustes se solicitan desde la tarjeta de cada parto activo. Un administrador debe aprobarlos.
      </div>
    </div>
  );
}

// ─── shared helpers ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8 }}>
      <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 0", background: "var(--bg-surface)",
      border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)",
    }}>
      <Icon size={28} style={{ color: "var(--text-muted)" }} />
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>{text}</div>
    </div>
  );
}

// ─── root component ───────────────────────────────────────────────────────────
const SUB_TABS: Array<{ key: string; label: string; icon: React.ElementType }> = [
  { key: "partos",    label: "Partos",            icon: IconBabyCarriage    },
  { key: "muerte",    label: "Muerte Lechón",      icon: IconSkull           },
  { key: "mov",       label: "Movimiento lechón",  icon: IconArrowsLeftRight },
  { key: "destete",   label: "Destete",            icon: IconScale           },
  { key: "ajuste",    label: "Ajuste de stock",    icon: IconAdjustments     },
];

interface Props {
  canRegister: boolean;
}

export function IngresosDatos({ canRegister }: Props) {
  const [sub, setSub] = useState("partos");

  return (
    <div>
      {/* Sub-tab strip */}
      <div style={{
        display: "flex", gap: 0,
        background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3,
        border: "0.5px solid var(--border-default)", marginBottom: 14, flexWrap: "wrap",
      }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: sub === t.key ? "var(--bg-surface)" : "transparent",
              color:      sub === t.key ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: sub === t.key ? 500 : 400,
              fontSize: 12,
            }}
          >
            <t.icon size={13} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {sub === "partos"  && <PartosList canRegister={canRegister} />}
      {sub === "muerte"  && <MuerteList canRegister={canRegister} />}
      {sub === "mov"     && <MovimientoList canRegister={canRegister} />}
      {sub === "destete" && <DesteteList canRegister={canRegister} />}
      {sub === "ajuste"  && <AjusteList />}
    </div>
  );
}
