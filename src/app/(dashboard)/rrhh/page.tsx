"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import { useRouter }  from "next/navigation";
import { Topbar }     from "@/components/layout/topbar";
import { IconUsers, IconPlus, IconLoader2, IconPlayerPlay } from "@tabler/icons-react";

const ALLOWED = [1, 2, 5, 8];

interface Funcionario {
  id:          string;
  name:        string;
  cargo:       string | null;
  category:    string | null;
  position:    string | null;
  sector:      string | null;
  iniciales:   string | null;
  colorBg:     string | null;
  colorBorder: string | null;
  colorText:   string | null;
  cedula:      string | null;
  isActive:    boolean;
}

const SECTOR_LABELS: Record<string, string> = {
  gestacion:  "Gestación",
  maternidad: "Maternidad",
  recria:     "Iniciación",
  engorde:    "Engorde",
  veterinario:"Veterinaria",
  admin:      "Administración",
  all:        "Toda la granja",
};

function Avatar({ f }: { f: Funcionario }) {
  const bg  = f.colorBg     ?? "#64748B";
  const bdr = f.colorBorder ?? "#475569";
  const txt = f.colorText   ?? "#FFFFFF";
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
      background: bg, border: `2px solid ${bdr}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, color: txt, letterSpacing: "0.02em",
    }}>
      {f.iniciales ?? f.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function FuncionarioCard({ f }: { f: Funcionario }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
    }}>
      <Avatar f={f} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{f.cargo ?? f.position ?? "—"}</div>
        {f.sector && (
          <div style={{
            display: "inline-flex", alignItems: "center", marginTop: 6,
            background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
            borderRadius: 99, padding: "2px 8px", fontSize: 10, color: "var(--text-muted)",
          }}>
            {SECTOR_LABELS[f.sector] ?? f.sector}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
        color: "var(--success-text)", background: "var(--success-subtle)",
        border: "0.5px solid var(--success-border)", borderRadius: 99, padding: "3px 9px",
      }}>
        Activo
      </div>
    </div>
  );
}

export default function RRHHPage() {
  const { data: session, status } = useSession();
  const { alguno } = usePermisos();
  const router = useRouter();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [seeding,      setSeeding]      = useState(false);
  const [seedMsg,      setSeedMsg]      = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !alguno(["rrhh.funcionarios.ver"])) {
      router.push("/dashboard");
    }
  }, [session, status, router, alguno]);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/rrhh/funcionarios")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setFuncionarios(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (status === "authenticated") load(); }, [status, load]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const r = await fetch("/api/rrhh/funcionarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const d = await r.json();
      setSeedMsg(d.count > 0 ? `${d.count} funcionarios inicializados` : "Ya estaban inicializados");
      load();
    } catch {
      setSeedMsg("Error al inicializar");
    }
    setSeeding(false);
  };

  if (status === "loading" || !session) return null;

  const canAdmin = alguno(["rrhh.funcionarios.crear"]);

  return (
    <>
      <Topbar
        title="Recursos Humanos"
        icon={IconUsers}
        iconColor="var(--info)"
        tabs={[
          { key: "funcionarios", label: "Funcionarios" },
        ]}
        activeTab="funcionarios"
        onTabChange={() => {}}
        actions={canAdmin ? (
          <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={13} /> Nuevo funcionario
          </button>
        ) : undefined}
        configHref="/configuracion?modulo=RRHH"
      />

      <div style={{ padding: "16px 20px", maxWidth: 800 }}>
        {/* Seed banner */}
        {canAdmin && funcionarios.length === 0 && !loading && (
          <div style={{
            background: "var(--info-subtle)", border: "0.5px solid var(--info-border)",
            borderRadius: "var(--radius-lg)", padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <IconPlayerPlay size={18} style={{ color: "var(--info-text)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--info-text)" }}>
                Sin funcionarios registrados
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Inicializar con el equipo KurPorc (5 funcionarios predefinidos)
              </div>
            </div>
            <button
              className="btn"
              onClick={handleSeed}
              disabled={seeding}
              style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}
            >
              {seeding ? <IconLoader2 size={12} className="spin" /> : null}
              {seeding ? "Inicializando..." : "Inicializar equipo"}
            </button>
          </div>
        )}

        {seedMsg && (
          <div style={{
            background: "var(--success-subtle)", border: "0.5px solid var(--success-border)",
            borderRadius: "var(--radius-md)", padding: "8px 12px",
            fontSize: 11, color: "var(--success-text)", marginBottom: 12,
          }}>
            {seedMsg}
          </div>
        )}

        {/* Si hay funcionarios y canAdmin — mostrar botón seed también */}
        {canAdmin && funcionarios.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn" style={{ fontSize: 11 }} onClick={handleSeed} disabled={seeding}>
              {seeding ? "Sincronizando..." : "Verificar/sincronizar equipo base"}
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                height: 80, background: "var(--bg-overlay)",
                borderRadius: "var(--radius-lg)", border: "0.5px solid var(--border-default)",
              }} />
            ))
          ) : (
            funcionarios.map(f => <FuncionarioCard key={f.id} f={f} />)
          )}
        </div>

        {!loading && funcionarios.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 0",
            fontSize: 12, color: "var(--text-muted)",
          }}>
            No hay funcionarios registrados.
          </div>
        )}
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
