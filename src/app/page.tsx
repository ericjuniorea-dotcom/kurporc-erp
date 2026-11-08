// Página de inicio pública (Fase 5).
import Link from "next/link";
import type { Metadata } from "next";
import {
  IconArrowRight, IconBuildingStore, IconBuildingWarehouse, IconCash, IconChartBar, IconChecklist,
  IconClipboardData, IconLock, IconPig, IconShoppingCart, IconTruckDelivery, IconUsers,
} from "@tabler/icons-react";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getUsuario } from "@/lib/auth/config";
import { datosOperador } from "@/lib/legal/documentos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KurPorc · Gestión porcina hecha en Paraguay",
  description: "Producción, finanzas y compras de tu granja porcina en un solo lugar. Gratis para empezar.",
  openGraph: {
    title: "KurPorc · Tu granja porcina, ordenada de punta a punta",
    description: "Plantel, gestación, maternidad, engorde, sanidad, costos y compras. Hecho en Paraguay.",
    url: "https://www.kurporc.com",
    siteName: "KurPorc",
    locale: "es_PY",
    type: "website",
  },
};

const RAMAS = [
  { icono: IconClipboardData, titulo: "Gestión", texto: "Plantel, bandas, gestación, maternidad, destete, engorde, sanidad y alimentación. Cada cerda con su historia.", estado: "" },
  { icono: IconCash, titulo: "Finanzas", texto: "Costo por lechón, flujo de caja, deudas y la plata que se pierde con cada cerda parada.", estado: "En construcción" },
  { icono: IconShoppingCart, titulo: "Compras", texto: "Te avisa lo que te va a faltar según tu stock y tu calendario, y te conecta con proveedores.", estado: "Próximamente" },
];

const PASOS = [
  { n: "1", titulo: "Registrá tu granja", texto: "Con tu cuenta de Google, en dos minutos." },
  { n: "2", titulo: "Cargá plantel y stock", texto: "Tus cerdas, verracos, insumos y vacunas." },
  { n: "3", titulo: "KurPorc calcula", texto: "Fechas de parto, tareas del día, consumos y costos." },
  { n: "4", titulo: "Comprá a tiempo", texto: "Sin quedarte sin balanceado ni vacunas." },
];

const PARA_QUIEN = [
  { tipo: "INDIVIDUAL", icono: IconPig, titulo: "Productor individual", texto: "Manejás tu granja vos y querés tener todo ordenado." },
  { tipo: "EMPRESA", icono: IconBuildingWarehouse, titulo: "Empresa con equipo", texto: "Sumás a tu veterinario y empleados, cada uno con sus permisos." },
  { tipo: "VENDEDOR", icono: IconBuildingStore, titulo: "Vendedor o proveedor", texto: "Ofrecés insumos, genética, equipos o servicios a las granjas." },
  { tipo: "COMPRADOR", icono: IconShoppingCart, titulo: "Solo quiero comprar", texto: "Buscás proveedores y precios sin manejar una granja." },
];

const PREGUNTAS = [
  { p: "¿Cuánto cuesta?", r: "Empezar es gratis. Si más adelante hay un plan Profesional, se va a avisar con anticipación y el plan gratuito sigue existiendo." },
  { p: "¿Mis datos son privados?", r: "Sí. Cada granja ve solo lo suyo. La información de tu granja es tuya y la podés descargar cuando quieras." },
  { p: "¿Quién puede ver mis números?", r: "Las personas que vos sumes a tu equipo, con los permisos que les des. El equipo de KurPorc solo accede para soporte, seguridad o mejoras, y cada acceso queda registrado." },
  { p: "¿Puedo sumar a mi veterinario o a mis empleados?", r: "Sí. Cada uno entra con su cuenta y vos elegís qué puede ver y cargar. Los operarios sin correo pueden entrar con un usuario que les crees." },
  { p: "¿Funciona en el celular?", r: "Sí, está pensado para usarse en el galpón desde el celular. También se puede registrar por WhatsApp." },
  { p: "¿Cómo vendo en el Mercado?", r: "Creá tu cuenta eligiendo \"Vendedor\", cargá el RUC de tu negocio y, cuando verifiquemos tu tienda, vas a poder publicar." },
];

