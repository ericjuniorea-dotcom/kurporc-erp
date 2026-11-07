# Auditoría de la plataforma — Fase 0

Fecha: 07/11/2026 · Commit auditado: `f81074e` (tag de respaldo `respaldo-pre-plataforma-2026-11-07`)
Alcance: lectura de código y consultas **de solo lectura** sobre la base en vivo. No se modificó código.

---

## Resumen ejecutivo

El documento maestro v2.0 asume un stack que **no coincide** con el proyecto real en cuatro puntos que cambian el plan de las Fases 1 a 3:

| Supuesto del documento | Realidad del código | Impacto |
|---|---|---|
| Next.js 15 (App Router) | **Next.js 14.2** (`package.json`) | `after()`, `cookies()` asíncrono y CSP con nonce según la guía de Next 15 no aplican tal cual |
| Supabase Auth (`auth.uid()`, Google por Supabase, MFA TOTP, CAPTCHA) | **NextAuth v4** con `CredentialsProvider` + tabla propia `users` con `passwordHash` bcrypt ([src/lib/auth/config.ts](../src/lib/auth/config.ts)) | Todas las funciones SQL `mis_orgs()`, `tiene_permiso()`, `handle_new_user()` dependen de `auth.uid()`; hoy nunca tiene valor |
| Migraciones con `prisma migrate dev` | **No existe la tabla `_prisma_migrations`**: el esquema se aplicó con `prisma db push`. La única migración (`20260624160613_init`) está desactualizada: faltan 25 tablas | Correr `prisma migrate dev` hoy propondría **resetear la base** (pérdida de datos) |
| IDs `uuid` (`@db.Uuid`) | Todos los IDs son `cuid()` en texto | Las FK `@db.Uuid` del documento no se pueden apuntar a tablas existentes |
| Existe `supabase/migrations/` y políticas RLS basadas en `get_empresa_id()` | No hay carpeta `supabase/`, **RLS desactivado en las 90 tablas, 0 políticas, 0 funciones** | La "doble barrera" (D6) hay que construirla desde cero |
| Hay una jerarquía Empresa → Granja → Galpón → Sala → Corral | No existe entidad **Granja**. Solo `Tenant` → `FarmLocation` (plana, con `locationType`) → `Pen` | Las unidades de negocio `GRANJA-MISIONES` / `GRANJA-SAN-COSME` no tienen a qué apuntar |

Lo positivo: la base productiva está **casi vacía** (1 tenant, 3 usuarios, 1 cerda, 1 servicio, 24 tareas, 9 productos de inventario). La migración a organizaciones es de bajo riesgo si se hace ahora.

---

## 1. Tablas, columna de tenant y RLS

- **90 tablas** en `public` (consulta a `pg_class`). Prisma: 105 modelos/enums en [prisma/schema.prisma](../prisma/schema.prisma) (2.349 líneas).
- **Columna de tenant:** `tenantId` (texto, cuid, sin `@map`: la columna física se llama `"tenantId"`). Presente en todas las tablas de negocio salvo:
  - Tablas de sistema: `tenants`, `roles`, `user_roles`, `accounts`, `sessions`, `verification_tokens`.
  - Tablas hijas que heredan el tenant del padre (sin columna propia): `foster_donations`, `lotes_inventario_nutricion`, `formula_ingredients`, `purchase_order_items`, `goods_receipt_items`, `transfer_items`, `health_protocol_tasks`, `health_task_completions`, `whatsapp_messages`, `push_tokens`, `marketplace_pedido_items`.
  - **Globales (sin tenant):** `marketplace_vendors`, `marketplace_productos` (el catálogo del Mercado actual es compartido entre todos).
- **RLS:** desactivado en todas las tablas. `pg_policies` vacío. No hay funciones en el esquema `public`.
- **Extensiones instaladas:** `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`. Faltan `unaccent` y `pg_trgm` (Fase 12) y `pg_cron` (Fase 11).
- **Desfase migración ↔ base:** tablas presentes en el esquema y en la base pero no en la migración: `animal_events`, `aplicaciones_vacunas`, `config_*` (5), `eventos_vacunacion`, `external_semen_lots`, `growing_deaths`, `growing_other_exits`, `growing_transfers`, `lotes_inventario_nutricion`, `lotes_vacunas`, `marketplace_*` (4), `movimientos_inventario`, `necropsias`, `procedimientos_maternidad`, `protocolo_items`, `protocolos_sanitarios`, `tasks`, `vacunas`. En la migración pero ya no en el esquema: `raw_materials`, `raw_material_lots`, `finished_stocks`.

