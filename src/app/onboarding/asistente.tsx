"use client";
// Asistente de primeros pasos (Fase 6): tipo → tus datos → tu granja / empresa / tienda.
import { useMemo, useState, useTransition } from "react";
import { IconArrowLeft, IconBuildingStore, IconBuildingWarehouse, IconKey, IconLoader2, IconPig, IconShoppingCart } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { crearMiOrganizacion, guardarDatosPersonales, pedirUnirme, terminarComoComprador } from "@/app/acciones/onboarding";
import { CATEGORIAS_VENTA, DEPARTAMENTOS, SISTEMAS_PRODUCTIVOS } from "@/lib/validaciones/paraguay";

type Tipo = "COMPRADOR" | "INDIVIDUAL" | "EMPRESA" | "VENDEDOR";
type Opcion = Tipo | "UNIRME";
type Paso = "tipo" | "datos" | "organizacion" | "unirme";

const OPCIONES: { valor: Opcion; titulo: string; texto: string; icono: typeof IconPig }[] = [
  { valor: "INDIVIDUAL", titulo: "Mi granja", texto: "La manejo yo", icono: IconPig },
  { valor: "EMPRESA", titulo: "Empresa con equipo", texto: "Con veterinario y empleados", icono: IconBuildingWarehouse },
  { valor: "VENDEDOR", titulo: "Quiero vender", texto: "Abrir una tienda en el Mercado", icono: IconBuildingStore },
  { valor: "COMPRADOR", titulo: "Solo comprar", texto: "Buscar proveedores", icono: IconShoppingCart },
  { valor: "UNIRME", titulo: "Tengo un código de empresa", texto: "Unirme a una granja que ya usa KurPorc", icono: IconKey },
];

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };
const ayuda: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", marginTop: 4 };

