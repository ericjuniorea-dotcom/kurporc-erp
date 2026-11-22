"use client";
// Casilla de número de KurPorc: muestra separadores de miles mientras se escribe (2.290.000 · 1.250,5) y le pasa al
// programa el número limpio (2290000 · 1250.5), así las cuentas no cambian. Reemplaza a <input type="number"> y a
// <input inputMode="numeric|decimal"> en todo el programa (ver .claude/skills/numeros-kurporc).
import { forwardRef, useEffect, useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Permite decimales (coma). Por defecto sí, salvo inputMode="numeric" o step entero. */
  decimales?: boolean;
};

/** "2290000" → "2.290.000" · "1250.5" → "1.250,5" · "12." → "12," (mientras se escribe). */
export function formatearNumero(raw: string, decimales: boolean): string {
  if (raw === "" || raw === "-") return raw;
  const negativo = raw.startsWith("-");
  const [ent, dec] = raw.replace(/^-/, "").split(".");
  const entero = (ent ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const parteDec = decimales && dec !== undefined ? `,${dec.replace(/\D/g, "")}` : "";
  return `${negativo ? "-" : ""}${conPuntos}${parteDec}`;
}

/** Lo que se ve → número limpio: los puntos son miles y la coma es el decimal. */
function limpiar(texto: string, decimales: boolean, permiteNegativo: boolean): string {
  const negativo = permiteNegativo && texto.trim().startsWith("-");
  let t = texto.replace(/[^\d,]/g, "");
  if (!decimales) t = t.replace(/,/g, "");
  const i = t.indexOf(",");
  if (i >= 0) t = `${t.slice(0, i)}.${t.slice(i + 1).replace(/,/g, "")}`;
  return `${negativo ? "-" : ""}${t}`;
}

export const InputNumero = forwardRef<HTMLInputElement, Props>(function InputNumero({ value, defaultValue, onChange, decimales, inputMode, step, min, name, ...resto }, ref) {
  // Decimales: salvo que la casilla sea de enteros (inputMode="numeric" o un step entero), o si el valor ya trae decimales
  const pasoEntero = step !== undefined && String(step) !== "any" && Number(step) % 1 === 0;
  const conDecimales = decimales ?? (inputMode === "decimal" || (inputMode !== "numeric" && !pasoEntero) || /./.test(String(value ?? defaultValue ?? "")));
  const permiteNegativo = min !== undefined && Number(min) < 0;
  const interno = useRef<HTMLInputElement | null>(null);
  // Controlada (value) o libre (defaultValue / react-hook-form): en la libre se formatea directo en la casilla
  const controlada = value !== undefined;
  const [rawLibre, setRawLibre] = useState(() => (defaultValue === undefined || defaultValue === null ? "" : String(defaultValue)));
  const raw = controlada ? (value === null ? "" : String(value)) : rawLibre;
  const visible = formatearNumero(raw, conDecimales);
  const rawActual = useRef(raw);
  rawActual.current = raw;

  // Formularios que se envían solos (o new FormData(form)): el servidor recibe el número limpio, no «2.290.000»
  useEffect(() => {
    const form = interno.current?.form;
    if (!form || !name) return;
    const alArmar = (e: FormDataEvent) => { e.formData.set(name, rawActual.current); };
    form.addEventListener("formdata", alArmar);
    return () => form.removeEventListener("formdata", alArmar);
  }, [name]);

  const cambiar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    let texto = el.value;
    // En el celular el teclado decimal a veces trae «.»: si se agregó un punto y todavía no hay coma, es la coma decimal
    if (conDecimales && !texto.includes(",") && (texto.match(/\./g) ?? []).length > (visible.match(/\./g) ?? []).length) {
      const pos = (el.selectionStart ?? texto.length) - 1;
      if (texto[pos] === ".") texto = `${texto.slice(0, pos)},${texto.slice(pos + 1)}`;
    }
    const nuevo = limpiar(texto, conDecimales, permiteNegativo);
    if (!controlada) { el.value = formatearNumero(nuevo, conDecimales); setRawLibre(nuevo); }
    // Mantener el cursor después del mismo dígito
    const digitosAntes = texto.slice(0, el.selectionStart ?? texto.length).replace(/[^\d,]/g, "").length;
    requestAnimationFrame(() => {
      const inp = interno.current;
      if (!inp || document.activeElement !== inp) return;
      let n = 0, pos = 0;
      while (pos < inp.value.length && n < digitosAntes) { if (/[\d,]/.test(inp.value[pos])) n++; pos++; }
      inp.setSelectionRange(pos, pos);
    });
    if (!onChange) return;
    // El programa recibe el número limpio en e.target.value (igual que antes con type="number")
    const destino = new Proxy(el, {
      get(t, k) {
        if (k === "value") return nuevo;
        if (k === "valueAsNumber") return nuevo === "" ? NaN : Number(nuevo);
        const v = Reflect.get(t, k);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    onChange(Object.assign(Object.create(e), { target: destino, currentTarget: destino }) as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <>
    <input
      {...resto}
      name={name}
      ref={el => { interno.current = el; if (typeof ref === "function") ref(el); else if (ref) ref.current = el; }}
      type="text"
      inputMode={conDecimales ? "decimal" : "numeric"}
      autoComplete={resto.autoComplete ?? "off"}
      {...(controlada ? { value: visible } : { defaultValue: visible })}
      onChange={cambiar}
    />
    </>
  );
});