## 2. Cómo se resuelve hoy el tenant

- Un usuario pertenece a **un solo tenant**: `users.tenantId` (FK obligatoria) — [schema.prisma:308](../prisma/schema.prisma#L308).
- Al iniciar sesión, `authorize()` lee el usuario y copia `tenantId`, `tenantSlug`, `farmName`, `plan` y `roles` al **JWT de NextAuth** (8 h) — [src/lib/auth/config.ts:44-107](../src/lib/auth/config.ts#L44-L107).
- Cada route handler hace `getServerSession(authOptions)` y filtra a mano con `where: { tenantId: session.user.tenantId }`. No hay cliente Prisma con filtro automático; [src/lib/db/tenant.ts](../src/lib/db/tenant.ts) solo tiene helpers (`assertTenantAccess`, `provisionTenant`) y **no se usa para filtrar**.
- Prisma conecta como el usuario dueño de la base (pooler de Supabase `aws-1-sa-east-1`), que salta RLS.
- **Plan hacia `mis_orgs()`**: reemplazar `session.user.tenantId` por la organización activa (`kp_org`) validada contra `miembro` en cada request, y centralizar el filtro en `dbOrg(orgId, actorId)` (Prisma Client Extension). Las funciones SQL con `auth.uid()` solo sirven si se adopta Supabase Auth (ver Decisión 1); si no, RLS se arma con `current_setting('app.actor_id')` y el rol de Prisma sigue saltándolo.

## 3. Usuarios, roles y dónde se chequean

- Modelo: `User` + `UserRole` (N a N, acumulables) + `Role` con **14 roles fijos de ID numérico** — [src/lib/auth/config.ts:8-23](../src/lib/auth/config.ts#L8-L23).
- Datos en vivo: 3 usuarios con 4 asignaciones: Super Admin, Admin de granja, Veterinario Jefe de Producción, Operario de campo.
- Chequeos hardcodeados (**52 archivos**; se reemplazan en la Fase 7 por `requirePermiso`):

| Zona | Archivo:línea |
|---|---|
| Middleware | [src/middleware.ts:21,24,29,34](../src/middleware.ts#L21) (`/admin`, `/financiero` → roles 1,2,9; `/mi-portal`) |
| Helpers | `hasRole`, `hasAnyRole`, `canApproveFormulas`, `canApproveStockAdjustments`, `canAccessFinancials` — [src/lib/auth/config.ts:113-141](../src/lib/auth/config.ts#L113-L141) |
| Páginas | alimentacion:160 · balanceado:26 · balanceado/formulas:67-68 · balanceado/materias-primas:67 · balanceado/produccion:57 · engorde:62 · financiero:19 (chequeo **solo en cliente**) · gestacion:338,344 · logistica:109 · marketplace:66 · maternidad:26,33,34 · maternidad/nuevo-parto:10 · plantel:63 · recria:36 · rrhh:94,129 · tareas:325,382 · whatsapp:32 (todas bajo `src/app/(dashboard)/`) |
| API | ai/analyze-pdf:48 · balanceado/produccion:38 · balanceado/produccion/[id]:12 · curative-treatments:39 · farrowing-events:79 · farrowing-events/[id]/deaths:17 · /movements:16 · /weaning:19 · formulas:50 · formulas/[id]/approve:17 · gestacion/diagnostico-prenez:14 · gestacion/lotes/[id]:9,23 · gestacion/registrar-celo:12 · gestacion/repeticion-celo:12 · health-tasks/[id]/complete:15 · marketplace/vendors:24 · nursery-batches/[id]/phase-change:15 · /transfer-growing:16 · /weight-records:30 · plantel/animales/[id]:30 · raw-materials:59 · raw-materials/lots:13 · rrhh/funcionarios:89 · sanidad/assign:11 · sanidad/necropsias:10,70 · sanidad/seed:55 · service-batches:163 · service-events:57,69 · sows:62 (todas bajo `src/app/api/`) |
| Componentes / lib | components/gestacion/lotes-view.tsx:13,200 · components/gestacion/servicio-fields.tsx:11,175 · components/layout/sidebar.tsx:135 · components/sanidad/panel-necropsias.tsx:9,21 · lib/gestacion/create-service-event.ts:10 |

- **Regla de negocio existente que el Anexo A respeta:** solo el Veterinario Jefe (rol 4) aprueba fórmulas — [api/formulas/[id]/approve/route.ts:17](../src/app/api/formulas/%5Bid%5D/approve/route.ts#L17). Mapea a `balanceado.formulas.aprobar`.

**Mapa de roles actuales → plantillas del Anexo A.11**

| ID | Rol actual | Plantilla destino |
|---|---|---|
| 1 | Super Admin | `admin_plataforma` (nivel TOTAL) — no es un rol de organización |
| 2 | Admin de granja | `ADMIN_GENERAL` + `es_propietario` |
| 3 | Gerente general | `ADMIN_GENERAL` sin propiedad (a confirmar) |
| 4 | Veterinario jefe | `VETERINARIO` |
| 5 | Jefe de producción | `JEFE_PRODUCCION` |
| 6 | Encargado BAL | `ENCARGADO_BALANCEADO` |
| 7 | Logística | `LOGISTICA_STOCK` |
| 8 | Jefe RRHH | `ADMINISTRACION_FINANZAS` reducido a `rrhh.*` (crear rol propio) |
| 9 | Contador | `CONTADOR_EXTERNO` o `ADMINISTRACION_FINANZAS` (a confirmar) |
| 10 / 11 / 12 | Maternidad / Gestación / Recría | `ENCARGADO_MATERNIDAD` / `ENCARGADO_GESTACION` / `ENCARGADO_DESTETE_RECRIA` |
| 13 | Operario de campo | `OPERARIO` |
| 14 | Portal del empleado | sin equivalente (solo permisos personales A.9) |

## 4. Jerarquía física real

`Tenant` (= empresa) → `FarmLocation` (`farm_locations`: nombre + `locationType` GESTATION/MATERNITY/NURSERY/GROWING/BAL/OTHER) → `Pen` (`pens`, corral con capacidad) → animales/lotes (`Sow.galponAssigned`/`corralAssigned` como **texto libre**, `FarrowingEvent.penId`, `NurseryBatch.penId`, `GrowingBatch.penId`).

- **No hay Granja ni Sala.** `GrowingBatch.sitio` es un texto libre que sugiere varios sitios.
- En vivo: 1 sola `FarmLocation` (MATERNITY). Las granjas San Cosme y Misiones no están cargadas.

## 5. Tablas fuente por dominio

| Dominio | Tablas actuales |
|---|---|
| **Stock (unificado)** | `ProductoInventario` → tabla `vacunas` (todas las categorías: VACUNA, SUPLEMENTO, MEDICAMENTO, MATERIA_PRIMA, BALANCEADO, EQUIPAMIENTO), `LoteInventario` → `lotes_vacunas` (lote, vencimiento, cantidad, `costoUnitario`), `MovimientoInventario` (ENTRADA/SALIDA/AJUSTE + origen), `StockAdjustmentRequest`. Heredadas: `Medicine`, `MedicineStock`, `Supplier`, `PurchaseOrder(+Item)`, `GoodsReceipt(+Item)`, `Transfer(+Item)` |
| **Balanceado** | `Formula`, `FormulaVersion` (aprobación), `FormulaIngredient`, `NutritionalTarget`, `BalProductionOrder` (genera un `LoteInventario` BALANCEADO), `LoteInventarioNutricion`, `FeedType`, `FeedRecord` (consumo por maternidad / lote de recría / lote de engorde). **No hay precio de transferencia fábrica → granja** ni entregas valorizadas |
| **Sanidad** | `ProtocoloSanitario`, `ProtocoloItem`, `EventoVacunacion`, `AplicacionVacuna` (dosis, lote), `CurativeTreatment`, `WithdrawalPeriod` (carencias), `Necropsia`, `ProcedimientoMaternidad`, `HealthProtocolConfig/Task`, `HealthTask(+Completion)`, `ConfigVacuna`. ml por frasco: `ProductoInventario.dosisMl`; descarte de vial abierto: `descarteHorasApertura` |
| **Reproducción** | `Sow` (`plantelState`, `entryDate`), `Boar`, `SemenDose`, `ExternalSemenLot`, `ServiceBatch`, `ServiceEvent`, `PregnancyCheck`, `HeatRepeat`, `AbortionEvent`, `FarrowingEvent`, `WeaningEvent`, `SowDiscard`, `AnimalEvent` |
| **Maternidad** | `Piglet`, `PigletDeath`, `PigletMovement`, `FosterEvent`, `FosterDonation` |
| **Calendario de bandas** | `ServiceBatch` (lotes reproductivos) + `Task` (24 tareas generadas: parto esperado, diagnóstico, vacunas). No hay una tabla de calendario de bandas como tal |
| **Recría / engorde** | `NurseryBatch`, `PhaseChange`, `WeightRecord`, `GrowingBatch`, `GrowingDeath`, `GrowingTransfer`, `GrowingOtherExit`, `BatchSale` |
| **Ventas** | `BatchSale` (kg, precio/kg, comprador, guía) y `Sale` (genérica, `Decimal(14,0)`, categoría texto). 0 filas |
| **RRHH** | `Employee` (`cedula` **en claro**, sueldo base), `AttendanceRecord`, `LeaveRecord`, `PayrollRecord` (IPS 9 % / 16,5 %) |
| **Finanzas** | Solo `Sale` y `Expense` (categoría texto). 0 filas. La página `/financiero` es un "en construcción" |
| **Mercado** | `MarketplaceVendor` (global, `isApproved`), `MarketplaceProducto` (global), `MarketplacePedido(+Item)` (con `tenantId` comprador) |

### Fuentes y faltantes para cada fase de cálculo

- **Fase 8 (Finanzas):** todo el modelo financiero es nuevo. Fuentes automáticas disponibles: `BatchSale`/`Sale` → ventas; `PayrollRecord` → sueldos; `FeedRecord` + `BalProductionOrder` → kilos de balanceado; `AplicacionVacuna` → uso sanitario. **Faltan:** granjas y unidades de negocio, precio de transferencia, entregas fábrica→granja valorizadas, precio de compra en `MovimientoInventario`, matrices activas promedio por mes (se puede derivar de `Sow`). La planilla `KURPORC_Administracion_y_Finanzas_3.xlsx` está en Descargas (fuera del repo).
- **Fase 9 (Engorde):** módulo **ya implementado** (páginas `/engorde`, API `engorde/{lotes,pesajes,muertes,transferencias,otras-salidas,ventas,kpis,analisis}`, componentes `components/engorde/{datos,analisis}`) y especificación `KurPorc_Modulo_Engorde_UI.md` en Descargas. **Faltan:** modalidad integrado, curvas de engorde, costo de ingreso, rendimiento de canal, vacío sanitario, bloqueo por carencia en la venta (verificar), vínculo con Finanzas.
- **Fase 10 (Cerdas paradas):** todos los eventos existen (servicio, diagnóstico, repetición, aborto, parto, destete, descarte, ingreso). **Faltan:** fecha de *decisión* de descarte separada de la salida (`SowDiscard.discardDate` es una sola fecha), fecha de muerte de la cerda (solo `plantelState = DEAD`; revisar `AnimalEvent`), metas productivas (partos/cerda/año, intervalo destete-servicio) — hay `ConfigMeta` que se puede reutilizar.
- **Fase 14 (Motor de necesidades):** ya existe [src/lib/inventario/proyeccion.ts](../src/lib/inventario/proyeccion.ts) (proyección de inventario) — revisar antes de reescribir. Hay raciones en `FeedType` y protocolo sanitario. **Faltan:** catálogo maestro, parámetros de compra por producto, en tránsito.

## 6. Middleware, cliente Supabase, login y `/`

- [src/middleware.ts](../src/middleware.ts): `withAuth` de NextAuth; públicas `/login`, `/api/auth`, `/api/whatsapp/webhook`. Todo lo demás exige token.
- **No hay cliente `@supabase/ssr`** ni ningún uso de Supabase en `src/`. Supabase se usa solo como Postgres.
- Login: [src/app/(auth)/login](../src/app/(auth)/login) con correo + contraseña. **No hay registro público** ni recuperación de contraseña.
- `/` ([src/app/page.tsx](../src/app/page.tsx)) redirige a `/dashboard` o `/login`. No hay landing.
- Rutas del ERP en `src/app/(dashboard)/<modulo>` (sin prefijo `/app`). El documento usa `/app/**`: habrá que decidir si se mueve todo o se mapea.
- `next.config.mjs` no define encabezados de seguridad. Imágenes remotas desde `*.s3.amazonaws.com`.

## 7. Variables de entorno, respaldos y otros

- Usadas (sin valores): `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `REDIS_URL` (referenciada, no definida).
- `.env` y `.env.local` **apuntan ambos a la base de producción** de Supabase. No hay base de desarrollo separada (contradice 2.8).
- Git: solo `.env.example` y `.env.local.example` están versionados; nunca se comiteó un `.env` real (`git log` vacío para esas rutas). Falta correr `gitleaks` sobre el contenido completo (Fase 2).
- **Plan de Supabase:** no se puede saber desde el código. Si es el plan gratuito, **no hay respaldos descargables ni PITR** → hay que hacer `pg_dump` manual antes de la Fase 1.
- `auth.users` tiene **1** fila (alguien creó un usuario en Supabase Auth, no lo usa la app).
- Herramientas: **no hay script `lint` ni configuración de ESLint, ni framework de tests** (Jest/Vitest). Los criterios "`npm run lint`" y "tests de la fase" requieren agregarlos.
- Dependencias sin uso aparente o a revisar: `firebase-admin`, `bull` + `ioredis` (Redis no configurado), `@aws-sdk/client-s3` (Storage en S3, no en Supabase Storage), `lucide-react` (el diseño exige Tabler).
- Diseño: `DESIGN.md` y `SKILL.md` están en [.cursor/skills/kurporc-design/](../.cursor/skills/kurporc-design/). **`PROMPT_DISEÑO.md` no existe** en el repo.

## 8. Riesgos detectados

| # | Riesgo | Severidad |
|---|---|---|
| R1 | `prisma migrate dev` sobre la base actual sin *baseline* → Prisma pide resetear la base | **Crítica** |
| R2 | RLS apagado en todas las tablas. **Corrección (07/11):** los roles de la API de Supabase (`anon`, `authenticated`) no tienen permisos de tabla, así que la API REST no exponía datos; quedaba una sola barrera. Resuelto en la Fase 1 (RLS activo) | Media → resuelta |
| R3 | Una sola base para desarrollo y producción | Alta |
| R4 | Sin respaldos verificados | Alta |
| R5 | Asignación masiva: `PATCH` con `{ ...body }` en [config/genetica/[id]](../src/app/api/config/genetica/%5Bid%5D/route.ts#L15) y [config/vacunas/[id]](../src/app/api/config/vacunas/%5Bid%5D/route.ts#L15) permite cambiar `tenantId` de un registro | Media |
| R6 | `/financiero` protege solo en cliente (el middleware sí bloquea, pero la página no valida en servidor) | Baja |
| R7 | `Employee.cedula` en texto plano | Media (Fase 2.4) |
| R8 | Choque de nombres: los enums `TipoMovimiento` y `OrigenMovimiento` ya existen (inventario) y la Fase 8 define otros con el mismo nombre | Media — se renombran los nuevos |
| R9 | Los montos existentes son `Decimal(14,0)`; el documento exige `BigInt` | Baja — los nuevos en `BigInt`, los viejos se mantienen |

## 9. Mapeo de modelos actuales → modelos del documento

| Documento | Acción propuesta |
|---|---|
| `Organizacion` | **Extender `Tenant`** (tabla `tenants`): agregar tipo, codigoUnion, razonSocial, ruc, estado, verificación, etc. Conserva el id cuid → no hay que reescribir FKs. Columna `tenantId` se mantiene en el código y se expone como `organizacionId` vía helper |
| `Perfil` | **Crear** (1 a 1 con la identidad). Si se adopta Supabase Auth, `perfil.id = auth.users.id`; `users` queda como legado mapeado |
| `Miembro` (+Granja, Unidad, Permiso) | **Crear**; migrar desde `users.tenantId` + `user_roles` |
| `Rol` / `Permiso` / `RolPermiso` | **Crear** `rol` (nuevo); la tabla `roles` actual (IDs 1-14) queda como legado hasta la Fase 7 |
| `UnidadNegocio` | **Crear** + nuevo modelo **`Granja`** (no existe) con FK desde `FarmLocation` |
| `Invitacion`, `SolicitudUnion`, `AdminPlataforma`, `ActividadDiaria` | Crear |
| `Notificacion` | Ya existe `Alert` + `NotificationPreference` + `PushToken`. Crear `notificacion` como bandeja por usuario o extender `alerts` (a decidir) |
| `Venta` (Fase 8) | Extender `BatchSale` / `Sale` o crear `venta` y migrar (0 filas: cualquiera de las dos) |
| `Contraparte` | Extender `Supplier` o crear y migrar (0 filas) |
| `Movimiento` | Crear (`TipoMovimientoFinanciero`, `OrigenMovimientoFinanciero`); `Expense` y `Sale` quedan obsoletas |
| `LoteEngorde` / `EventoEngorde` | **Extender `GrowingBatch`** y sus tablas de eventos en lugar de crear nuevas (el módulo ya funciona) |
| `CategoriaMercado`, `ProductoCatalogo`, `Tienda`, `Publicacion` | Crear; `MarketplaceVendor` → `organizacion` tipo VENDEDOR + `tienda`; `MarketplaceProducto` → `publicacion` (0 filas) |
| `Pedido` (Fase 13) | Extender `MarketplacePedido` o reemplazar (0 filas) |

Las decisiones abiertas están en [DECISIONES_PENDIENTES.md](DECISIONES_PENDIENTES.md).
