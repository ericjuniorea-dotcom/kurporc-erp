-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "cedulaHash" TEXT;

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT,
    "actor_id" TEXT,
    "actor_es_plataforma" BOOLEAN NOT NULL DEFAULT false,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_cambio" (
    "id" BIGSERIAL NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "antes" JSONB,
    "despues" JSONB,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limite_intento" (
    "clave" TEXT NOT NULL,
    "ventana_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),

    CONSTRAINT "limite_intento_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "incidente_seguridad" (
    "id" UUID NOT NULL,
    "detectado_en" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "datos_afectados" TEXT,
    "personas_afectadas" INTEGER,
    "notificado_agencia_en" TIMESTAMP(3),
    "notificado_titulares_en" TIMESTAMP(3),
    "medidas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "registrado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidente_seguridad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_organizacion_id_created_at_idx" ON "auditoria"("organizacion_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_actor_id_created_at_idx" ON "auditoria"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_accion_created_at_idx" ON "auditoria"("accion", "created_at");

-- CreateIndex
CREATE INDEX "historial_cambio_tabla_registro_id_idx" ON "historial_cambio"("tabla", "registro_id");

-- CreateIndex
CREATE INDEX "historial_cambio_created_at_idx" ON "historial_cambio"("created_at");

-- CreateIndex
CREATE INDEX "limite_intento_bloqueado_hasta_idx" ON "limite_intento"("bloqueado_hasta");

-- CreateIndex
CREATE INDEX "incidente_seguridad_estado_detectado_en_idx" ON "incidente_seguridad"("estado", "detectado_en");

-- CreateIndex
CREATE INDEX "employees_tenantId_cedulaHash_idx" ON "employees"("tenantId", "cedulaHash");


-- ================================================================
-- FASE 2 — SQL propio: solo-agregar, historial de cambios, límites
-- ================================================================

-- RLS en las tablas nuevas (sin políticas: solo servidor)
alter table public.auditoria enable row level security;
alter table public.historial_cambio enable row level security;
alter table public.limite_intento enable row level security;
alter table public.incidente_seguridad enable row level security;

-- ── 2.1 Tablas de solo agregar ─────────────────────────────────────
-- Nadie (tampoco la app) puede modificar ni borrar lo registrado.
create or replace function public.prohibir_modificacion() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es de solo agregar: no se permite %', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end $$;

drop trigger if exists solo_agregar on public.auditoria;
create trigger solo_agregar before update or delete on public.auditoria
  for each row execute function public.prohibir_modificacion();
drop trigger if exists solo_agregar_truncate on public.auditoria;
create trigger solo_agregar_truncate before truncate on public.auditoria
  for each statement execute function public.prohibir_modificacion();

drop trigger if exists solo_agregar on public.historial_cambio;
create trigger solo_agregar before update or delete on public.historial_cambio
  for each row execute function public.prohibir_modificacion();
drop trigger if exists solo_agregar_truncate on public.historial_cambio;
create trigger solo_agregar_truncate before truncate on public.historial_cambio
  for each statement execute function public.prohibir_modificacion();

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.auditoria, public.historial_cambio from %I', r);
    end if;
  end loop;
end $$;

-- ── 2.1 Historial de cambios con actor ─────────────────────────────
-- El actor sale de la sesión de Supabase (usuario_actual) o, para escrituras
-- con Prisma, de `select set_config('app.actor_id', '<users.id>', true)`
-- dentro de la misma transacción (helper conActor en src/lib/db/actor.ts).
create or replace function public.registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id text;
begin
  v_id := coalesce(
    v_fila ->> 'id',
    v_fila ->> 'clave',
    nullif(concat_ws(':',
      coalesce(v_fila ->> 'miembro_id', v_fila ->> 'rol_id', v_fila ->> 'user_id'),
      coalesce(v_fila ->> 'permiso_clave', v_fila ->> 'granja_id', v_fila ->> 'unidad_id')), ''));
  insert into public.historial_cambio (tabla, registro_id, operacion, antes, despues, actor_id)
  values (
    tg_table_name, coalesce(v_id, '?'), tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    coalesce(public.usuario_actual(), nullif(current_setting('app.actor_id', true), ''))
  );
  return null;
