// Página de inicio pública (Fase 5) — estilo minimalista: tipografía grande,
// mucho aire y un fondo de puntos que reacciona al cursor.
import Link from "next/link";
import type { Metadata } from "next";
import { IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CampoParticulas } from "@/components/inicio/campo-particulas";
import { getUsuario } from "@/lib/auth/config";
import { datosOperador } from "@/lib/legal/documentos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KurPorc · La inteligencia que hace crecer tu granja porcina",
  description: "KurPorc analiza tu granja todos los días y te dice qué hacer: partos, sanidad, alimentación, costos y compras. Para granjas de cualquier tamaño.",
  openGraph: {
    title: "KurPorc · La inteligencia que hace crecer tu granja porcina",
    description: "Del galpón a la decisión, en segundos. Para granjas de cualquier tamaño.",
    url: "https://www.kurporc.com",
    siteName: "KurPorc",
    locale: "es",
    type: "website",
  },
};

const CAPACIDADES = [
  { titulo: "Anticipa", texto: "Partos, celos, destetes, vacunas y el día en que te vas a quedar sin balanceado. Antes de que pase." },
  { titulo: "Ordena", texto: "Cada mañana, cada persona del equipo sabe exactamente qué hacer, con qué cerda y en qué corral." },
  { titulo: "Calcula", texto: "Costo por lechón, conversión, mortalidad y la plata que se pierde con cada cerda parada." },
];

const ESCALA = [
  { cifra: "10", texto: "madres o", },
  { cifra: "10.000", texto: "madres." },
];

const PARA_QUIEN = [
  { tipo: "INDIVIDUAL", titulo: "Mi granja", texto: "La manejo yo y quiero que crezca." },
  { tipo: "EMPRESA", titulo: "Empresa con equipo", texto: "Veterinario, encargados y operarios, cada uno con sus permisos." },
  { tipo: "VENDEDOR", titulo: "Proveedor", texto: "Insumos, genética, equipos o servicios para granjas." },
  { tipo: "COMPRADOR", titulo: "Comprador", texto: "Busco proveedores y precios." },
];

