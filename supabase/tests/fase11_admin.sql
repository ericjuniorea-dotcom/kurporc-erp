-- Fase 11 — Super administradores solo con autorización de un TOTAL; accesos inmutables. Todo se deshace al final.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase11_admin.sql

begin;

do $$
declare v_total text; v_comun text; v_nuevo text; v_acceso uuid;
begin
  select user_id into v_total from admin_plataforma where nivel = 'TOTAL' limit 1;
  if v_total is null then
    -- Base vacía (CI): se siembra un TOTAL de prueba salteando el control, solo dentro de esta transacción
    insert into users (id, email, name, "updatedAt") values ('prueba-f11-total', 'total.f11@prueba.test', 'Total', now()) returning id into v_total;
    perform set_config('session_replication_role', 'replica', true);
    insert into admin_plataforma (user_id, nivel) values (v_total, 'TOTAL');
    perform set_config('session_replication_role', 'origin', true);
  end if;
  select id into v_comun from users where id not in (select user_id from admin_plataforma) limit 1;
  if v_comun is null then
    insert into users (id, email, name, "updatedAt") values ('prueba-f11-comun', 'comun.f11@prueba.test', 'Común', now()) returning id into v_comun;
  end if;
  insert into users (id, email, name, "updatedAt") values ('prueba-f11-nuevo', 'nuevo.f11@prueba.test', 'Nuevo', now()) returning id into v_nuevo;

  -- 1. Sin actor nadie se autoriza a sí mismo
  perform set_config('app.actor_id', '', true);
  begin
    insert into admin_plataforma (user_id, nivel) values (v_nuevo, 'TOTAL');
    raise exception '1: se creó un super administrador sin autorización';
  exception when insufficient_privilege then null; end;

  -- 2. Un usuario común tampoco puede autorizar
  perform set_config('app.actor_id', v_comun, true);
  begin
    insert into admin_plataforma (user_id, nivel) values (v_nuevo, 'SOPORTE');
    raise exception '2: un usuario común autorizó a un administrador';
  exception when insufficient_privilege then null; end;
  begin
    insert into admin_plataforma (user_id, nivel) values (v_comun, 'TOTAL');
    raise exception '2: un usuario común se nombró super administrador';
  exception when insufficient_privilege then null; end;

  -- 3. Un administrador TOTAL sí, y queda quién lo autorizó
  perform set_config('app.actor_id', v_total, true);
  insert into admin_plataforma (user_id, nivel) values (v_nuevo, 'SOPORTE');
  if (select otorgado_por from admin_plataforma where user_id = v_nuevo) <> v_total then
    raise exception '3: no quedó registrado quién lo autorizó';
  end if;
  if not exists (select 1 from historial_cambio where tabla = 'admin_plataforma' and registro_id = v_nuevo) then
    raise exception '3: el alta no quedó en el historial';
  end if;

  -- 4. Un SOPORTE no puede autorizar a otros
  perform set_config('app.actor_id', v_nuevo, true);
  begin
    update admin_plataforma set nivel = 'TOTAL' where user_id = v_nuevo;
    raise exception '4: un SOPORTE se subió a TOTAL';
  exception when insufficient_privilege then null; end;

  -- 5. Nunca queda la plataforma sin un TOTAL
  perform set_config('app.actor_id', v_total, true);
  delete from admin_plataforma where nivel = 'TOTAL' and user_id <> v_total;
  begin
    delete from admin_plataforma where user_id = v_total;
    raise exception '5: se borró al último administrador TOTAL';
  exception when raise_exception then if sqlerrm like '5:%' then raise; end if; end;

  -- 6. El registro de accesos no se modifica ni se borra
  insert into acceso_plataforma (id, admin_id, organizacion_id, seccion, motivo) values (gen_random_uuid(), v_total, null, '/admin', 'SOPORTE') returning id into v_acceso;
  begin update acceso_plataforma set motivo = 'OTRO' where id = v_acceso; raise exception '6: se modificó un acceso';
  exception when insufficient_privilege then null; end;
  begin delete from acceso_plataforma where id = v_acceso; raise exception '6: se borró un acceso';
  exception when insufficient_privilege then null; end;

  raise notice 'OK — control de super administradores (Fase 11) verificado';
end $$;

rollback;
