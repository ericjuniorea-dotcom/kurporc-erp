---
name: numeros-kurporc
description: Regla obligatoria de KurPorc para todo número que se escribe o se muestra — separadores de miles con punto y decimales con coma (2.290.000 · 1.250,5). Usalo SIEMPRE que agregues o cambies una casilla para cargar números (montos, kg, cantidades, precios, dosis, pesos) o cualquier pantalla que muestre números, en cualquier módulo.
---

# Números en KurPorc: siempre con separador de miles

El dueño lo pidió como regla fija: **todo número que se carga o se muestra lleva separador de miles**.
Formato de Paraguay: punto para miles y coma para decimales → `2.290.000`, `1.250,5 kg`, `₲ 435.000`.

## Para CARGAR números (casillas)

Usá siempre `<InputNumero>` de `src/components/ui/input-numero.tsx`. **Nunca** `<input type="number">` ni
`<input inputMode="numeric|decimal">` sueltos.

```tsx
import { InputNumero } from "@/components/ui/input-numero";

<InputNumero className="kp-input" inputMode="numeric" value={monto} onChange={e => setMonto(e.target.value)} />      // enteros (₲, cantidades)
<InputNumero className="kp-input" inputMode="decimal" value={kg} onChange={e => setKg(e.target.value)} />            // con decimales (kg, ml)
<InputNumero className="kp-input" min={0} {...register("bornAlive")} />                                             // react-hook-form
<InputNumero className="kp-input" name="madres" defaultValue={10} />                                                 // formulario que se envía solo
```

- Mientras se escribe muestra `2.290.000`; el programa recibe en `e.target.value` el número **limpio** (`"2290000"`, `"1250.5"`).
  Las cuentas y validaciones existentes siguen funcionando igual que con `type="number"`.
- `inputMode="numeric"` o un `step` entero = solo enteros. Si no, acepta decimales con coma (en el celular el «.» del teclado decimal se toma como coma).
- En formularios que se envían solos (`name` + acción del servidor / `new FormData`), el servidor recibe el número limpio.
- **No usar** `InputNumero` para lo que no es una cantidad: códigos de verificación, teléfonos, cédula/RUC, caravanas,
  tatuajes, números de factura, años. Esos van como `<input>` de texto normal.

## Para MOSTRAR números

- Siempre con `toLocaleString("es-PY", …)` o los ayudantes ya existentes: `gs()` de `src/lib/finanzas/calculos` para guaraníes,
  `formatear()` de `src/lib/indicadores/catalogo` para indicadores, `formatearNumero()` de `input-numero`.
- Nunca `String(n)`, `n.toFixed()` ni plantillas `${n}` para un número que ve el usuario (salvo años y códigos).
- Montos: `₲ 2.290.000`. Kilos: `1.250,5 kg`. Porcentajes: `13,3%`.

## Al terminar un cambio

Buscá que no quede ninguna casilla numérica suelta:
`grep -rnE 'type="number"|inputMode="(numeric|decimal)"' src --include=*.tsx | grep -v InputNumero` → solo pueden quedar códigos/teléfonos.