const PREGUNTAS = [
  { p: "¿Cuánto cuesta?", r: "Empezar es gratis. Si en el futuro hay un plan Profesional, se va a avisar con anticipación y el plan gratuito sigue existiendo." },
  { p: "¿Sirve para una granja chica?", r: "Sí. KurPorc está pensado para que una granja de pocas madres trabaje con la misma información que una gran empresa." },
  { p: "¿Mis datos son privados?", r: "Sí. Cada granja ve solo lo suyo, la información es tuya y la podés descargar o borrar cuando quieras." },
  { p: "¿Puedo sumar a mi equipo?", r: "Sí. Cada persona entra con su cuenta y vos elegís qué puede ver y cargar. Los operarios sin correo entran con un usuario que les creás." },
  { p: "¿Funciona en el celular?", r: "Sí. Está pensado para usarse en el galpón, y también se puede registrar por WhatsApp." },
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
  const tareas = ["Diagnóstico de preñez · 4 cerdas", "Vacuna circovirus · lote 12", "Destete · sala 2"];
  return (
    <div role="img" aria-label="Vista previa del tablero de KurPorc" className="ki-tablero">
      <div className="ki-tablero-col">
        <div className="ki-t-tit"><span>Plantel</span><span className="ki-t-sub">{total} madres</span></div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", margin: "10px 0 12px" }}>
          {estados.map(e => <span key={e.etiqueta} style={{ width: `${(e.valor / total) * 100}%`, background: e.color }} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {estados.map(e => (
            <div key={e.etiqueta}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6B6A66" }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: e.color }} />{e.etiqueta}
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#1A1917" }}>{e.valor}</div>
            </div>
          ))}
        </div>
        <div className="ki-t-sub" style={{ margin: "18px 0 6px" }}>Partos por mes</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 70 }}>
          {partos.map((v, i) => <span key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, borderRadius: "3px 3px 0 0", background: i === partos.length - 1 ? "#E9A3A8" : "#E2E0DB" }} />)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"].map(m => <span key={m} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#A8A7A3" }}>{m}</span>)}
        </div>
      </div>
      <div className="ki-tablero-col">
        <div className="ki-t-tit"><span>Hoy</span><span className="ki-t-sub">8 tareas</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {tareas.map((t, i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#1A1917", padding: "8px 10px", border: "0.5px solid #E5E4E0", borderRadius: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "#A31621" : "#C9C7C2", flexShrink: 0 }} />{t}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <div style={{ border: "0.5px solid #E5E4E0", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#6B6A66" }}>Nacidos vivos / parto</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#1A1917" }}>12,7</div>
          </div>
          <div style={{ border: "0.5px solid #E5E4E0", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#6B6A66" }}>Balanceado alcanza</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#1A1917" }}>9 días</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function InicioPage() {
  const [usuario, operador] = await Promise.all([getUsuario(), datosOperador()]);
  const destino = usuario ? "/dashboard" : "/registro";
  const textoCta = usuario ? "Ir a mi panel" : "Empezar gratis";

  return (
    <div className="ki">
      <style>{`
        .ki { min-height: 100vh; background: var(--bg-surface); color: var(--text-primary); }
        .ki a { color: inherit; text-decoration: none; }
        .ki-wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
        .ki-nav { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg-surface) 88%, transparent); backdrop-filter: blur(8px); }
        .ki-nav-in { display: flex; align-items: center; justify-content: space-between; height: 60px; gap: 12px; }
        .ki-nav-der { display: flex; align-items: center; gap: 6px; }
        .ki-link { font-size: 13px; color: var(--text-secondary); padding: 6px 10px; border-radius: 999px; }
        .ki-link:hover { color: var(--text-primary); }
        .ki-oculto-movil { display: none; }
        .ki-btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: 999px; font-size: 14px; font-weight: 500; white-space: nowrap; transition: transform .15s ease; }
        .ki-btn:hover { transform: translateY(-1px); }
        .ki-btn-pri { background: var(--text-primary); color: var(--bg-surface) !important; }
        .ki-btn-sec { border: 0.5px solid var(--border-strong); color: var(--text-primary); }
        .ki-btn-chico { height: 34px; padding: 0 14px; font-size: 13px; }

        .ki-hero { position: relative; overflow: hidden; min-height: calc(100vh - 60px); display: flex; align-items: center; justify-content: center; text-align: center; padding: 48px 0 64px; }
        .ki-hero-in { position: relative; max-width: 900px; padding: 0 20px; animation: ki-entra .9s ease both; }
        .ki-eti { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); border: 0.5px solid var(--border-strong); border-radius: 999px; padding: 5px 12px; margin-bottom: 28px; background: var(--bg-surface); }
        .ki-punto { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
        .ki-h1 { font-size: clamp(40px, 8.4vw, 92px); line-height: 1; letter-spacing: -0.045em; font-weight: 500; margin: 0 0 24px; }
        .ki-h1 em { font-style: normal; color: var(--accent); }
        .ki-lead { font-size: clamp(16px, 2.1vw, 20px); line-height: 1.5; color: var(--text-secondary); max-width: 620px; margin: 0 auto 36px; }
        .ki-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        .ki-sec { padding: clamp(72px, 12vw, 140px) 0; }
        .ki-h2 { font-size: clamp(30px, 5.4vw, 60px); line-height: 1.05; letter-spacing: -0.035em; font-weight: 500; margin: 0 0 18px; max-width: 900px; }
        .ki-h2 span { color: var(--text-muted); }
        .ki-p { font-size: 17px; line-height: 1.6; color: var(--text-secondary); max-width: 560px; margin: 0; }

        .ki-tres { display: grid; gap: 40px; grid-template-columns: 1fr; margin-top: 56px; }
        .ki-cap { border-top: 0.5px solid var(--border-strong); padding-top: 20px; }
        .ki-cap h3 { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 10px; }
        .ki-cap p { font-size: 15px; line-height: 1.6; color: var(--text-secondary); margin: 0; }

        .ki-tablero { display: grid; grid-template-columns: 1fr; gap: 16px; background: #FFFFFF; border: 0.5px solid #E5E4E0; border-radius: 18px; padding: 20px; margin-top: 48px; }
        .ki-tablero-col { min-width: 0; }
        .ki-t-tit { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 500; color: #1A1917; }
        .ki-t-sub { font-size: 11px; color: #6B6A66; font-weight: 400; }

        .ki-escala { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 18px; font-size: clamp(44px, 10vw, 120px); line-height: 1; letter-spacing: -0.05em; font-weight: 500; margin: 0 0 28px; }
        .ki-escala small { font-size: .32em; letter-spacing: -0.02em; color: var(--text-muted); font-weight: 400; }

        .ki-lista { margin-top: 48px; border-top: 0.5px solid var(--border-strong); }
        .ki-fila { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; padding: 22px 0; border-bottom: 0.5px solid var(--border-strong); }
        .ki-fila h3 { font-size: clamp(20px, 3vw, 28px); font-weight: 500; letter-spacing: -0.02em; margin: 0 0 4px; }
        .ki-fila p { font-size: 14px; color: var(--text-secondary); margin: 0; }
        .ki-fila svg { color: var(--text-muted); transition: transform .2s ease, color .2s ease; }
        .ki-fila:hover svg { color: var(--accent); transform: translate(3px, -3px); }

        .ki-faq details { border-bottom: 0.5px solid var(--border-strong); padding: 18px 0; }
        .ki-faq summary { cursor: pointer; font-size: 17px; font-weight: 500; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
        .ki-faq summary::after { content: "+"; color: var(--text-muted); font-weight: 400; }
        .ki-faq details[open] summary::after { content: "–"; }
        .ki-faq p { font-size: 15px; line-height: 1.6; color: var(--text-secondary); margin: 10px 0 0; max-width: 720px; }

        .ki-final { text-align: center; }
        .ki-pie { padding: 32px 0 44px; border-top: 0.5px solid var(--border-default); display: flex; flex-direction: column; gap: 14px; font-size: 12px; color: var(--text-muted); }
        .ki-pie-fila { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .ki-pie-links { display: flex; gap: 18px; flex-wrap: wrap; color: var(--text-secondary); }

        @keyframes ki-entra { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ki-hero-in { animation: none; } .ki-btn, .ki-fila svg { transition: none; } }
        @media (min-width: 720px) {
          .ki-oculto-movil { display: inline-flex; }
          .ki-tres { grid-template-columns: repeat(3, 1fr); }
          .ki-tablero { grid-template-columns: 1.25fr 1fr; gap: 28px; padding: 28px; }
        }
      `}</style>

      <header className="ki-nav">
        <div className="ki-wrap ki-nav-in">
          <Link href="/" aria-label="KurPorc, inicio"><KurPorcLogo size="sm" /></Link>
          <div className="ki-nav-der">
            <a href="#producto" className="ki-link ki-oculto-movil">Producto</a>
            <a href="#para-quien" className="ki-link ki-oculto-movil">Para quién</a>
            <a href="#preguntas" className="ki-link ki-oculto-movil">Preguntas</a>
            <ThemeToggle />
            {!usuario && <Link href="/login" className="ki-link">Ingresar</Link>}
            <Link href={destino} className="ki-btn ki-btn-pri ki-btn-chico">{textoCta}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="ki-hero">
          <CampoParticulas />
          <div className="ki-hero-in">
            <span className="ki-eti"><span className="ki-punto" aria-hidden />Inteligencia para la producción porcina</span>
            <h1 className="ki-h1">El salto que tu granja <em>estaba esperando.</em></h1>
            <p className="ki-lead">
              KurPorc analiza tu granja todos los días y te dice qué hacer, cuándo y cuánto te cuesta.
              Para granjas de cualquier tamaño, en cualquier lugar del mundo.
            </p>
            <div className="ki-ctas">
              <Link href={destino} className="ki-btn ki-btn-pri">{textoCta} <IconArrowRight size={16} aria-hidden /></Link>
              <a href="#producto" className="ki-btn ki-btn-sec">Cómo funciona</a>
            </div>
          </div>
        </section>

        <section id="producto" className="ki-sec">
          <div className="ki-wrap">
            <h2 className="ki-h2">Del galpón a la decisión, <span>en segundos.</span></h2>
            <p className="ki-p">Cada servicio, parto, pesada y vacuna que registrás se convierte en información que trabaja por vos.</p>
            <div className="ki-tres">
              {CAPACIDADES.map(c => (
                <div key={c.titulo} className="ki-cap">
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                </div>
              ))}
            </div>
            <VistaTablero />
          </div>
        </section>

        <section className="ki-sec" style={{ paddingTop: 0 }}>
          <div className="ki-wrap">
            <div className="ki-escala" aria-label="Para granjas de 10 o de 10.000 madres">
              {ESCALA.map(e => <span key={e.cifra}>{e.cifra} <small>{e.texto}</small></span>)}
            </div>
            <p className="ki-p">
              La misma inteligencia, sin importar el tamaño. Una granja chica decide con la información de una gran empresa,
              y una gran empresa ve cada cerda como si fuera la única.
            </p>
          </div>
        </section>

        <section id="para-quien" className="ki-sec" style={{ paddingTop: 0 }}>
          <div className="ki-wrap">
            <h2 className="ki-h2">Una cuenta. <span>Todo tu negocio.</span></h2>
            <div className="ki-lista">
              {PARA_QUIEN.map(p => (
                <Link key={p.tipo} href={`/registro?tipo=${p.tipo}`} className="ki-fila">
                  <div><h3>{p.titulo}</h3><p>{p.texto}</p></div>
                  <IconArrowUpRight size={26} aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="ki-sec" style={{ paddingTop: 0 }}>
          <div className="ki-wrap">
            <h2 className="ki-h2">Tus datos son tuyos. <span>Siempre.</span></h2>
            <p className="ki-p">
              Cada granja ve solo lo suyo. Podés descargar o borrar tu información cuando quieras, y cada acceso del equipo de KurPorc
              queda registrado. <Link href="/privacidad" style={{ color: "var(--text-primary)", textDecoration: "underline" }}>Política de Privacidad</Link>
            </p>
          </div>
        </section>

        <section id="preguntas" className="ki-sec" style={{ paddingTop: 0 }}>
          <div className="ki-wrap ki-faq">
            <h2 className="ki-h2" style={{ marginBottom: 24 }}>Preguntas</h2>
            {PREGUNTAS.map(q => (
              <details key={q.p}>
                <summary>{q.p}</summary>
                <p>{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="ki-sec ki-final" style={{ paddingTop: 0 }}>
          <div className="ki-wrap">
            <h2 className="ki-h2" style={{ margin: "0 auto 28px" }}>Empezá hoy. <span>Es gratis.</span></h2>
            <Link href={destino} className="ki-btn ki-btn-pri">{textoCta} <IconArrowRight size={16} aria-hidden /></Link>
          </div>
        </section>
      </main>

      <footer className="ki-wrap ki-pie">
        <div className="ki-pie-fila">
          <KurPorcLogo size="sm" />
          <div className="ki-pie-links">
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/login">Ingresar</Link>
          </div>
        </div>
        <div>© {new Date().getFullYear()} KurPorc · <a href={`mailto:${operador.correo_contacto}`} style={{ color: "inherit" }}>{operador.correo_contacto}</a></div>
      </footer>
    </div>
  );
}
