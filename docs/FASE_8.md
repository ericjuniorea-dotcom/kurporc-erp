# Fase 8 — Finanzas

Réplica de la planilla de Administración y Finanzas, por partes. Sin fábrica de balanceado (decisión 16): el balanceado es una compra a proveedores.

## Parte 1 — Base, libro, caja y cuentas (hecha en código; migración `20261108000500_fase8_finanzas`)

| Punto | Implementación |
|---|---|
| Modelos | Todos los de 8.1 menos `TransferenciaBalanceado`: cuentas de fondos, categorías, contrapartes, movimientos, pagos, ventas, préstamos y cuotas, presupuesto, aportes previstos, evaluación de inversión, parámetros, cierre de mes, saldos declarados, causas de desvío, recomendaciones y copia de filas importadas. Así las partes siguientes no necesitan otra migración grande |
| Reglas en la base | Trigger `completar_movimiento`: mes, naturaleza, área, signo y precio unitario salen de la categoría; valida que la categoría sea de la organización y del tipo. Ningún movimiento ni pago se borra (solo en cascada si se elimina la organización). Un anulado no se toca. Los pagos no superan el saldo y recalculan el estado (pendiente → pagado, por cobrar → cobrado). Un mes cerrado no acepta altas, cambios ni pagos |
| Seguridad | RLS en las 17 tablas, sin permisos para las API de Supabase, historial de cambios con actor, montos en `bigint` |
| Catálogo | 45 categorías del sistema (las 41 de la hoja LISTAS + venta de cerdos terminados, compra de lechones para engorde, balanceado de crecimiento y de terminación) |
| `/finanzas` | Tablero inicial: caja + bancos, resultado del mes y del año, flujo real del año, por pagar y por cobrar con vencidos, inversión del año, "¿en qué se va la plata?" por grupo |
| `/finanzas/movimientos` | Libro por mes con filtros y totales; carga rápida en el orden de la planilla; sanidad pide producto y ml por unidad; aviso de precio atípico (±20 % del promedio de 3 meses); pagar/cobrar total o parcial; anular con motivo (auditado) |
| `/finanzas/caja-bancos` | Cuentas con saldo calculado (inicial + cobros − pagos), número cifrado (completo solo con `ver_numero`), declarar saldo y diferencia a conciliar, archivar |
| `/finanzas/pagar` y `/cobrar` | Vista sobre los movimientos con saldo: estado, tramo, mes de pago, resumen por tramo, registrar pago o cobro. Límite de aprobación de pagos configurable |
| Pruebas | `supabase/tests/fase8_finanzas.sql` (9 controles) y `npm run prueba:finanzas` (25 controles), en la CI |

## Parte 2 — Ventas y hojas de costos (hecha, sin cambios en la base)

| Punto | Implementación |
|---|---|
| `/finanzas/ventas` | Una venta crea, en la misma transacción, el ingreso en el libro (origen VENTA, cobrado o por cobrar), la salida del lote y la baja de los animales ([ventas.ts](../src/lib/finanzas/ventas.ts)). Peso promedio, importe y valor por animal automáticos. Control: ventas = ingresos por ventas del libro. Anular devuelve los animales al lote |
| Engorde | La venta de cerdos terminados (`/api/engorde/ventas`) genera también su ingreso en Finanzas: se carga una sola vez |
| `/finanzas/produccion` | Mes a mes desde los módulos: servicios, partos, nacidos, destetados, muertes, entregados, kg, mortalidad, por parto, peso de salida; stock de hoy |
| `/finanzas/alimentacion` | Precio por kilo por dieta (un mes sin compras repite el anterior), kilos y guaraníes por dieta, indicadores por matriz, por destetado, por entregado y por kg. Sin fábrica: el alimento entra por lo comprado en el mes |
| `/finanzas/sanidad` | Por producto: comprado, precio por ml (pagado o de lista), usado (aplicaciones de Sanidad), costo de lo usado, stock y estado. Mes a mes compras contra uso |
| `/finanzas/costos` | Alimentación, directos, estructura, amortización (por activo o como la planilla), costo total, costo por lechón entregado, por kg, por matriz, por destetado, margen, participación del alimento. Sanidad por uso o por compra |
| `/finanzas/fijos-variables` | Fijos, variables, % y acumulado; detalle por categoría con promedio mensual hasta el corte |
| `/finanzas/parametros` | Metas y supuestos editables (precios, caja, desvíos, amortización, sanidad, IPS, VAN, límite de aprobación, matrices fijas) |
| Pruebas | `prueba:finanzas` suma 12 controles de las hojas; `prueba:ventas` (8 controles), en la CI |