end $$;

-- Tablas de organización, equipo, permisos y configuración.
-- Las tablas financieras (Fase 8) y los documentos legales (Fase 4) se suman al crearse.
do $$
declare t text;
begin
  foreach t in array array[
    'tenants', 'granja', 'unidad_negocio',
    'miembro', 'miembro_granja', 'miembro_unidad', 'miembro_permiso',
    'rol', 'rol_permiso', 'admin_plataforma', 'invitacion',
    'config_metas', 'config_alertas', 'config_procesos', 'config_vacunas', 'config_genetica',
    'protocolos_sanitarios', 'protocolo_items', 'health_protocol_configs',
    'employees', 'payroll_records', 'incidente_seguridad'
  ] loop
    execute format('drop trigger if exists historial on public.%I', t);
    execute format('create trigger historial after insert or update or delete on public.%I for each row execute function public.registrar_cambio()', t);
  end loop;
end $$;

-- ── 2.3 Límite de intentos ─────────────────────────────────────────
-- Registra un intento para `p_clave`. Devuelve true si todavía está permitido.
-- Al llegar a `p_maximo` dentro de `p_ventana` bloquea; cada bloqueo seguido
-- duplica la espera (15 min, 30, 60… hasta 64 veces la ventana).
create or replace function public.consumir_intento(p_clave text, p_maximo int, p_ventana interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.limite_intento;
begin
  select * into r from public.limite_intento where clave = p_clave for update;
  if found and r.bloqueado_hasta is not null and r.bloqueado_hasta > now() then
    return false;
  end if;

  insert into public.limite_intento as l (clave, ventana_inicio, intentos, nivel)
  values (p_clave, now(), 1, 0)
  on conflict (clave) do update set
    intentos       = case when l.ventana_inicio < now() - p_ventana or l.bloqueado_hasta is not null then 1 else l.intentos + 1 end,
    ventana_inicio = case when l.ventana_inicio < now() - p_ventana or l.bloqueado_hasta is not null then now() else l.ventana_inicio end,
    bloqueado_hasta = null
  returning * into r;

  if r.intentos >= p_maximo then
    update public.limite_intento
       set bloqueado_hasta = now() + p_ventana * power(2, least(r.nivel, 6)),
           nivel = r.nivel + 1
     where clave = p_clave;
  end if;
  return true;
end $$;

-- ¿Está bloqueada la clave? Devuelve hasta cuándo, o null.
create or replace function public.bloqueado_hasta(p_clave text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select bloqueado_hasta from public.limite_intento where clave = p_clave and bloqueado_hasta > now()
$$;

-- Ingreso correcto: se olvida el historial de fallos de esa clave.
create or replace function public.limpiar_intentos(p_clave text) returns void
language sql security definer set search_path = public as $$
  delete from public.limite_intento where clave = p_clave
$$;

revoke all on function public.consumir_intento(text, int, interval), public.bloqueado_hasta(text), public.limpiar_intentos(text) from public;

-- ── Sin nombres personales en datos generados por el sistema ──────
-- Las tareas y la carga inicial de funcionarios usaban nombres de personas
-- como responsables; pasan a ser puestos (instrucción 6 del documento maestro).
update public.tasks set
  "responsableKey" = case "responsableKey"
    when 'erwin-segovia' then 'veterinario' when 'bartolome-vera' then 'gestacion'
    when 'graciela-duarte' then 'maternidad' when 'alex-almada' then 'produccion'
    when 'eric-acosta' then 'admin' else "responsableKey" end,
  "responsableNombre" = case "responsableKey"
    when 'erwin-segovia' then 'Veterinario' when 'bartolome-vera' then 'Encargado de Gestación'
    when 'graciela-duarte' then 'Encargado de Maternidad' when 'alex-almada' then 'Jefatura de Producción'
    when 'eric-acosta' then 'Administración' else "responsableNombre" end
where "responsableKey" in ('erwin-segovia', 'bartolome-vera', 'graciela-duarte', 'alex-almada', 'eric-acosta');

update public.tasks set "completadaPor" = 'Veterinario' where "completadaPor" = 'Dr. Erwin Segovia';