function VistaTablero() {
  const estados = [
    { etiqueta: "Servidas", valor: 14, color: "#F3DE8A" },
    { etiqueta: "Gestantes", valor: 52, color: "#A8DBC2" },
    { etiqueta: "Lactancia", valor: 18, color: "#A9CBEE" },
    { etiqueta: "Vacías", valor: 6, color: "#F0B5B5" },
  ];
  const total = estados.reduce((s, e) => s + e.valor, 0);
  const partos = [9, 12, 8, 14, 11, 13];
  const max = Math.max(...partos);
  return (
    <div aria-label="Vista previa del tablero de KurPorc" role="img" className="kp-landing-tablero">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#1A1917" }}>Plantel reproductivo</span>
        <span style={{ fontSize: 11, color: "#6B6A66" }}>{total} madres</span>
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {estados.map(e => <span key={e.etiqueta} style={{ width: `${(e.valor / total) * 100}%`, background: e.color }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
        {estados.map(e => (
          <div key={e.etiqueta} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6B6A66" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />{e.etiqueta}
            </span>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#1A1917" }}>{e.valor}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#6B6A66", marginBottom: 6 }}>Partos por mes</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
        {partos.map((v, i) => (
          <span key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, background: i === partos.length - 1 ? "#E9A3A8" : "#D9D7D2", borderRadius: "3px 3px 0 0" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"].map(m => <span key={m} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#A8A7A3" }}>{m}</span>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ border: "0.5px solid #E5E4E0", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6B6A66" }}>Nacidos vivos / parto</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1A1917" }}>12,7</div>
        </div>
        <div style={{ border: "0.5px solid #E5E4E0", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6B6A66" }}>Tareas de hoy</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1A1917" }}>8</div>
        </div>
      </div>
    </div>
  );
}

export default async function InicioPage() {
  const [usuario, operador] = await Promise.all([getUsuario(), datosOperador()]);

  return (
    <div className="kp-landing">
      <style>{`
        .kp-landing { min-height: 100vh; background: var(--bg-base); color: var(--text-primary); }
        .kp-landing a { color: inherit; text-decoration: none; }
        .kp-wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }
        .kp-nav { position: sticky; top: 0; z-index: 10; background: var(--bg-base); border-bottom: 0.5px solid var(--border-default); }
        .kp-nav-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 56px; }
        .kp-nav-links { display: none; gap: 20px; font-size: 13px; color: var(--text-secondary); }
        .kp-nav-acciones { display: flex; align-items: center; gap: 8px; }
        .kp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; white-space: nowrap; }
        .kp-btn-pri { background: var(--accent); color: #fff !important; }
        .kp-btn-pri:hover { background: var(--accent-hover); }
        .kp-btn-sec { border: 0.5px solid var(--border-strong); color: var(--text-primary); background: var(--bg-surface); }
        .kp-hero { display: grid; gap: 32px; padding: 40px 0 48px; align-items: center; }
        .kp-hero h1 { font-size: 30px; line-height: 1.15; font-weight: 500; margin: 0 0 14px; letter-spacing: -0.01em; }
        .kp-hero p { font-size: 15px; line-height: 1.55; color: var(--text-secondary); margin: 0 0 22px; max-width: 520px; }
        .kp-hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; }
        .kp-landing-tablero { background: #FFFFFF; border: 0.5px solid #E5E4E0; border-radius: var(--radius-xl); padding: 18px; max-width: 440px; width: 100%; justify-self: center; }
        .kp-sec { padding: 44px 0; border-top: 0.5px solid var(--border-default); }
        .kp-sec h2 { font-size: 22px; font-weight: 500; margin: 0 0 6px; }
        .kp-sec .kp-sub { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; }
        .kp-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
        .kp-card { background: var(--bg-surface); border: 0.5px solid var(--border-default); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 8px; }
        .kp-card h3 { font-size: 15px; font-weight: 500; margin: 0; }
        .kp-card p { font-size: 13px; line-height: 1.5; color: var(--text-secondary); margin: 0; }
        .kp-card-link:hover { border-color: var(--accent); }
        .kp-chip { align-self: flex-start; font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--warning-subtle); color: var(--warning-text); }
        .kp-num { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; background: var(--accent-subtle); color: var(--accent-text); }
        .kp-faq details { background: var(--bg-surface); border: 0.5px solid var(--border-default); border-radius: var(--radius-md); padding: 12px 14px; }
        .kp-faq summary { cursor: pointer; font-size: 14px; font-weight: 500; }
        .kp-faq p { font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin: 8px 0 0; }
        .kp-pie { padding: 28px 0 40px; border-top: 0.5px solid var(--border-default); font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 10px; }
        .kp-pie-links { display: flex; gap: 16px; flex-wrap: wrap; color: var(--text-secondary); }
        @media (min-width: 720px) {
          .kp-nav-links { display: flex; }
          .kp-hero { grid-template-columns: 1.1fr 1fr; padding: 64px 0; }
          .kp-hero h1 { font-size: 42px; }
          .kp-grid-3 { grid-template-columns: repeat(3, 1fr); }
          .kp-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .kp-grid-2 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1000px) { .kp-grid-4 { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      <header className="kp-nav">
        <div className="kp-wrap kp-nav-in">
          <Link href="/" aria-label="KurPorc, inicio"><KurPorcLogo size="sm" /></Link>
          <nav className="kp-nav-links" aria-label="Secciones">
            <a href="#producto">Producto</a>
            <a href="#para-quien">Para quién</a>
            <a href="#precios">Precios</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="kp-nav-acciones">
            <ThemeToggle />
            {usuario ? (
              <Link href="/dashboard" className="kp-btn kp-btn-pri">Ir a mi panel</Link>
            ) : (
              <>
                <Link href="/login" className="kp-btn kp-btn-sec">Ingresar</Link>
                <Link href="/registro" className="kp-btn kp-btn-pri">Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="kp-wrap kp-hero">
          <div>
            <h1>Tu granja porcina, ordenada de punta a punta.</h1>
            <p>Producción, finanzas y compras en un solo lugar. Hecho en Paraguay para granjas de cualquier tamaño.</p>
            <div className="kp-hero-ctas">
              <Link href={usuario ? "/dashboard" : "/registro"} className="kp-btn kp-btn-pri" style={{ height: 42, padding: "0 18px" }}>
                {usuario ? "Ir a mi panel" : "Crear cuenta gratis"} <IconArrowRight size={15} aria-hidden />
              </Link>
              <a href="#producto" className="kp-btn kp-btn-sec" style={{ height: 42, padding: "0 18px" }}>Ver qué hace</a>
            </div>
          </div>
          <VistaTablero />
        </section>

        <section id="producto" className="kp-sec">
          <div className="kp-wrap">
            <h2>Todo lo de tu granja, conectado</h2>
            <p className="kp-sub">Lo que pasa en el galpón se convierte en números que te sirven para decidir.</p>
            <div className="kp-grid kp-grid-3">
              {RAMAS.map(({ icono: Icono, titulo, texto, estado }) => (
                <div key={titulo} className="kp-card">
                  <Icono size={22} aria-hidden style={{ color: "var(--accent)" }} />
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                  {estado && <span className="kp-chip">{estado}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kp-sec">
          <div className="kp-wrap">
            <h2>Cómo funciona</h2>
            <p className="kp-sub">Sin instalar nada. Desde el celular o la computadora.</p>
            <div className="kp-grid kp-grid-4">
              {PASOS.map(p => (
                <div key={p.n} className="kp-card">
                  <span className="kp-num">{p.n}</span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="para-quien" className="kp-sec">
          <div className="kp-wrap">
            <h2>¿Para quién es?</h2>
            <p className="kp-sub">Una sola cuenta: podés manejar tu granja, sumar a tu equipo y comprar o vender.</p>
            <div className="kp-grid kp-grid-4">
              {PARA_QUIEN.map(({ tipo, icono: Icono, titulo, texto }) => (
                <Link key={tipo} href={`/registro?tipo=${tipo}`} className="kp-card kp-card-link">
                  <Icono size={22} aria-hidden style={{ color: "var(--accent)" }} />
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                  <span style={{ marginTop: "auto", fontSize: 12, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Empezar <IconArrowRight size={13} aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="kp-sec">
          <div className="kp-wrap kp-grid kp-grid-2" style={{ alignItems: "start", gap: 24 }}>
            <div>
              <h2>Nació en una granja real</h2>
              <p className="kp-sub" style={{ marginBottom: 0 }}>
                KurPorc se desarrolló operando una granja porcina en Misiones. Cada pantalla resuelve algo que hacía falta en el día a día:
                saber qué cerda pare esta semana, qué vacuna toca, cuánto cuesta producir un lechón y qué hay que comprar antes de que falte.
              </p>
            </div>
            <div className="kp-grid" style={{ gap: 10 }}>
              {[
                { icono: IconChecklist, texto: "Tareas del día generadas solas según los partos, destetes y el protocolo sanitario." },
                { icono: IconChartBar, texto: "Indicadores productivos claros: nacidos vivos, mortalidad, conversión, días no productivos." },
                { icono: IconUsers, texto: "Cada persona del equipo ve y carga solo lo que le corresponde." },
                { icono: IconTruckDelivery, texto: "Stock de balanceado y vacunas con aviso antes de quedarte sin nada." },
              ].map(({ icono: Icono, texto }) => (
                <div key={texto} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <Icono size={18} aria-hidden style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} /> {texto}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kp-sec">
          <div className="kp-wrap">
            <div className="kp-card" style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              <IconLock size={22} aria-hidden style={{ color: "var(--accent)", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <h3>Tus datos son tuyos</h3>
                <p>
                  Guardamos lo que cargás para que puedas trabajar y para mantener la plataforma segura. Cada granja ve solo lo suyo.
                  El equipo de KurPorc puede acceder para soporte, seguridad o mejoras, y cada acceso queda registrado y lo podés ver.
                  Podés descargar o borrar tus datos cuando quieras.
                </p>
                <Link href="/privacidad" style={{ fontSize: 13, color: "var(--accent)" }}>Leer la Política de Privacidad</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="precios" className="kp-sec">
          <div className="kp-wrap">
            <h2>Precios</h2>
            <p className="kp-sub">Empezá sin pagar nada.</p>
            <div className="kp-grid kp-grid-2">
              <div className="kp-card" style={{ borderColor: "var(--accent)" }}>
                <h3>Gratis</h3>
                <div style={{ fontSize: 26, fontWeight: 500 }}>Gs 0</div>
                <p>Gestión productiva completa, equipo con permisos, sanidad, stock y tareas.</p>
                <Link href="/registro" className="kp-btn kp-btn-pri" style={{ alignSelf: "flex-start", marginTop: 6 }}>Crear cuenta gratis</Link>
              </div>
              <div className="kp-card">
                <h3>Profesional</h3>
                <span className="kp-chip">Próximamente</span>
                <p>Finanzas avanzadas, varias granjas y reportes para el contador.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="preguntas" className="kp-sec">
          <div className="kp-wrap kp-faq" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2>Preguntas frecuentes</h2>
            {PREGUNTAS.map(q => (
              <details key={q.p}>
                <summary>{q.p}</summary>
                <p>{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="kp-sec" style={{ textAlign: "center" }}>
          <div className="kp-wrap">
            <h2>Ordená tu granja hoy</h2>
            <p className="kp-sub">Gratis, en dos minutos, con tu cuenta de Google.</p>
            <Link href={usuario ? "/dashboard" : "/registro"} className="kp-btn kp-btn-pri" style={{ height: 42, padding: "0 20px" }}>
              {usuario ? "Ir a mi panel" : "Crear cuenta gratis"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="kp-wrap kp-pie">
        <KurPorcLogo size="sm" />
        <div>
          {operador.razon_social} · RUC {operador.ruc} · {operador.domicilio}, Paraguay · {operador.correo_contacto}
        </div>
        <div className="kp-pie-links">
          <Link href="/terminos">Términos y Condiciones</Link>
          <Link href="/privacidad">Política de Privacidad</Link>
          <Link href="/login">Ingresar</Link>
        </div>
        <div>© {new Date().getFullYear()} KurPorc · Español</div>
      </footer>
    </div>
  );
}
