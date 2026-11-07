-- Fase 2 — Pruebas de auditoría, historial de cambios y límite de intentos.
-- Todo dentro de una transacción que se deshace al final.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase2_seguridad.sql

begin;

-- ── 1. auditoria e historial_cambio son de solo agregar (incluso para el dueño) ─
insert into auditoria (id, accion, entidad) values (gen_random_uuid(), 'PRUEBA', 'prueba');
do $$ begin
  begin update auditoria set accion = 'X' where accion = 'PRUEBA'; raise exception '1: se pudo hacer UPDATE en auditoria';
  exception when insufficient_privilege then null; end;
  begin delete from auditoria where accion = 'PRUEBA'; raise exception '1: se pudo hacer DELETE en auditoria';
  exception when insufficient_privilege then null; end;
  begin truncate auditoria; raise exception '1: se pudo hacer TRUNCATE en auditoria';
  exception when insufficient_privilege then null; end;
  begin update historial_cambio set operacion = 'X'; raise exception '1: se pudo hacer UPDATE en historial_cambio';
  exception when insufficient_privilege then null; end;
  begin delete from historial_cambio; raise exception '1: se pudo hacer DELETE en historial_cambio';
  exception when insufficient_privilege then null; end;
end $$;

-- ── 2. Un cambio hecho "con Prisma" (sin sesión) registra el actor de app.actor_id ─
do $$
declare v_miembro uuid; v_actor text; v_antes bigint; r historial_cambio;
begin
  select m.id, m.user_id into v_miembro, v_actor from miembro m where m.es_propietario limit 1;
  if v_miembro is null then raise exception '2: no hay miembros (¿corriste db:migrar-orgs?)'; end if;
  select coalesce(max(id), 0) into v_antes from historial_cambio;

  perform set_config('app.actor_id', v_actor, true);
  update miembro set cargo = 'Cargo de prueba' where id = v_miembro;

  select * into r from historial_cambio where id > v_antes and tabla = 'miembro' order by id desc limit 1;
  if r.id is null then raise exception '2: el UPDATE no dejó historial'; end if;
  if r.operacion <> 'UPDATE' then raise exception '2: operación incorrecta: %', r.operacion; end if;
  if r.actor_id is distinct from v_actor then raise exception '2: actor incorrecto: % (esperado %)', r.actor_id, v_actor; end if;
  if r.registro_id <> v_miembro::text then raise exception '2: registro_id incorrecto'; end if;
  if (r.despues ->> 'cargo') <> 'Cargo de prueba' then raise exception '2: falta el valor nuevo'; end if;
  if (r.antes ->> 'cargo') is not distinct from 'Cargo de prueba' then raise exception '2: falta el valor anterior'; end if;

  -- Tablas con clave compuesta también quedan identificadas
  insert into miembro_permiso (miembro_id, permiso_clave, efecto) values (v_miembro, 'tareas.tareas.ver', 'DENEGAR');
  select * into r from historial_cambio where tabla = 'miembro_permiso' order by id desc limit 1;
  if r.registro_id <> v_miembro::text || ':tareas.tareas.ver' then raise exception '2: registro_id compuesto incorrecto: %', r.registro_id; end if;
  delete from miembro_permiso where miembro_id = v_miembro and permiso_clave = 'tareas.tareas.ver';
  select * into r from historial_cambio where tabla = 'miembro_permiso' order by id desc limit 1;
  if r.operacion <> 'DELETE' or r.antes is null then raise exception '2: el DELETE no quedó registrado'; end if;
end $$;

-- ── 3. Límite de intentos: 5 fallos en 15 min bloquean; el siguiente bloqueo dura el doble ─
do $$
declare v_hasta timestamptz; v_hasta2 timestamptz; i int;
begin
  for i in 1..4 loop
    perform consumir_intento('prueba:clave', 5, interval '15 minutes');
  end loop;
  if bloqueado_hasta('prueba:clave') is not null then raise exception '3: bloqueó antes de 5 fallos'; end if;

  perform consumir_intento('prueba:clave', 5, interval '15 minutes');   -- 5.º fallo
  v_hasta := bloqueado_hasta('prueba:clave');
  if v_hasta is null then raise exception '3: el 5.º fallo no bloqueó'; end if;
  if v_hasta < now() + interval '14 minutes' or v_hasta > now() + interval '16 minutes' then
    raise exception '3: el primer bloqueo no dura 15 min: %', v_hasta - now();
  end if;
  if consumir_intento('prueba:clave', 5, interval '15 minutes') then raise exception '3: el 6.º intento no quedó bloqueado'; end if;

  -- Simular que pasó el bloqueo y vuelve a fallar 5 veces
  update limite_intento set bloqueado_hasta = now() - interval '1 second' where clave = 'prueba:clave';
  for i in 1..5 loop perform consumir_intento('prueba:clave', 5, interval '15 minutes'); end loop;
  v_hasta2 := bloqueado_hasta('prueba:clave');
  if v_hasta2 is null or v_hasta2 < now() + interval '29 minutes' then
    raise exception '3: el segundo bloqueo no duplica la espera: %', v_hasta2 - now();
  end if;

  perform limpiar_intentos('prueba:clave');
  if bloqueado_hasta('prueba:clave') is not null then raise exception '3: limpiar_intentos no desbloqueó'; end if;
end $$;

-- ── 4. Tablas de la Fase 2 cerradas para la API ────────────────────
do $$ declare n int; begin
  select count(*) into n from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'
    and relname in ('auditoria', 'historial_cambio', 'limite_intento', 'incidente_seguridad') and not relrowsecurity;
  if n > 0 then raise exception '4: % tabla(s) de la Fase 2 sin RLS', n; end if;
  if exists (select 1 from pg_policies where tablename in ('auditoria', 'historial_cambio', 'limite_intento', 'incidente_seguridad')) then
    raise exception '4: hay políticas sobre tablas que deben ser solo del servidor';
  end if;
end $$;

select 'OK — seguridad de la Fase 2 verificada' as resultado;
rollback;