function nuevaClave() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function Asistente({ tipoInicial, perfil, acuerdos }: {
  tipoInicial: Tipo | null;
  perfil: { nombre: string; telefono: string; departamento: string; distrito: string };
  acuerdos: { organizacion: { hash: string; titulo: string } | null; vendedor: { hash: string; titulo: string } | null };
}) {
  const [opcion, setOpcion] = useState<Opcion | null>(tipoInicial);
  const [paso, setPaso] = useState<Paso>(tipoInicial ? "datos" : "tipo");
  const [departamento, setDepartamento] = useState(perfil.departamento);
  const [aceptaAcuerdo, setAceptaAcuerdo] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  // Una clave por intento: si se reenvía el formulario no se duplica la organización
  const claveCreacion = useMemo(nuevaClave, []);

  const tipo = opcion === "UNIRME" ? null : opcion;
  const acuerdo = tipo === "VENDEDOR" ? acuerdos.vendedor : acuerdos.organizacion;
  const total = opcion === "COMPRADOR" ? 2 : 3;
  const numero = paso === "tipo" ? 1 : paso === "datos" ? 2 : 3;

  function elegir(o: Opcion) {
    setOpcion(o); setError(null);
    setPaso(o === "UNIRME" ? "unirme" : "datos");
  }

  function guardarDatos(f: FormData) {
    setError(null);
    iniciar(async () => {
      const r = await guardarDatosPersonales({
        nombre: String(f.get("nombre") ?? ""), telefono: String(f.get("telefono") ?? ""),
        departamento: String(f.get("departamento") ?? ""), distrito: String(f.get("distrito") ?? ""),
      });
      if (!r.ok) { setError(r.error); return; }
      if (opcion === "COMPRADOR") {
        const t = await terminarComoComprador();
        if (t.ok) window.location.href = t.destino ?? "/"; else setError(t.error);
        return;
      }
      setPaso("organizacion");
    });
  }

  function crear(f: FormData) {
    if (!tipo || !acuerdo) return;
    setError(null);
    iniciar(async () => {
      const madres = String(f.get("madresAprox") ?? "");
      const r = await crearMiOrganizacion({
        tipo: tipo as "INDIVIDUAL" | "EMPRESA" | "VENDEDOR",
        nombre: String(f.get("nombre") ?? ""),
        razonSocial: String(f.get("razonSocial") ?? ""),
        ruc: String(f.get("ruc") ?? ""),
        departamento: String(f.get("departamento") ?? ""),
        distrito: String(f.get("distrito") ?? ""),
        whatsapp: String(f.get("whatsapp") ?? ""),
        nombreGranja: String(f.get("nombreGranja") ?? ""),
        madresAprox: madres ? Number(madres) : undefined,
        sistemaProductivo: (String(f.get("sistemaProductivo") ?? "") || undefined) as "CICLO_COMPLETO" | undefined,
        categoriasVenta: categorias, zonasEntrega: zonas,
        aceptaAcuerdo: aceptaAcuerdo as true, hashAcuerdo: acuerdo.hash, claveCreacion,
      });
      if (r.ok) window.location.href = r.destino ?? "/dashboard"; else setError(r.error);
    });
  }

  function unirme(f: FormData) {
    setError(null);
    iniciar(async () => {
      const r = await pedirUnirme({ codigo: String(f.get("codigo") ?? ""), mensaje: String(f.get("mensaje") ?? "") });
      if (r.ok) window.location.href = r.destino ?? "/"; else setError(r.error);
    });
  }

  const alternar = (lista: string[], set: (v: string[]) => void, v: string) => set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {paso !== "unirme" && (
        <div aria-label={`Paso ${numero} de ${total}`} style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < numero ? "var(--accent)" : "var(--border-default)" }} />
          ))}
        </div>
      )}
      {paso !== "tipo" && (
        <button type="button" onClick={() => { setError(null); setPaso(paso === "organizacion" ? "datos" : "tipo"); }}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <IconArrowLeft size={13} aria-hidden /> Volver
        </button>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {paso === "tipo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {OPCIONES.map(({ valor, titulo, texto, icono: Icono }) => (
            <button key={valor} type="button" onClick={() => elegir(valor)}
              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px", cursor: "pointer",
                background: "var(--bg-base)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
              <Icono size={18} aria-hidden style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{texto}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {paso === "datos" && (
        <form action={guardarDatos} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Tus datos</div>
          <div><label className="kp-label" htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" name="nombre" defaultValue={perfil.nombre} required maxLength={120} className="kp-input" /></div>
          <div><label className="kp-label" htmlFor="telefono">WhatsApp</label>
            <input id="telefono" name="telefono" defaultValue={perfil.telefono} placeholder="+595 981 123456" maxLength={20} inputMode="tel" className="kp-input" /></div>
          <div style={grid2}>
            <div><label className="kp-label" htmlFor="departamento">Departamento</label>
              <select id="departamento" name="departamento" required value={departamento} onChange={e => setDepartamento(e.target.value)} className="kp-input">
                <option value="" disabled>Elegí</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label className="kp-label" htmlFor="distrito">Distrito</label>
              <input id="distrito" name="distrito" defaultValue={perfil.distrito} maxLength={80} className="kp-input" /></div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ width: "100%", height: 40, justifyContent: "center" }}>
            {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : opcion === "COMPRADOR" ? "Terminar" : "Siguiente"}
          </button>
        </form>
      )}

      {paso === "organizacion" && tipo && tipo !== "COMPRADOR" && (
        <form action={crear} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {tipo === "VENDEDOR" ? "Tu tienda" : tipo === "EMPRESA" ? "Tu empresa" : "Tu granja"}
          </div>
          <div><label className="kp-label" htmlFor="org-nombre">{tipo === "VENDEDOR" ? "Nombre de la tienda" : tipo === "EMPRESA" ? "Nombre comercial" : "Nombre de la granja"}</label>
            <input id="org-nombre" name="nombre" required maxLength={80} className="kp-input" /></div>

          {tipo !== "INDIVIDUAL" && (
            <div style={grid2}>
              <div><label className="kp-label" htmlFor="razonSocial">Razón social{tipo === "VENDEDOR" ? "" : " (opcional)"}</label>
                <input id="razonSocial" name="razonSocial" required={tipo === "VENDEDOR"} maxLength={120} className="kp-input" /></div>
              <div><label className="kp-label" htmlFor="ruc">RUC{tipo === "VENDEDOR" ? "" : " (opcional)"}</label>
                <input id="ruc" name="ruc" required={tipo === "VENDEDOR"} placeholder="1234567-8" maxLength={15} className="kp-input" /></div>
            </div>
          )}

          {tipo === "EMPRESA" && (
            <div><label className="kp-label" htmlFor="nombreGranja">Nombre de la primera granja</label>
              <input id="nombreGranja" name="nombreGranja" maxLength={80} placeholder="Ej. Granja Misiones" className="kp-input" />
              <div style={ayuda}>Si la dejás vacía, usamos el nombre de la empresa. Después podés agregar más granjas.</div></div>
          )}

          <div style={grid2}>
            <div><label className="kp-label" htmlFor="org-departamento">Departamento</label>
              <select id="org-departamento" name="departamento" required defaultValue={departamento} className="kp-input">
                <option value="" disabled>Elegí</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label className="kp-label" htmlFor="org-distrito">Distrito</label>
              <input id="org-distrito" name="distrito" maxLength={80} className="kp-input" /></div>
          </div>

          {tipo !== "VENDEDOR" ? (
            <div style={grid2}>
              <div><label className="kp-label" htmlFor="madresAprox">Madres (aprox.)</label>
                <input id="madresAprox" name="madresAprox" type="number" min={0} max={100000} inputMode="numeric" className="kp-input" /></div>
              <div><label className="kp-label" htmlFor="sistemaProductivo">Sistema</label>
                <select id="sistemaProductivo" name="sistemaProductivo" defaultValue="" className="kp-input">
                  <option value="">—</option>
                  {SISTEMAS_PRODUCTIVOS.map(s => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
                </select></div>
            </div>
          ) : (
            <>
              <div><label className="kp-label" htmlFor="whatsapp">WhatsApp de ventas</label>
                <input id="whatsapp" name="whatsapp" placeholder="+595 981 123456" maxLength={20} inputMode="tel" className="kp-input" /></div>
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend className="kp-label">Qué vendés</legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIAS_VENTA.map(c => (
                    <button key={c} type="button" onClick={() => alternar(categorias, setCategorias, c)} aria-pressed={categorias.includes(c)}
                      style={{ fontSize: 11, padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                        border: `0.5px solid ${categorias.includes(c) ? "var(--accent)" : "var(--border-default)"}`,
                        background: categorias.includes(c) ? "var(--accent)" : "transparent", color: categorias.includes(c) ? "#fff" : "var(--text-secondary)" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend className="kp-label">Dónde entregás</legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {DEPARTAMENTOS.map(d => (
                    <button key={d} type="button" onClick={() => alternar(zonas, setZonas, d)} aria-pressed={zonas.includes(d)}
                      style={{ fontSize: 11, padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                        border: `0.5px solid ${zonas.includes(d) ? "var(--accent)" : "var(--border-default)"}`,
                        background: zonas.includes(d) ? "var(--accent)" : "transparent", color: zonas.includes(d) ? "#fff" : "var(--text-secondary)" }}>
                      {d}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div style={ayuda}>Tu tienda queda en revisión hasta que verifiquemos el RUC. Mientras tanto podés ir preparándola.</div>
            </>
          )}

          {acuerdo && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={aceptaAcuerdo} onChange={e => setAceptaAcuerdo(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }} />
              <span>
                Puedo representar a esta {tipo === "VENDEDOR" ? "tienda" : "organización"} y acepto, en su nombre, las{" "}
                <a href={tipo === "VENDEDOR" ? "/legal/terminos-vendedor" : "/legal/acuerdo-organizacion"} target="_blank" rel="noopener"
                  style={{ color: "var(--text-primary)", textDecoration: "underline" }}>{acuerdo.titulo}</a>.
              </span>
            </label>
          )}

          <button type="submit" className="btn btn-primary" disabled={pendiente || !aceptaAcuerdo || !acuerdo} style={{ width: "100%", height: 40, justifyContent: "center" }}>
            {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : tipo === "VENDEDOR" ? "Crear mi tienda" : "Empezar a usar KurPorc"}
          </button>
        </form>
      )}

      {paso === "unirme" && (
        <form action={unirme} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Unirme a una empresa</div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Pedile el código de empresa al Administrador General. Cuando apruebe tu pedido, vas a poder entrar con los permisos que te asigne.
          </p>
          <div><label className="kp-label" htmlFor="codigo">Código de empresa</label>
            <input id="codigo" name="codigo" required maxLength={12} autoCapitalize="characters" className="kp-input" style={{ textTransform: "uppercase" }} /></div>
          <div><label className="kp-label" htmlFor="mensaje">Mensaje (opcional)</label>
            <input id="mensaje" name="mensaje" maxLength={500} placeholder="Ej. Soy el nuevo encargado de maternidad" className="kp-input" /></div>
          <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ width: "100%", height: 40, justifyContent: "center" }}>
            {pendiente ? <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> : "Enviar pedido"}
          </button>
        </form>
      )}
    </div>
  );
}
