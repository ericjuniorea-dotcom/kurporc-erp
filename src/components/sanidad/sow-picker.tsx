"use client";
import { useState, useEffect } from "react";
import { IconSearch } from "@tabler/icons-react";

interface SowOption { id: string; identCode: string }

export function SowPicker({ value, onChange }: { value: SowOption | null; onChange: (sow: SowOption | null) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SowOption[]>([]);

  useEffect(() => {
    if (value) return;
    const t = setTimeout(() => {
      fetch(`/api/sows?q=${encodeURIComponent(query)}&active=true`)
        .then(r => r.ok ? r.json() : [])
        .then(setOptions)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query, value]);

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--success-subtle)", border: "0.5px solid var(--success-border)", borderRadius: "var(--radius-md)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success-text)" }}>{value.identCode}</span>
        <button type="button" onClick={() => onChange(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--success-text)" }}>
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          className="kp-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar cerda por caravana…"
          style={{ paddingLeft: 28, fontSize: 12 }}
        />
      </div>
      {options.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: "auto", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", marginTop: 6 }}>
          {options.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s); setOptions([]); }}
              style={{ width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 12, background: "none", border: "none", borderTop: i > 0 ? "0.5px solid var(--border-default)" : "none", cursor: "pointer" }}
            >
              {s.identCode}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
