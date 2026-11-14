-- Fase 15 — Buzón (reglas de la tabla, votos, permisos) y latido de uso. Todo se deshace al final.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase15_buzon.sql

begin;

do $$
declare v_id uuid; r text;
begin
  -- 1. Función nueva sin título, problema o cómo funcionaría → falla
  begin
    insert into sugerencia (usuario_id, tipo, mensaje, updated_at) values ('prueba-f15', 'FUNCION_NUEVA', 'algo que quiero', now());
    raise exception '1: se guardó una función nueva sin título';
  exception when check_violation then null; end;
  begin
    insert into sugerencia (usuario_id, tipo, mensaje, titulo, problema, updated_at) values ('prueba-f15', 'FUNCION_NUEVA', 'algo que quiero', 'Título', 'Problema largo', now());
    raise exception '1: se guardó una función nueva sin «cómo funcionaría»';
  exception when check_violation then null; end;
  insert into sugerencia (usuario_id, organizacion_id, tipo, mensaje, titulo, problema, como_funcionaria, updated_at)
  values ('prueba-f15', 'org-f15', 'FUNCION_NUEVA', 'Alertas', 'Alertas', 'Se me pasan los celos', 'Un aviso por WhatsApp', now()) returning id into v_id;

  -- 2. Publicada sin texto público → falla
  begin
    update sugerencia set publica = true where id = v_id;
    raise exception '2: se publicó sin título ni descripción públicos';
  exception when check_violation then null; end;
  begin
    update sugerencia set publica = true, titulo_publico = 'Alertas de celo' where id = v_id;
    raise exception '2: se publicó sin descripción pública';
  exception when check_violation then null; end;
  update sugerencia set publica = true, titulo_publico = 'Alertas de celo', descripcion_publica = 'Aviso cuando una cerda entra en celo' where id = v_id;

  -- Prioridad y estado fuera de la lista → fallan
  begin update sugerencia set prioridad = 'URGENTE' where id = v_id; raise exception 'prioridad inválida aceptada';
  exception when check_violation then null; end;
  begin update sugerencia set estado = 'PAUSADA' where id = v_id; raise exception 'estado inválido aceptado';
  exception when check_violation then null; end;
  update sugerencia set estado = 'EN_DESARROLLO', prioridad = 'ALTA' where id = v_id;

  -- 3. Voto duplicado de la misma persona → falla
  insert into sugerencia_voto (sugerencia_id, usuario_id, organizacion_id) values (v_id, 'prueba-f15-b', 'org-f15-b');
  begin
    insert into sugerencia_voto (sugerencia_id, usuario_id, organizacion_id) values (v_id, 'prueba-f15-b', 'org-f15-b');
    raise exception '3: se aceptó un voto duplicado';
  exception when unique_violation then null; end;

  -- Borrar el mensaje borra sus votos
  delete from sugerencia where id = v_id;
  if exists (select 1 from sugerencia_voto where sugerencia_id = v_id) then raise exception 'quedaron votos huérfanos'; end if;

  -- 4. anon y authenticated no leen el buzón (si los roles existen)
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      if has_table_privilege(r, 'public.sugerencia', 'select') then raise exception '4: % lee sugerencia', r; end if;
      if has_table_privilege(r, 'public.sugerencia_voto', 'select') then raise exception '4: % lee sugerencia_voto', r; end if;
    end if;
  end loop;

  raise notice 'Fase 15 · buzón: todo bien';
end $$;

rollback;
