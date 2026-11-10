"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { moverPedidoTienda, responderResena } from "@/app/acciones/vendedor-pedidos";
import type { Estado } from "@/lib/pedidos/reglas";

export function AccionesTienda({ id, estado, fechaEstimada, puede }: { id: string; estado: Estado; fechaEstimada: string; puede: { confirmar: boolean; rechazar: boolean; despachar: boolean } }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaEstimada);
  const [nota, setNota] = useState("");
  const [modo, setModo] = useState<"" | "RECHAZADO" | "CANCELADO">("");
  const mover = (hacia: Estado, n = nota) => { setError(null); iniciar(async () => { const r = await moverPedidoTienda(id, hacia, n, fecha); if (r.ok) { setModo(""); setNota(""); router.refresh(); } else setError(r.error); }); };
  const Spin = pendiente ? <IconLoader2 size={14} className="animate-spin" aria-hidden /> : null;
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {estado === "ENVIADO" && (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Pedido nuevo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            {puede.confirmar && <>
              <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>Fecha de entrega
                <input className="kp-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </label>
              <button className="btn btn-primary" style={{ height: 34 }} disabled={pendiente} onClick={() => mover("CONFIRMADO")}>{Spin} Confirmar pedido</button>
            </>}
            {puede.rechazar && <button className="btn" style={{ height: 34, color: "var(--danger-text)" }} onClick={() => setModo("RECHAZADO")}>Rechazar…</button>}
          </div>
        </>
      )}
      {estado === "CONFIRMADO" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {puede.despachar && <button className="btn btn-primary" style={{ height: 34 }} disabled={pendiente} onClick={() => mover("EN_CAMINO", "")}>{Spin} Salió a entrega</button>}
        {puede.rechazar && <button className="btn" style={{ height: 34, color: "var(--danger-text)" }} onClick={() => setModo("CANCELADO")}>Cancelar…</button>}
      </div>}
      {estado === "EN_CAMINO" && puede.despachar && <button className="btn btn-primary" style={{ height: 34, alignSelf: "flex-start" }} disabled={pendiente} onClick={() => mover("ENTREGADO", "")}>{Spin} Marcar como entregado</button>}
      {estado === "ENTREGADO" && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Esperando que el cliente confirme la recepción.</div>}
      {["RECIBIDO", "RECHAZADO", "CANCELADO"].includes(estado) && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Pedido cerrado.</div>}
      {modo && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="kp-input" value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder="Motivo (el cliente lo ve)" style={{ flex: 1, minWidth: 240 }} />
          <button className="btn" style={{ height: 34 }} disabled={pendiente} onClick={() => mover(modo)}>Confirmar</button>
          <button className="btn" style={{ height: 34 }} onClick={() => setModo("")}>Volver</button>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</div>}
    </div>
  );
}

export function ResponderResena({ id }: { id: string }) {
  const router = useRouter();
  const [txt, setTxt] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <input className="kp-input" value={txt} onChange={e => setTxt(e.target.value)} maxLength={1000} placeholder="Responder públicamente" style={{ flex: 1, minWidth: 240 }} />
      <button className="btn" style={{ height: 32 }} disabled={pendiente} onClick={() => iniciar(async () => { const r = await responderResena(id, txt); if (r.ok) router.refresh(); else setError(r.error); })}>Responder</button>
      {error && <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
    </div>
  );
}
