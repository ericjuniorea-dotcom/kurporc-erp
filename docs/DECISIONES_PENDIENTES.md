# Decisiones pendientes (Fase 0)

## Decididas (07/11/2026)

| # | Decisión |
|---|---|
| 1 | **Se migra a Supabase Auth** (ingreso con Google, segundo factor, CAPTCHA y RLS con `auth.uid()`). NextAuth se retira |
| 16 | **Se elimina la fábrica de balanceado.** KurPorc es solo gestión porcina: sin unidad `FABRICA-BAL`, sin precio de transferencia, sin `TransferenciaBalanceado`. El balanceado **se compra hecho**: se trata como un insumo comprado a proveedores. **Se elimina el módulo Balanceado completo** (Fórmulas y su aprobación, Materias primas, Producción/órdenes de producción, objetivos nutricionales, `/balanceado/**`, `/api/balanceado/**`, `/api/formulas/**`, `/api/raw-materials/**`, permisos `balanceado.*` del Anexo A y rol `ENCARGADO_BALANCEADO`). **Se conserva** el balanceado como categoría de stock (`CategoriaProducto.BALANCEADO`) y el registro de consumo en Alimentación (`FeedType`, `FeedRecord`), porque de ahí salen el costo de alimento por lechón y la conversión en engorde. En Finanzas (8.8) aplica solo el camino "compras de balanceado terminado a proveedores". Se ejecuta al inicio de la Fase 1, después del respaldo de la base |
| 3 | Baseline de migraciones hecho (`0_baseline`) |
| 4 | **No se crea un segundo proyecto Supabase.** Se trabaja sobre el actual; cada fase se prueba antes contra una copia local restaurada desde un respaldo |
| 6, 7 | IDs: se mantienen los cuid; `tenants` = organización y `users` = perfil, extendidas |
| 8 | Por ahora una granja por organización, creada desde el nombre de la organización. En producción solo está la granja demo; las granjas reales se cargan desde Configuración |
| 17 | **Meta de escala:** 1.000 usuarios al arrancar, con una arquitectura que crezca sin rehacerse (Vercel + Supabase, pooler, índices por organización, caché, tareas pesadas fuera del request) |

Cada punto choca entre el documento maestro v2.0 y el código real. Se necesita la respuesta del dueño del producto antes de la Fase 1.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | **Autenticación** | (a) Migrar a Supabase Auth como dice el documento · (b) Mantener NextAuth y agregarle Google | **(a)**. Todo el documento (RLS con `auth.uid()`, MFA, CAPTCHA, cuentas gestionadas) está pensado para Supabase Auth. Hoy hay solo 3 usuarios: migrar es barato ahora y caro después |
| 2 | **Versión de Next.js** | Subir a 15 al empezar la Fase 2/3 · quedarse en 14 y adaptar | Subir a 15 en una fase propia, antes de la Fase 3 |
| 3 | **Migraciones** | Hacer *baseline*: generar una migración desde la base actual y marcarla aplicada (`prisma migrate resolve --applied`) | Obligatorio antes de la Fase 1; sin esto `migrate dev` resetea la base |
| 4 | **Base de desarrollo** | Crear un segundo proyecto Supabase (gratuito) para desarrollo | Sí, antes de la Fase 1 |
| 5 | **Respaldo de la base** | `pg_dump` completo antes de tocar el esquema | Sí; ¿qué plan de Supabase tienen (Free / Pro)? |
| 6 | **IDs** | Mantener `cuid` texto en tablas viejas y usar `String` (sin `@db.Uuid`) en las FK nuevas hacia ellas | Sí. Solo `perfil.id` sería uuid (= `auth.users.id`) |
| 7 | **Organización** | Extender `tenants` · crear `organizacion` nueva | Extender `tenants` con `@@map` |
| 8 | **Granjas** | El documento habla de San Cosme y Misiones; en la base no existe la entidad Granja | Crear `Granja`. Confirmar: ¿cuántas granjas, nombres, y la fábrica de balanceado está en cuál? |
| 9 | **Rutas `/app/**`** | Mover el ERP de `/(dashboard)/<modulo>` a `/app/<modulo>` · dejar las rutas actuales | Mover a `/app` en la Fase 5 (libera `/` para la landing), con redirecciones desde las viejas |
| 10 | **Roles 3, 8, 9 y 14** | Ver mapa en la auditoría §3 | Confirmar |
| 11 | **Lint y tests** | Agregar ESLint (`next lint`) y Vitest | Sí, al inicio de la Fase 1 |
| 12 | **Archivos** | Seguir con S3 · pasar a Supabase Storage | Supabase Storage (lo exige la Fase 2.6 y no suma proveedor) |
| 13 | **Planilla de control** | ¿`KURPORC_Administracion_y_Finanzas_3.xlsx` (Descargas) es la versión con los valores del Anexo H? | Confirmar |
| 14 | **`PROMPT_DISEÑO.md`** | No existe en el repo | ¿Dónde está, o se omite? |
| 15 | **Usuario Super Admin** | Hoy es un rol (ID 1) dentro del tenant | Pasa a `admin_plataforma` con `SUPERADMIN_EMAIL`; idealmente otra cuenta de Google |
