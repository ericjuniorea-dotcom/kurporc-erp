-- Fase 1 — Prueba de aislamiento entre organizaciones, permisos y unidades.
-- Corre todo dentro de una transacción y la deshace al final: no deja rastros.
-- Requiere haber corrido las migraciones y `npm run db:migrar-orgs`.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase1_aislamiento.sql
--
-- Cualquier falla lanza una excepción con el motivo. Si termina, imprime OK.

begin;

-- ── Preparación (como dueño de las tablas) ─────────────────────────
create temp table t_ctx (clave text primary key, valor text) on commit drop;
grant all on t_ctx to anon, authenticated;

do $$
declare
  v_org text; v_admin text; v_vet text; v_op text;
  v_unidad_a uuid; v_unidad_b uuid; v_org2 text; v_sow2 text;
begin
  select id into v_org from tenants order by "createdAt" limit 1;
  select m.user_id into v_admin from miembro m where m.organizacion_id = v_org and m.es_propietario limit 1;
  select m.user_id into v_vet from miembro m join rol r on r.id = m.rol_id where m.organizacion_id = v_org and r.codigo = 'VETERINARIO' limit 1;
  select m.user_id into v_op  from miembro m join rol r on r.id = m.rol_id where m.organizacion_id = v_org and r.codigo = 'OPERARIO' limit 1;
  if v_admin is null or v_vet is null or v_op is null then
    raise exception 'Faltan miembros de prueba (propietario, veterinario, operario). ¿Corriste db:migrar-orgs?';
  end if;

  update users set "authUserId" = '00000000-0000-0000-0000-00000000000a' where id = v_admin;
  update users set "authUserId" = '00000000-0000-0000-0000-00000000000b' where id = v_vet;
  update users set "authUserId" = '00000000-0000-0000-0000-00000000000c' where id = v_op;

  -- Dos unidades de negocio; el operario queda limitado a la A
  select id into v_unidad_a from unidad_negocio where organizacion_id = v_org and tipo = 'GRANJA' limit 1;
  insert into unidad_negocio (id, organizacion_id, codigo, nombre, tipo)
    values (gen_random_uuid(), v_org, 'GRANJA-PRUEBA-B', 'Granja de prueba B', 'GRANJA') returning id into v_unidad_b;
  update miembro set alcance_unidades = 'SELECCION' where organizacion_id = v_org and user_id = v_op;
  insert into miembro_unidad (miembro_id, unidad_id)
    select id, v_unidad_a from miembro where organizacion_id = v_org and user_id = v_op;

  -- Segunda organización con una cerda, sin miembros de la primera
  insert into tenants (id, slug, "farmName", "updatedAt") values ('org-prueba-b', 'org-prueba-b', 'Organización de prueba B', now()) returning id into v_org2;
  insert into sows (id, "tenantId", "identCode", "updatedAt") values ('sow-prueba-b', v_org2, 'PRUEBA-B-001', now()) returning id into v_sow2;

  insert into t_ctx values ('org', v_org), ('org2', v_org2), ('ua', v_unidad_a::text), ('ub', v_unidad_b::text);
end $$;

-- ── 1. Anónimo: no ve nada ─────────────────────────────────────────
set local role anon;
do $$ begin
  if (select count(*) from sows) <> 0 then raise exception '1: anónimo ve cerdas'; end if;
  if (select count(*) from tenants) <> 0 then raise exception '1: anónimo ve organizaciones'; end if;
  if (select count(*) from users) <> 0 then raise exception '1: anónimo ve usuarios'; end if;
  if (select count(*) from miembro) <> 0 then raise exception '1: anónimo ve miembros'; end if;
end $$;
do $$ begin
  begin
    insert into tasks (id, "tenantId", tipo, "fechaVencimiento", "updatedAt") values ('x', 'x', 'x', now(), now());
    raise exception '1: anónimo pudo insertar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ── 2. Usuario autenticado sin membresía: no ve nada ───────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', true);
do $$ begin
  if (select count(*) from sows) <> 0 then raise exception '2: usuario nuevo ve cerdas'; end if;
  if (select count(*) from tenants) <> 0 then raise exception '2: usuario nuevo ve organizaciones'; end if;
  if (select count(*) from tasks) <> 0 then raise exception '2: usuario nuevo ve tareas'; end if;
