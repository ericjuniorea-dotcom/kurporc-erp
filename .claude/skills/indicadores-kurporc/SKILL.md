---
name: indicadores-kurporc
description: Reglas para crear o cambiar cualquier indicador (KPI) de KurPorc en cualquier módulo — tarjetas, tablas vs meta, semáforos, mortalidades, análisis. Usalo siempre que agregues, muestres o modifiques un indicador, una meta o un semáforo, en el Dashboard o en Gestación, Maternidad, Iniciación, Engorde, Sanidad y Nutrición, Inventario o Finanzas.
---

# Indicadores de KurPorc

El dueño quiere que **cada indicador se explique solo**: al pasar el mouse (o tocar en el celular) aparece una nube con
**cómo se calcula** y **para qué sirve**, y abajo de cada pantalla con indicadores hay una nota **«Cómo se calcula»**.
Cada usuario prende o apaga la nube en **Configuración → Generales** (columna `users.ayuda_indicadores`).

## Piezas (no dupliques nada de esto)

| Qué | Dónde |
|---|---|
| Catálogo único: nombre, unidad, sentido, meta, fórmula, para qué sirve | `src/lib/indicadores/catalogo.ts` (`INDICADORES`) |
| Semáforo, distancia a la meta, tendencia, formato | `evaluar()`, `tendencia()`, `formatear()` en el mismo catálogo |
| Metas editables (aparecen solas en Configuración → Metas del módulo) | `meta: { modulo, kpiKey, defecto }` del indicador → `METAS_CATALOGO` |
| Nube al pasar el mouse | `<AyudaIndicador clave="…">nombre</AyudaIndicador>` de `src/components/indicadores/ayuda.tsx` |
| Nota al pie | `<ComoSeCalcula claves={[…]} />` del mismo archivo |
| Cálculo de toda la granja (Dashboard) | `src/lib/indicadores/granja.ts` |

## Pasos para cada indicador nuevo

1. **Registralo en `INDICADORES`** con:
   - `nombre` como lo dice el productor ("Mortalidad predestete", no "pre_wean_mort").
   - `grupo`, `unidad`, `decimales`, `sentido` (`"mayor"` = más es mejor, `"menor"` = menos es mejor).
   - `formula`: la cuenta exacta en palabras simples, con qué se divide y qué período toma. Tiene que coincidir con el código.
   - `paraQue`: para qué le sirve al jefe de producción y **qué revisar si se aleja de la meta**.
   - `meta` si se mide contra una meta: `modulo` = `GESTACION | MATERNIDAD | RECRIA | ENGORDE | GENERAL`, `kpiKey` en snake_case y un `defecto` razonable (valores de referencia de granjas tecnificadas). Si ya existe una meta con ese significado en `config_metas`, reutilizá su `kpiKey`.
2. **Calculalo en el servidor** (lib del módulo o `granja.ts`) leyendo la meta de `config_metas` con el defecto del catálogo como respaldo. Si cambiás la cuenta, **cambiá también `formula`**: el texto y el código nunca pueden decir cosas distintas.
3. **Mostralo envuelto** en `<AyudaIndicador clave="…">`. En tarjetas o filas que son links, la nube se abre al tocar el nombre (no navega); dejá un link aparte ("Analizar ›") si la fila lleva a otro lado.
4. **Agregá su clave al `<ComoSeCalcula>`** de esa pantalla (al final, siempre visible).
5. **Semáforo con texto, nunca solo color**: chips `En meta` (verde) · `Atención` (amarillo, a menos del 10%) · `Fuera` (rojo) · `Sin dato` (gris), usando `evaluar()`.
6. **Período**: los indicadores de desempeño se muestran en **últimos 12 meses** (valor oficial) **+ últimos 3 meses** con la flecha de `tendencia()` (verde si mejora, rojo si empeora). No uses 30 días para porcentajes: con pocos partos el número salta.
7. **Verificalo con datos reales** antes de publicar (consulta de solo lectura) y comparalo con lo que el dueño lleva en su Excel; explicá cualquier diferencia.

## Definiciones ya acordadas con el dueño (no cambiar sin preguntarle)

- Mortalidad predestete: camadas destetadas en el período → muertos en lactancia ÷ (nacidos vivos + recibidos − donados).
- Mortalidad en Iniciación / Engorde: muertes del período ÷ animales que entraron a la fase en el período.
- Mortalidad total: 1 − (1 − predestete) × (1 − Iniciación) × (1 − Engorde), de cada 100 nacidos vivos.
- Partos / cerda / año: 365 ÷ (gestación real + lactancia + intervalo destete-servicio). Destetados / cerda / año = eso × destetados por camada.
- Distancia a la meta = valor ÷ meta − 1 (si menos es mejor: meta ÷ valor − 1).

## Estilo

Diseño KurPorc de siempre: tarjetas `var(--bg-surface)` con borde `0.5px var(--border-default)`, tokens de color de
`globals.css` (modo claro y oscuro), números con `font-variant-numeric: tabular-nums`, todo en español con voseo,
y que funcione en el celular (una columna, sin scroll horizontal salvo tablas dentro de su caja).
