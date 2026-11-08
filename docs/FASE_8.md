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

## Próximas partes
- **Parte 2:** Ventas (con baja de animales), balanceado y alimentación (precio por kilo por dieta, kg por matriz), sanidad valorizada, datos de producción, costos de producción, fijos y variables, parámetros.
- **Parte 3:** Presupuesto, presupuesto contra real con causas, proyección de caja, flujo de caja, inversiones, evaluación de nueva inversión, deudas y calendario de cuotas, aportes de capital.
- **Parte 4:** Estado financiero, indicadores (VAN, TIR, payback), análisis del año, tablero completo, controles del libro, cierre de mes, recomendaciones, buenas prácticas e importación de la planilla con el informe contra el Anexo H.
