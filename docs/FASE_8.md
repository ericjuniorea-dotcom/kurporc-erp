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

## Próximas partes
- **Parte 3:** Presupuesto, presupuesto contra real con causas, proyección de caja, flujo de caja, inversiones, evaluación de nueva inversión, deudas y calendario de cuotas, aportes de capital.
- **Parte 4:** Estado financiero, indicadores (VAN, TIR, payback), análisis del año, tablero completo, controles del libro, cierre de mes, recomendaciones, buenas prácticas e importación de la planilla con el informe contra el Anexo H.
