# Respaldo y restauración de la base de datos

Base: Supabase, proyecto `evpnnotjjhwovirceyyl` (São Paulo, `sa-east-1`), PostgreSQL 17.

## Qué respaldos hay

| Respaldo | Cuándo | Dónde | Estado |
|---|---|---|---|
| Automático de Supabase | Diario (solo plan Pro; el plan Free no ofrece respaldos descargables) | Panel de Supabase → Database → Backups | **Confirmar el plan** |
| Manual con `pg_dump` | Antes de cada fase que cambia la base | Carpeta local `C:\Dev\KURPORC-ERP-V1_RESPALDO_<fecha>\db\` | Hecho el 07/11/2026 |
| Copia externa semanal cifrada | Semanal | **Pendiente de decisión** (ver docs/FASE_2.md) | — |

## Hacer un respaldo manual

Requiere el cliente de PostgreSQL 17 o superior (`pg_dump --version`).
Usar la conexión **directa** (puerto 5432), no la del pooler (6543).

```bash
# En la carpeta del proyecto. Carga DIRECT_URL desde .env sin mostrarla.
set -a; . ./.env; set +a
DEST="/c/Dev/KURPORC-ERP-V1_RESPALDO_$(date +%F)/db"; mkdir -p "$DEST"
pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges -Fc -f "$DEST/public.dump"
pg_restore --list "$DEST/public.dump" > /dev/null && echo "respaldo legible"
```

El archivo contiene datos personales (funcionarios, usuarios). Guardalo en un disco cifrado y nunca lo subas a Git.

## Restaurar

### A. Probar el respaldo (sin tocar producción)
Se restaura en un Postgres local para ver que esté completo:

```bash
initdb -D ./pg-prueba -U postgres -A trust -E UTF8
pg_ctl -D ./pg-prueba -o "-p 54329" -l pg-prueba.log start
psql -h localhost -p 54329 -U postgres -c "create database restauracion"
psql -h localhost -p 54329 -U postgres -d restauracion -f supabase/tests/supabase_stub.sql
pg_restore -h localhost -p 54329 -U postgres -d restauracion --no-owner --no-privileges public.dump
psql -h localhost -p 54329 -U postgres -d restauracion -c "select count(*) from users; select count(*) from sows;"
```

### B. Restaurar producción (emergencia)
1. Avisar a los usuarios y pausar la app (Vercel → proyecto → Settings → pausar, o desplegar una página de mantenimiento).
2. **Respaldar el estado actual** antes de pisarlo (paso "Hacer un respaldo manual"), aunque esté dañado.
3. Restaurar:
   ```bash
   pg_restore -d "$DIRECT_URL" --clean --if-exists --no-owner --no-privileges public.dump
   ```
4. Verificar: `npx prisma migrate status` (debe decir "up to date") y las pruebas
   `supabase/tests/fase1_aislamiento.sql` y `fase2_seguridad.sql` (se deshacen solas).
   Ojo: `--clean` borra y vuelve a crear las tablas de auditoría, que son de solo agregar. Es esperable.
5. Volver el código a la versión del respaldo si hace falta: `git checkout <tag o commit>`.
6. Registrar el incidente (docs/PLAN_INCIDENTES.md).

## Prueba trimestral

Cada tres meses: hacer un respaldo, restaurarlo con el procedimiento A y anotar el resultado acá.

| Fecha | Respaldo | Resultado | Responsable (puesto) |
|---|---|---|---|
| 07/11/2026 | `public.dump` (89 tablas) | Restaurado en local; se corrieron las migraciones de las Fases 1 y 2 y sus pruebas sobre la copia | Administración |
