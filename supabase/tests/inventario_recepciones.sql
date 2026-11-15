-- Inventario · recepciones de compras: reglas de la tabla y permisos. Todo se deshace al final.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/inventario_recepciones.sql
begin;
do $$
declare v_prod text := 'prueba-inv-prod'; r text;
begin
  insert into vacunas (id, "tenantId", nombre, enfermedad, sector_destino, categoria, "unidadMedida", "updatedAt")
  values (v_prod, 'org-prueba-inv', 'Balanceado prueba', '', 'lote', 'BALANCEADO', 'KG', now());

  begin
    insert into recepcion_inventario (tenant_id, producto_id, cantidad, comprado_por) values ('org-prueba-inv', v_prod, 0, 'u');
    raise exception 'se aceptó una recepción de cantidad 0';
  exception when check_violation then null; end;
  begin
    insert into recepcion_inventario (tenant_id, producto_id, cantidad, comprado_por, estado) values ('org-prueba-inv', v_prod, 10, 'u', 'PERDIDA');
    raise exception 'se aceptó un estado inválido';
  exception when check_violation then null; end;
  insert into recepcion_inventario (tenant_id, producto_id, cantidad, comprado_por) values ('org-prueba-inv', v_prod, 500, 'u');
  if (select estado from recepcion_inventario where producto_id = v_prod) <> 'PENDIENTE' then raise exception 'la recepción no nace pendiente'; end if;

  -- Un producto con recepciones no se puede borrar de golpe (se anula)
  begin
    delete from vacunas where id = v_prod;
    raise exception 'se borró un producto con recepciones';
  exception when restrict_violation or foreign_key_violation then null; end;

  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) and has_table_privilege(r, 'public.recepcion_inventario', 'select') then
      raise exception '% lee recepcion_inventario', r;
    end if;
  end loop;
  raise notice 'Inventario · recepciones: todo bien';
end $$;
rollback;
