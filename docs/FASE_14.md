# Fase 14 — Motor de necesidades ("Lo que te va a faltar")

## Diferencia con el documento
El stock del ERP vive por organización (`lotes_vacunas`), no por granja. Por eso `parametro_compra` y `necesidad_snapshot` van por **organización + producto de stock** (`stock_item_id`), y el producto del catálogo del Mercado sale de `stock_item_catalogo` (se aprende al recibir un pedido o se elige en la configuración). El selector de granja llega cuando el stock se separe por granja.

## Métodos (`src/lib/necesidades/calculo.ts`, puro)
- **Por ración (M1)**, balanceado vinculado a una etapa de alimentación (`feed_types.producto_balanceado_id`, se elige en ⚙):
  - Gestación y lactación con las raciones de Finanzas → Parámetros; cada madre sigue su calendario (servicio + 115 días → parto → 21 días de lactancia → destete → vuelve a ración de gestación).
  - Lechones por **consumo acumulado**: pre-inicial 1 (kg/lechón) del día 10 al destete; pre-inicial 2 en los primeros 14 días de recría; inicial del día 14 al 49. Las camadas futuras salen de los partos que vienen (nacidos vivos promedio × (1 − mortalidad)).
  - Engorde con la curva de la Fase 9 (`consumoKgDia` interpolado; sin curva, 2,2 kg/día; 120 días).
  - Materias primas: la granja no fabrica (decisión del 07/11): van por histórico.
- **Programado (M2)**, vacunas y medicamentos: eventos sanitarios pendientes por día (los atrasados cuentan hoy); con el envase conocido (último pedido recibido) se abren **frascos enteros por día**: `ceil(dosis_día / dosis_por_frasco)`. ml = dosis × ml por dosis.
- **Histórico (M3)**: promedio ponderado de 8 semanas de salidas; con menos de 3 semanas con salidas → `SIN_DATOS`.
- `AUTO` elige: etapa vinculada → ración; sanitario con eventos → programado; si no → histórico. Se puede forzar o poner "No predecir".

## Sugerencia (14.3)
`H = plazo + seguridad + ciclo` (5 + 7 + 7); disponible = stock no vencido + pedidos confirmados/en camino que llegan dentro del plazo; fecha de quiebre = primer día con stock proyectado < 0; sugerido = máx(0; demanda de hoy a hoy + H − disponible), redondeado a la unidad de compra; merma divide el consumo. Urgencia: crítica si se termina dentro del plazo, pronto dentro de plazo + seguridad. Cada fila trae la explicación en palabras.

## Pantalla `/compras/necesidades`
Resumen de críticas, pronto y sin datos; tabla por categoría con stock, en camino, consumo/día, días que alcanza, fecha de quiebre, mini gráfico de 30 días contra el punto de pedido, cantidad editable, urgencia y "¿Por qué?". Seleccionar → **Pedir cotización** (origen `MOTOR_NECESIDADES`) o **Comprar ya** (publicación activa más barata por unidad que entrega en el departamento, con la cantidad que cubre lo sugerido). ⚙ por producto: método, plazos, unidad de compra, merma, producto del catálogo y etapas de alimentación. `/compras/necesidades/precision`: predicho contra real de 28 días (meta < 15 % en balanceados).

## Ejecución
- Al abrir la pantalla (se guarda una foto como máximo cada 30 minutos) y todos los días a las 05:00 de Asunción con Vercel Cron (`vercel.json` → `/api/cron/necesidades`, 08:00 UTC), protegido con la variable **`CRON_SECRET`** (Vercel la manda como `Authorization: Bearer …`). Sin la variable, el cron responde 401 y la pantalla igual calcula al abrirse.
- Aviso diario cuando un producto pasa a crítico; franja en el tablero: "N productos se terminan esta semana". Las fotos de más de 120 días se borran.

## Pruebas
`npm run prueba:necesidades` (también en CI): ejemplo del documento (1.200 kg, 180 kg/día → 3.000 kg, se termina el 16/11, PRONTO), merma, en camino, frascos por día, sin datos, promedio ponderado, ración por calendario (gestación → lactancia → destete, pre-inicial acumulado, recría a mitad de programa) y el cálculo completo de la granja con más madres.