end $$;
reset role;

-- ── 3. Miembro: ve su organización y nunca la otra ─────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$
declare v_org text := (select valor from t_ctx where clave = 'org');
begin
  if (select count(*) from tenants) <> 1 then raise exception '3: el propietario no ve exactamente su organización'; end if;
  if exists (select 1 from sows where "tenantId" <> v_org) then raise exception '3: el propietario ve cerdas de otra organización'; end if;
  if exists (select 1 from sows where id = 'sow-prueba-b') then raise exception '3: fuga entre organizaciones'; end if;
  if (select count(*) from sows) <> (select count(*) from sows where "tenantId" = v_org) then raise exception '3: conteo inconsistente'; end if;
  if (select count(*) from users) <> 1 then raise exception '3: ve perfiles ajenos (debe usar v_companeros)'; end if;
  if (select count(*) from v_companeros) < 3 then raise exception '3: no ve a sus compañeros en v_companeros'; end if;
end $$;
reset role;

-- ── 4. tiene_permiso: solo propietario y veterinario liberan carencias ─
set local role authenticated;
do $$
declare v_org text := (select valor from t_ctx where clave = 'org');
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  if not tiene_permiso(v_org, 'sanidad.carencias.liberar') then raise exception '4: propietario sin permiso'; end if;
  if not tiene_permiso(v_org, 'equipo.propiedad.transferir') then raise exception '4: propietario sin permiso solo-propietario'; end if;
  if not es_superadmin() then raise exception '4: el Super Admin migrado no figura en admin_plataforma'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  if not tiene_permiso(v_org, 'sanidad.carencias.liberar') then raise exception '4: veterinario sin permiso'; end if;
  if tiene_permiso(v_org, 'equipo.propiedad.transferir') then raise exception '4: veterinario con permiso de propietario'; end if;
  if tiene_permiso(v_org, 'finanzas.tablero.ver') then raise exception '4: veterinario ve finanzas'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  if tiene_permiso(v_org, 'sanidad.carencias.liberar') then raise exception '4: operario libera carencias'; end if;
  if tiene_permiso(v_org, 'gestacion.servicios.editar') then raise exception '4: operario edita servicios'; end if;
  if not tiene_permiso(v_org, 'gestacion.servicios.crear') then raise exception '4: operario no puede registrar servicios'; end if;
  if es_superadmin() then raise exception '4: operario figura como Super Admin'; end if;
  if tiene_permiso((select valor from t_ctx where clave = 'org2'), 'tareas.tareas.ver') then raise exception '4: permiso en organización ajena'; end if;
end $$;
reset role;

-- ── 5. Alcance por unidad de negocio ───────────────────────────────
set local role authenticated;
do $$
declare
  v_org text := (select valor from t_ctx where clave = 'org');
  v_ua uuid := (select valor from t_ctx where clave = 'ua')::uuid;
  v_ub uuid := (select valor from t_ctx where clave = 'ub')::uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  if not tiene_permiso(v_org, 'tareas.tareas.ver', null, v_ua) then raise exception '5: operario no ve su unidad'; end if;
  if tiene_permiso(v_org, 'tareas.tareas.ver', null, v_ub) then raise exception '5: operario ve otra unidad'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  if not tiene_permiso(v_org, 'tareas.tareas.ver', null, v_ub) then raise exception '5: propietario limitado por unidad'; end if;
end $$;
reset role;

-- ── 6. Ajuste DENEGAR gana sobre el rol ────────────────────────────
insert into miembro_permiso (miembro_id, permiso_clave, efecto)
  select m.id, 'gestacion.servicios.crear', 'DENEGAR' from miembro m join users u on u.id = m.user_id
  where u."authUserId" = '00000000-0000-0000-0000-00000000000c';
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  if tiene_permiso((select valor from t_ctx where clave = 'org'), 'gestacion.servicios.crear') then raise exception '6: DENEGAR no tuvo efecto'; end if;
end $$;
reset role;

-- ── 7. RLS activo en todas las tablas ──────────────────────────────
do $$ declare n int; begin
  select count(*) into n from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity;
  if n > 0 then raise exception '7: % tabla(s) sin RLS', n; end if;
end $$;

select 'OK — aislamiento de la Fase 1 verificado' as resultado;
rollback;
