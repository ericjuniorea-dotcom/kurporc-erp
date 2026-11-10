# Fase 13 — Cotizaciones, pedidos y recepción en stock

## Base de datos (`20261110000200_fase13_pedidos`)
- `solicitud_cotizacion` (+ `_item`, `_tienda`), `respuesta_cotizacion`, `pedido`, `pedido_item`, `pedido_evento`, `resena`, `stock_item_catalogo`.
- Numeración `PED-AAAA-000123` con la secuencia `pedido_numero_seq` (`siguiente_numero_pedido()`, año de Asunción).
- **Ningún cambio de estado sin evento:** el trigger `registrar_evento_pedido` escribe `pedido_evento` en cada alta y cada cambio de `pedido.estado`, con el actor (`app.actor_id`, obligatorio: sin él la base rechaza el cambio) y la nota (`app.nota`). `pedido_evento` no se modifica ni se borra.
- La calificación de la tienda (`tienda.calificacion`, `total_resenas`) la recalcula un trigger con cada reseña.
- RLS activado y sin acceso para `anon`/`authenticated`.

## Flujo
1. **Cotización** (`/compras/cotizaciones/nueva`): productos del catálogo, cantidades en unidad base, granja y departamento de entrega, fecha. Se envía a hasta 10 tiendas verificadas que publican esos productos y entregan en el departamento (orden: más productos cubiertos, mejor calificación, respuesta más rápida). Vence a los 7 días.
2. **Respuesta** (`/vendedor/cotizaciones/[id]`): la tienda elige sus publicaciones (precio y presentación se completan solos; la cantidad cubre lo pedido), envío, plazo y validez; puede cotizar solo algunos productos y actualizar la respuesta mientras no haya pedido.
3. **Comparativa** (`/compras/cotizaciones/[id]`): productos × tiendas, precio por unidad base, envío, plazo, validez y total; en verde el menor total y el menor plazo (entre las que cotizaron más productos) y el menor precio por unidad de cada producto. "Aceptar" crea el pedido.
4. **Pedido directo** desde una publicación (`/compras/pedidos/nuevo?publicacion=…`).
5. **Aprobación:** si quien compra no es propietario y el total supera su `limite_compra_gs`, el pedido queda en `PENDIENTE_APROBACION` y lo aprueba alguien con `compras.pedidos.aprobar` (no el mismo comprador); el rechazo vuelve a `BORRADOR` con nota.
6. **Tienda:** confirma (con fecha de entrega) o rechaza con motivo → en camino → entregado. La tienda no ve borradores ni pedidos esperando aprobación interna.
7. **Recepción** (`compras.pedidos.recibir`), en una transacción (`src/lib/pedidos/recepcion.ts`):
   - Stock: lote (obligatorio con vencimiento en vacunas, medicamentos y suplementos) + movimiento de entrada; costo unitario = lo pagado ÷ lo recibido. Se aprende qué producto de stock es cada producto del catálogo (`stock_item_catalogo`, lo usa la Fase 14).
   - Finanzas: un gasto por categoría financiera del producto (el envío suma a la de más monto), proveedor = la tienda, origen `PEDIDO_MERCADO`. Pendiente con vencimiento (Cuentas por pagar; crédito de la tienda = 30 días por defecto) salvo que se marque pagado (requiere `finanzas.pagar.registrar_pago`).
   - Se permiten faltantes: se registra lo recibido y la nota del evento lo detalla.
8. **Reseña** de 1 a 5 estrellas después de recibir; la tienda puede responder. Se muestran en la página pública de la tienda como "compra verificada".
- Antes de la primera cotización o pedido se aceptan los Términos del Mercado (queda en `aceptacion_documento`).
- Cada cambio avisa a la otra parte (notificación con enlace) y ambos lados tienen botón de WhatsApp con el número de pedido.

## Panel de plataforma
`/admin/mercado` suma venta del mes (pedidos confirmados o más), ticket promedio, conversión cotización → pedido, tiempo de respuesta de las tiendas y pedidos por estado.

## Pruebas
`npm run prueba:pedidos` (también en CI): aprobación por límite, transiciones, comparativa de 3 tiendas, selección de tiendas por zona, eventos obligatorios e inmutables, recepción con faltante (stock, costo, gastos por categoría, Cuentas por pagar, proveedor), reseña → calificación.
