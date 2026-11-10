-- Lista previa al lanzamiento (Anexo F.1): las funciones de trigger con SECURITY DEFINER no se
-- ejecutan directamente desde la API. Los triggers siguen funcionando (no se revisa EXECUTE al dispararse).
do $do$
declare f text; r text;
begin
  foreach f in array array['public.recalcular_calificacion_tienda()', 'public.registrar_cambio()', 'public.registrar_evento_pedido()'] loop
    execute format('revoke execute on function %s from public', f);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke execute on function %s from %I', f, r);
      end if;
    end loop;
  end loop;
end $do$;