Pendiente de esta parte: conteo físico de sanidad (hoy el stock es el teórico de los lotes), matrices activas promedio por mes (hoy se usan las activas de hoy o el número fijo de Parámetros) y gráficos.

## Parte 3 — Planificación (hecha, sin cambios en la base)

| Punto | Implementación |
|---|---|
| `/finanzas/presupuesto` | Grilla categoría × mes con subtotales de gasto operativo e inversión, acumulado al corte; "= todos", copiar el año anterior, promedio real de 6 meses, cargas sociales (aguinaldo + IPS sobre los sueldos presupuestados) |
| `/finanzas/presupuesto-vs-real` | Acumulado y mes: diferencia, desvío y semáforo (OK / Atención / Explicar según Parámetros) y la causa escrita al lado del número |
| `/finanzas/proyeccion` | 15 meses: ventas (parámetros), otros ingresos, aportes previstos, gasto e inversión presupuestados, cuotas, cuentas por pagar por mes de pago; saldo, meses cubiertos, alerta y las preguntas (cuánto necesito, en qué mes me quedo sin caja, capital de trabajo). Aportes previstos editables |
| `/finanzas/flujo-caja` | Real (por fecha de pago, desde los saldos iniciales) + proyectado; flujo neto, saldo, acumulado del año, cobertura de caja en días |
| `/finanzas/inversiones` | Histórica y nueva por categoría y detalle, granja y común, inversión por matriz, fichas de activo con amortización acumulada y valor neto |
| `/finanzas/nueva-inversion` | Cuota (simple o francesa), "¿entra en la caja?" con la corrección respecto de la planilla (y el valor de la planilla al lado); aprobar → presupuesto, ejecutar → libro |
| `/finanzas/deudas` | Préstamos con cuotas pagadas, atrasadas, saldo, costo financiero, tasa mensual y anual implícitas (como RATE), próximo pago; calendario de 12 meses; resumen; ranking para refinanciar. Cada cuota que vence genera sola su movimiento (pagado si es débito automático) |
| Pruebas | `prueba:finanzas` suma 10 controles de planificación (tasa implícita, cuota francesa, vencimientos, semáforo, proyección, flujo, cobertura) |

Pendiente: proyección de ventas por calendario de bandas (hoy, por parámetro), gráficos.

## Parte 4a — Control y análisis (hecha, sin cambios en la base)

| Punto | Implementación |
|---|---|
| Menú | Agrupado en Día a día · Análisis · Planificación · Control |
| `/finanzas` | Tablero con semáforo (cobertura, caja disponible, margen, vencidos, mes sin caja, dinero que necesito, Sanidad al día, controles), el mes que viene y aviso de controles que no dan cero |
| `/finanzas/estado` | Activos, obligaciones, posición neta, caja realmente disponible, resultado del año, inversiones y conciliación "¿de dónde salió la plata?" con la diferencia a conciliar |
| `/finanzas/indicadores` | Operación, producción y margen (con punto de equilibrio), caja/deuda/liquidez y retorno (ROI, VAN, TIR, payback), cada uno con cómo se calcula, meta y estado |
| `/finanzas/analisis` | El año mes a mes y la distribución del gasto por categoría |
| `/finanzas/cierre` | Los 11 controles del libro ([control.ts](../src/lib/finanzas/control.ts)) y el checklist de cierre; al cerrar: bloqueo del mes (lo exige la base), foto de los indicadores, recomendaciones, aviso al equipo y auditoría. Reabrir con motivo |
| `/finanzas/recomendaciones` | Reglas REC-01, 02, 03, 05, 06, 07, 08, 09, 11, 12 y 14 con los números del momento; estados abierta, en curso, resuelta, descartada |
| `/finanzas/buenas-practicas` | Las prácticas, sin cifras de terceros (el documento pide verificarlas antes de mostrarlas) |
| Pruebas | `prueba:finanzas` suma VAN, TIR, payback, flujos del retorno y punto de equilibrio |

Sin fábrica no aplican los controles 3 y 4 ni REC-13 y REC-15. REC-04 (inventario físico) y REC-10 (desvío de tres meses seguidos) quedan para cuando haya conteo físico e historial de presupuesto.

## Próximas partes
- **Parte 4b:** importación de la planilla de Administración y Finanzas y el informe de validación contra el Anexo H.
