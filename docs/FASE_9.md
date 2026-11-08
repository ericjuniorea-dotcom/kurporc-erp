# Fase 9 — Engorde

Se respetó el módulo de engorde existente (lotes, pesajes, mortandad, otras salidas, traslados, ventas y cierre) y se completó con lo que pedía el documento. Migración `20261108000900_fase9_engorde`.

| Punto | Implementación |
|---|---|
| Lote | Modalidad propio o integrado (integrador, cómo paga, tarifa), quién pone el alimento, sexo, genética, peso objetivo, curva y lo pagado por los animales |
| Ingreso por compra | Si el lote viene de compra externa con monto, se crea el gasto "Compra de lechones para engorde" (pendiente) en Finanzas |
| Lote cerrado | Ninguna ruta de eventos (pesajes, mortandad, otras salidas, traslados, ventas) acepta cargas en un lote cerrado |
| Carencia | Tratamiento al lote (medicamento, animales, ml, costo) abre la carencia según los días del medicamento; **la venta queda bloqueada** hasta que termine (regla en `registrarVenta`, vale para Engorde y Finanzas) |
| Venta al frigorífico | Por kg vivo, por kg de canal (kg vivo × rendimiento %) o por cabeza; descuentos por tipificación; el flete queda como gasto pendiente en el libro |
| Indicadores ([indicadores.ts](../src/lib/engorde/indicadores.ts)) | Presentes, días ponderados, GDP, conversión alimenticia (incluye el peso de los muertos), conversión económica, mortalidad, kg producidos, salida estimada por curva o por GDP |
| Costo y margen | Animales (lo pagado, el precio de referencia o el costo propio del lechón según Parámetros; 0 si es integrado), alimento (kg del lote × precio por kilo de crecimiento/terminación; 0 si lo pone el integrador), sanidad (tratamientos), estructura (% de los gastos fijos del período, configurable), flete; ingresos por ventas o por la tarifa del integrador; margen, costo por kg producido, por animal, margen por animal y precio de equilibrio por kg vivo |
| Pantallas | `/engorde/lotes/[id]` (detalle), `/engorde/comparativo` (todos los lotes y el ciclo completo: costo del lechón + costo del engorde), `/engorde/curvas` (curvas de crecimiento) |
| Pruebas | `npm run prueba:engorde` (10 controles con el lote de 100 animales calculado a mano); `prueba:ventas` suma carencia, venta por canal, flete y lote cerrado |

## Pendiente
- Sección "Engorde" dentro de Finanzas → Costos y ventas de cerdos terminados en la proyección por calendario.
- Vacío sanitario de corrales y gráfico de peso real contra curva (hoy es una tabla).
- El consumo de alimento por lote sale de los registros de Alimentación con destino al lote (`FeedRecord.growingBatchId`); si no se cargan con ese destino, la conversión queda vacía.
