# Fase 10 — Cerdas paradas

Cálculo puro en [calculo.ts](../src/lib/cerdas-paradas/calculo.ts); datos y costos del mes en [datos.ts](../src/lib/cerdas-paradas/datos.ts). Migración `20261109000200_fase10_cerdas_paradas`.

| Punto | Implementación |
|---|---|
| Días productivos | Gestando: del servicio al parto (una servida sin resultado cuenta como gestando). Lactando: parto → destete |
| Días parados por causa | Destete → servicio tardío (lo que pasa del objetivo + tolerancia) · repetición · vacía · aborto (del servicio al nuevo servicio o la salida) · nulípara (desde la fecha más tardía entre edad objetivo e ingreso + adaptación) · descarte demorado (destete marcado para descarte → salida) · muerte (fin del último estado productivo → muerte) |
| Retroactivo | Todo sale de los eventos: al cargar una repetición, vacía o aborto, los días desde ese servicio pasan a parados. Un servicio nuevo sin parto del anterior cuenta como repetición |
| Costo del día | Alimento de gestación del mes + (fijos + amortización) ÷ (matrices × días) + lechones/día meta × margen de contribución. Un mes sin gastos cargados usa el último con datos; sin ventas, el costo variable de los 3 meses anteriores o el promedio de los meses con ventas |
| Metas | Configuración (Jefatura de Producción): partos/cerda/año, nacidos vivos, mortalidad máxima, días abiertos. Finanzas → Parámetros: tolerancia, edad y adaptación de la nulípara, plazos de aviso |
| Pantallas | `/finanzas/cerdas-paradas` (con guaraníes) y `/gestacion/cerdas-paradas` (días y acciones; guaraníes solo con `finanzas.cerdas_paradas.ver`): resumen, cerdas paradas hoy con acción sugerida y botón «Crear tarea», pérdida por causa, tendencia mensual, indicadores (DNP por cerda/año, destete-servicio, servidas a tiempo, repetición, partos/cerda/año contra el máximo) e historia de una cerda |
| Conexiones | Tarjeta y semáforo en el tablero financiero · línea «De este costo, gastado en cerdas paradas» en Costos · indicadores en Producción · REC-16 · aviso diario (notificación) al propietario y a quien ve cerdas paradas |
| Pruebas | `npm run prueba:cerdas-paradas`: plantel calculado a mano (a tiempo, tardía, repetición, vacía, aborto, nulípara, descarte, muerte), recálculo retroactivo y el ejemplo de septiembre (Gs 26.005 por día) |

Con los datos reales de KurPorc Granja el día parado da Gs 26.004 (6.404 alimento + 6.574 estructura + 13.026 de margen), igual que el ejemplo del documento.

## Pendiente
- Comparativo entre granjas en el panel de plataforma (va con la Fase 11, parte 2).
- Acción «Hacer ecografía» para servidas sin diagnóstico pasado el plazo (hoy cuentan como gestando).
