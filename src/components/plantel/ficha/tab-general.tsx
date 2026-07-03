"use client";
import { useState } from "react";
import { IconDeviceFloppy, IconLoader2, IconEdit } from "@tabler/icons-react";

interface SowDetail {
  id: string;
  erpCode: string | null;
  caravanaCode: string | null;
  tattooCode: string | null;
  rfidChip: string | null;
  identCode: string;
  breed: string | null;
  geneticLine: string | null;
  birthDate: string | null;
  entryDate: string;
  entryWeightKg: string | null;
  sourceProvider: string | null;
  purchasePriceGs: string | null;
  damCodeOrigin: string | null;
  sireCodeOrigin: string | null;
  galponAssigned: string | null;
  corralAssigned: string | null;
  plantelState: string | null;
  plantelNotes: string | null;
  currentParityCount: number;
}

interface Props {
  sow: SowDetail;
  canEdit: boolean;
  onUpdated: () => void;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 400, minHeight: 20 }}>
        {value || <span style={{ color: "var(--text-muted)" }}>—</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: 10, paddingBottom: 6,
        borderBottom: "0.5px solid var(--border-default)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "12px 16px" }}>
      {children}
    </div>
  );
}

export function TabGeneral({ sow, canEdit, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({
    caravanaCode:  sow.caravanaCode  ?? "",
    tattooCode:    sow.tattooCode    ?? "",
    rfidChip:      sow.rfidChip      ?? "",
    breed:         sow.breed         ?? "",
    geneticLine:   sow.geneticLine   ?? "",
    birthDate:     sow.birthDate ? sow.birthDate.slice(0, 10) : "",
    sourceProvider: sow.sourceProvider ?? "",
    damCodeOrigin: sow.damCodeOrigin  ?? "",
    sireCodeOrigin: sow.sireCodeOrigin ?? "",
    galponAssigned: sow.galponAssigned ?? "",
    corralAssigned: sow.corralAssigned ?? "",
    plantelNotes:  sow.plantelNotes   ?? "",
  });

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/plantel/animales/${sow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Section title="Identificación">
          <Grid cols={3}>
            <div>
              <label className="kp-label">Caravana</label>
              <input className="kp-input" value={form.caravanaCode} onChange={e => F("caravanaCode", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Tatuaje</label>
              <input className="kp-input" value={form.tattooCode} onChange={e => F("tattooCode", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">RFID / Chip</label>
              <input className="kp-input" value={form.rfidChip} onChange={e => F("rfidChip", e.target.value)} />
            </div>
          </Grid>
        </Section>

        <Section title="Datos genéticos">
          <Grid cols={2}>
            <div>
              <label className="kp-label">Raza</label>
              <input className="kp-input" value={form.breed} onChange={e => F("breed", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Línea genética</label>
              <input className="kp-input" value={form.geneticLine} onChange={e => F("geneticLine", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Código madre (origen)</label>
              <input className="kp-input" value={form.damCodeOrigin} onChange={e => F("damCodeOrigin", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Código padre (origen)</label>
              <input className="kp-input" value={form.sireCodeOrigin} onChange={e => F("sireCodeOrigin", e.target.value)} />
            </div>
          </Grid>
        </Section>

        <Section title="Ingreso y ubicación">
          <Grid cols={3}>
            <div>
              <label className="kp-label">F. Nacimiento</label>
              <input className="kp-input" type="date" value={form.birthDate} onChange={e => F("birthDate", e.target.value)} />
            </div>
            <div>
              <label className="kp-label">Proveedor / Origen</label>
              <input className="kp-input" value={form.sourceProvider} onChange={e => F("sourceProvider", e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="kp-label">Galpón</label>
                <input className="kp-input" value={form.galponAssigned} onChange={e => F("galponAssigned", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="kp-label">Corral</label>
                <input className="kp-input" value={form.corralAssigned} onChange={e => F("corralAssigned", e.target.value)} />
              </div>
            </div>
          </Grid>
        </Section>

        <Section title="Observaciones">
          <textarea
            className="kp-input"
            rows={3}
            value={form.plantelNotes}
            onChange={e => F("plantelNotes", e.target.value)}
            style={{ height: "auto", paddingTop: 8, resize: "vertical" }}
          />
        </Section>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
              : <><IconDeviceFloppy size={13} /> Guardar cambios</>
            }
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => setEditing(true)}>
            <IconEdit size={12} /> Editar datos
          </button>
        </div>
      )}

      <Section title="Identificación">
        <Grid cols={3}>
          <InfoRow label="Código ERP"   value={<span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{sow.erpCode}</span>} />
          <InfoRow label="Caravana"     value={sow.caravanaCode} />
          <InfoRow label="Tatuaje"      value={sow.tattooCode} />
          <InfoRow label="RFID / Chip"  value={sow.rfidChip} />
          <InfoRow label="N° partos"    value={sow.currentParityCount} />
        </Grid>
      </Section>

      <Section title="Datos genéticos">
        <Grid cols={2}>
          <InfoRow label="Raza"            value={sow.breed} />
          <InfoRow label="Línea genética"  value={sow.geneticLine} />
          <InfoRow label="Código madre"    value={sow.damCodeOrigin} />
          <InfoRow label="Código padre"    value={sow.sireCodeOrigin} />
        </Grid>
      </Section>

      <Section title="Ingreso y ubicación">
        <Grid cols={3}>
          <InfoRow label="F. Nacimiento"    value={fmtDate(sow.birthDate)} />
          <InfoRow label="F. Ingreso"       value={fmtDate(sow.entryDate)} />
          <InfoRow label="Peso al ingreso"  value={sow.entryWeightKg ? `${sow.entryWeightKg} kg` : null} />
          <InfoRow label="Proveedor"        value={sow.sourceProvider} />
          <InfoRow label="Precio compra"    value={sow.purchasePriceGs ? `₲ ${Number(sow.purchasePriceGs).toLocaleString("es-PY")}` : null} />
          <InfoRow label="Ubicación"        value={[sow.galponAssigned, sow.corralAssigned && `C.${sow.corralAssigned}`].filter(Boolean).join(" · ")} />
        </Grid>
      </Section>

      {sow.plantelNotes && (
        <Section title="Observaciones">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{sow.plantelNotes}</p>
        </Section>
      )}
    </div>
  );
}
