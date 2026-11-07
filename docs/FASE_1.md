# Fase 1 — Identidad, organizaciones, membresías y unidades de negocio

Estado: **probada contra una copia local de producción**. Falta aplicarla a la base de producción (ver "Cómo aplicar").

## Qué se hizo

### 0. Preparación
- Respaldo de la base de producción (esquema + datos) en `C:\Dev\KURPORC-ERP-V1_RESPALDO_2026-11-07\db\` (`public.dump` y `public.sql`).
- **Baseline de migraciones:** la base se había creado con `prisma db push` y no tenía historial. Se reemplazó la migración vieja (desactualizada) por `prisma/migrations/0_baseline`, idéntica a la base actual (verificado con `prisma migrate diff`: vacío). Así Prisma nunca va a pedir resetear la base.

### 1. Se eliminó el módulo Balanceado (decisión 16)
- Pantallas `/balanceado/**`, APIs `balanceado`, `balanceado-stats`, `formulas`, `raw-materials`, `ai/analyze-pdf` (análisis de laboratorio de materias primas), componentes y validaciones.
- Modelos `Formula`, `FormulaVersion`, `FormulaIngredient`, `NutritionalTarget`, `BalProductionOrder`, `LoteInventarioNutricion` y enums asociados. Valores de enum `MATERIA_PRIMA`, `LocationType.BAL`, `OrigenMovimiento.PRODUCCION`. Todas las tablas estaban vacías.
- **Se conserva:** balanceado como producto de stock y el registro de consumo en Alimentación.
- La proyección de faltantes ([src/lib/inventario/proyeccion.ts](../src/lib/inventario/proyeccion.ts)) ahora calcula la demanda de **balanceado comprado** con el consumo real de los últimos 7 días de cada etapa (antes calculaba materias primas a partir de fórmulas).

### 2. Modelo de plataforma
| Documento | Implementación |
|---|---|
| `Organizacion` | Se **extendió** `Tenant` (tabla `tenants`): tipo, código de unión, razón social, RUC, ubicación, estado, verificación, benchmark, creador |
| `Perfil` | Se **extendió** `User` (tabla `users`): `authUserId` (enlace a Supabase Auth, Fase 3), avatar, ubicación, tipo de registro, tipo de acceso, onboarding, etc. |
| `Granja` | **Nuevo** (no existía). Los sectores (`farm_locations`) apuntan a su granja |
| `UnidadNegocio`, `Miembro`, `MiembroGranja`, `MiembroUnidad`, `Rol`, `Permiso`, `RolPermiso`, `MiembroPermiso`, `Invitacion`, `SolicitudUnion`, `AdminPlataforma`, `ActividadDiaria`, `Notificacion` | Nuevos, como en el documento. Unidades sin `FABRICA` |

### 3. Seguridad en la base (migración `20261107000100_fase1_organizaciones`)
- Funciones `usuario_actual()`, `mis_orgs()`, `tiene_permiso(org, clave, granja, unidad)`, `es_superadmin()`.
- **RLS activado en todas las tablas** (antes: ninguna). Cierra la API REST de Supabase, que estaba abierta para cualquiera con la clave anónima.
- Tablas del ERP: un miembro activo puede **leer** las de su organización. Sin políticas de escritura: todo se escribe desde el servidor.
- Vista `v_companeros` (nombre, foto y cargo de los compañeros; nunca correo ni teléfono).
- Prisma no se ve afectado: en producción entra como `postgres`, dueño de las tablas y con `BYPASSRLS` (verificado).

### 4. Catálogo y roles
- [src/lib/permisos/catalogo.ts](../src/lib/permisos/catalogo.ts): **191 permisos** del Anexo A (sin `balanceado.*`; se agregó `alimentacion.*`).
- [src/lib/permisos/roles-plantilla.ts](../src/lib/permisos/roles-plantilla.ts): **15 roles plantilla** del Anexo A.11 (sin `ENCARGADO_BALANCEADO`) y el mapa de los 14 roles legados.

### 5. Migración de datos — [scripts/migrar_a_organizaciones.ts](../scripts/migrar_a_organizaciones.ts)
`npm run db:migrar-orgs`. Resultado sobre la copia de producción:
- 1 organización ("Granja Demo KurPorc") → 1 granja, unidades `COMUN` y `GRANJA-DEMO-KURPORC`, 15 roles copiados.
- 3 usuarios → 3 miembros: propietario (Administrador General), Veterinario, Operario.
- 1 cuenta en `admin_plataforma` (el usuario con el rol legado Super Admin).
- **Segunda corrida: no crea nada** (idempotente).

## Criterios de aceptación
- [x] La migración corre sin errores sobre una copia de la base actual.
- [x] `prisma validate` y `npm run build` sin errores; `tsc` limpio.
- [x] Un usuario sin membresía no lee ningún dato (anónimo y autenticado nuevo) — prueba 1 y 2.
- [x] `tiene_permiso(<org>, 'sanidad.carencias.liberar')` es `true` solo para propietario y veterinario (reemplaza a `balanceado.formulas.aprobar`, que ya no existe) — prueba 4.
- [x] Un miembro limitado a una unidad no tiene permiso en otra — prueba 5 (sobre `tiene_permiso`; las tablas financieras con `unidad_id` llegan en la Fase 8).
- [x] El script de migración es idempotente.
- [ ] Todas las pantallas del ERP muestran los mismos datos que antes → verificar en producción después de aplicar.
- [ ] `npm run lint`: el proyecto no tiene ESLint configurado (pendiente, ver abajo).

Prueba: `psql "<url>" -v ON_ERROR_STOP=1 -f supabase/tests/fase1_aislamiento.sql` (corre en una transacción que se deshace).

## Diferencias con el documento (registradas)
1. El SQL propio (funciones, RLS) va dentro de la migración de Prisma, no en `supabase/migrations/`: un solo camino de despliegue (`prisma migrate deploy`).
2. El trigger `handle_new_user` sobre `auth.users` pasa a la **Fase 3**: requiere que `users.tenantId` y `users.passwordHash` sean opcionales, y eso se cambia junto con el paso a Supabase Auth.
3. El filtro por permiso en cada tabla (`<modulo>.<recurso>.ver`) se agrega en la **Fase 7**, cuando cada pantalla tenga su permiso. Hoy la política es "miembro activo de la organización".
4. Los permisos de plataforma (A.10) no van a la tabla `permiso`: dependen de `admin_plataforma.nivel` (Fase 11).
5. Falta configurar ESLint (`next lint`) y un framework de tests: requiere instalar dependencias. Propuesto para el inicio de la Fase 2.

## Cómo aplicar en producción
El orden importa: con la base migrada y el código viejo, el tablero falla (consulta fórmulas); con el código nuevo y la base vieja, falla el ingreso. Hacer los dos pasos seguidos:

```bash
npx prisma migrate resolve --applied 0_baseline   # registra el historial (no cambia nada)
npx prisma migrate deploy                          # aplica la Fase 1
npm run db:migrar-orgs                             # datos: granja, unidades, roles, miembros
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase1_aislamiento.sql
git push                                           # Vercel despliega el código nuevo
```
Si algo sale mal: `pg_restore --clean` desde el respaldo y `git reset --hard respaldo-pre-plataforma-2026-11-07`.
