# Pendientes de las Fases 9 y 10 (completados)

## Fase 10 · "Hacer ecografía"
- `sinDiagnostico(org)` (`src/lib/cerdas-paradas/datos.ts`): cerdas en estado "servida" cuyo último servicio pasó los días de ecografía (Configuración → Gestación → Seguimiento post-servicio, 28 por defecto) y no tienen diagnóstico de preñez de ese servicio (hasta 110 días; más allá es un problema de registro).
- Sección "Servidas sin diagnóstico" en Cerdas paradas (Gestación y Finanzas) con la acción **Hacer ecografía** y el botón para crear la tarea (`diagnostico-prenez`, urgente después de 42 días).
- No suman días parados todavía: si la ecografía da vacía, el cálculo de la Fase 10 los cuenta desde el servicio.

## Fase 9 · Engorde
- **Costos de producción → sección "Engorde"**: cada lote con actividad en el año (abierto, cerrado en el año o ingresado en el año) con presentes, kg producidos, costo total, costo por kg, ingresos, margen y precio de equilibrio, más el total. Mismos números que el detalle del lote. No se suma al costo de la granja de lechones.
- **Gráfico de peso real contra la curva** en el detalle del lote: curva esperada punteada, pesajes reales, línea del peso objetivo; cada punto muestra fecha, real, esperado y diferencia.
- **Vacío sanitario**: Configuración → Engorde → Vacío sanitario (7 días por defecto, se puede desactivar). Al cerrar un lote con sitio se crea la tarea "Vacío sanitario · sitio" y no se acepta otro lote en ese sitio (comparación sin acentos ni mayúsculas) hasta cumplir los días.
- **Proyección por calendario de bandas**: Finanzas → Parámetros → "Ventas de la proyección de caja" = Por calendario. Lechones: de cada cerda servida, gestante o en lactancia, venta al destete (servicio + gestación + lactancia) × lechones por parto (nacidos vivos promedio × (1 − mortalidad)) × precio esperado. Cerdos terminados: lotes propios abiertos en el mes en que la curva llega al peso objetivo, presentes × peso objetivo × precio del kg vivo (los integrados los paga el integrador). Después del último destete conocido se suma el parámetro de lechones por mes.
