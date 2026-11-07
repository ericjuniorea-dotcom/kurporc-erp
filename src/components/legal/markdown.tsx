// Visor de Markdown para los documentos legales (Fase 4).
// Arma elementos de React (nunca HTML crudo), así que el texto no puede inyectar
// scripts aunque se cargue desde la base. Soporta lo que usan los documentos:
// títulos #/##/###, párrafos, listas (- y 1.) con un nivel de anidado, citas (>) y **negrita**.
import { Fragment } from "react";

function enLinea(texto: string, clave: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={`${clave}-${i}`} style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.slice(2, -2)}</strong>
      : <Fragment key={`${clave}-${i}`}>{p}</Fragment>,
  );
}

type Item = { texto: string; hijos: string[]; ordenHijos: boolean };
type Bloque =
  | { tipo: "h"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "p"; texto: string }
  | { tipo: "cita"; texto: string }
  | { tipo: "lista"; ordenada: boolean; items: Item[] };

function analizar(md: string): Bloque[] {
  const bloques: Bloque[] = [];
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  let parrafo: string[] = [];
  const cerrarParrafo = () => { if (parrafo.length) { bloques.push({ tipo: "p", texto: parrafo.join(" ") }); parrafo = []; } };

  for (const linea of lineas) {
    const t = linea.trimEnd();
    if (!t.trim()) { cerrarParrafo(); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) { cerrarParrafo(); bloques.push({ tipo: "h", nivel: h[1].length as 1 | 2 | 3, texto: h[2] }); continue; }

    if (t.startsWith(">")) { cerrarParrafo(); bloques.push({ tipo: "cita", texto: t.replace(/^>\s?/, "") }); continue; }

    const sub = /^\s{2,}(?:[-*]|\d+\.)\s+(.*)$/.exec(t);
    const ultimo = bloques[bloques.length - 1];
    if (sub && ultimo?.tipo === "lista" && ultimo.items.length) {
      const it = ultimo.items[ultimo.items.length - 1];
      it.hijos.push(sub[1]);
      it.ordenHijos = /^\s{2,}\d+\./.test(t);
      continue;
    }

    const item = /^([-*]|\d+\.)\s+(.*)$/.exec(t);
    if (item) {
      cerrarParrafo();
      const ordenada = /\d/.test(item[1]);
      if (ultimo?.tipo === "lista" && ultimo.ordenada === ordenada) ultimo.items.push({ texto: item[2], hijos: [], ordenHijos: false });
      else bloques.push({ tipo: "lista", ordenada, items: [{ texto: item[2], hijos: [], ordenHijos: false }] });
      continue;
    }
    parrafo.push(t.trim());
  }
  cerrarParrafo();
  return bloques;
}

const estilos = {
  h1: { fontSize: 20, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 12px" },
  h2: { fontSize: 15, fontWeight: 500, color: "var(--text-primary)", margin: "22px 0 8px" },
  h3: { fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: "16px 0 6px" },
  p: { fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)", margin: "0 0 10px" },
  lista: { fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)", margin: "0 0 10px", paddingLeft: 22 },
  cita: {
    fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)", margin: "0 0 14px",
    padding: "8px 12px", borderLeft: "2px solid var(--accent)", background: "var(--bg-base)",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
  },
} as const;

export function Markdown({ texto }: { texto: string }) {
  return (
    <div>
      {analizar(texto).map((b, i) => {
        const k = `b${i}`;
        if (b.tipo === "h") {
          const Tag = (`h${b.nivel}`) as "h1" | "h2" | "h3";
          return <Tag key={k} style={estilos[Tag]}>{enLinea(b.texto, k)}</Tag>;
        }
        if (b.tipo === "cita") return <blockquote key={k} style={estilos.cita}>{enLinea(b.texto, k)}</blockquote>;
        if (b.tipo === "p") return <p key={k} style={estilos.p}>{enLinea(b.texto, k)}</p>;
        const Lista = b.ordenada ? "ol" : "ul";
        return (
          <Lista key={k} style={estilos.lista}>
            {b.items.map((it, j) => {
              const SubLista = it.ordenHijos ? "ol" : "ul";
              return (
                <li key={`${k}-${j}`} style={{ marginBottom: 4 }}>
                  {enLinea(it.texto, `${k}-${j}`)}
                  {it.hijos.length > 0 && (
                    <SubLista style={{ paddingLeft: 18, marginTop: 4 }}>
                      {it.hijos.map((h, n) => <li key={`${k}-${j}-${n}`}>{enLinea(h, `${k}-${j}-${n}`)}</li>)}
                    </SubLista>
                  )}
                </li>
              );
            })}
          </Lista>
        );
      })}
    </div>
  );
}
