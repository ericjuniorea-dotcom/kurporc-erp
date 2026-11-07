-- Fase 4 — Evidencia de aceptación inmutable y documentos publicados protegidos.
-- Requiere haber corrido `npm run db:legales`. Todo se deshace al final.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase4_contratos.sql

begin;

do $$
declare v_doc uuid; v_user text; v_borrador uuid;
begin
  select id into v_doc from documento_legal where codigo = 'TERMINOS' and estado = 'PUBLICADO' limit 1;
  if v_doc is null then raise exception '0: no hay TERMINOS publicado (¿corriste db:legales?)'; end if;
  select id into v_user from users limit 1;

  -- 1. La aceptación no se puede modificar ni borrar
  insert into aceptacion_documento (id, user_id, documento_id, codigo, version, hash_sha256, aceptado, texto_casilla)
  values (gen_random_uuid(), v_user, v_doc, 'TERMINOS', '1.0', repeat('a', 64), true, 'prueba');
  begin update aceptacion_documento set aceptado = false where user_id = v_user; raise exception '1: se pudo modificar una aceptación';
  exception when insufficient_privilege then null; end;
  begin delete from aceptacion_documento where user_id = v_user; raise exception '1: se pudo borrar una aceptación';
  exception when insufficient_privilege then null; end;

  -- 2. Un documento publicado no puede cambiar su texto ni borrarse
  begin update documento_legal set contenido_md = 'otro texto' where id = v_doc; raise exception '2: se pudo cambiar el texto publicado';
  exception when insufficient_privilege then null; end;
  begin delete from documento_legal where id = v_doc; raise exception '2: se pudo borrar un documento publicado';
  exception when insufficient_privilege then null; end;

  -- 3. Sí se puede retirarlo (cambiar estado) y marcar la aprobación del asesor
  update documento_legal set aprobado_por_asesor = true where id = v_doc;
  update documento_legal set estado = 'RETIRADO' where id = v_doc;

  -- 4. Un borrador se edita libremente
  insert into documento_legal (id, codigo, version, titulo, resumen, contenido_md, hash_sha256, estado)
  values (gen_random_uuid(), 'TERMINOS', '9.9', 'Prueba', 'r', 'texto', repeat('b', 64), 'BORRADOR') returning id into v_borrador;
  update documento_legal set contenido_md = 'texto corregido' where id = v_borrador;
  delete from documento_legal where id = v_borrador;

  -- 5. Los cambios de documentos quedan en el historial
  if not exists (select 1 from historial_cambio where tabla = 'documento_legal' and registro_id = v_doc::text and operacion = 'UPDATE') then
    raise exception '5: el cambio de estado no quedó en el historial';
  end if;
end $$;

-- 6. Un anónimo ve los documentos publicados y nada más
grant select on documento_legal, aceptacion_documento to anon;
set local role anon;
do $$ begin
  if (select count(*) from documento_legal where estado <> 'PUBLICADO') > 0 then raise exception '6: anónimo ve borradores'; end if;
  if (select count(*) from aceptacion_documento) > 0 then raise exception '6: anónimo ve aceptaciones'; end if;
end $$;
reset role;

select 'OK — contratos de la Fase 4 verificados' as resultado;
rollback;
