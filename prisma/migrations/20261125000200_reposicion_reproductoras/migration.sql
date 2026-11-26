-- Compra de reproductoras o verracos que reemplazan a otros que salen del plantel: es gasto de Gestación (GEN-03),
-- no inversión. La ampliación del plantel sigue en «Matrices y reproductores» (inversión, a proyecto).
insert into public.categoria_financiera (id, nombre, tipo, area, naturaleza, signo, unidad_default, subcategorias, grupo_tablero, grupo_costo, dieta, vida_util, orden, es_sistema)
select gen_random_uuid(), 'Reposición de reproductoras', 'GASTO', 'Producción', 'VARIABLE', -1, 'GRANJA', array['Reproductora','Verraco'], 'GENETICA', 'OTROS_DIRECTOS', null, null, 34, true
where not exists (select 1 from public.categoria_financiera where organizacion_id is null and nombre = 'Reposición de reproductoras');

update public.subcategoria_gasto
set nombres_anteriores = array_append(nombres_anteriores, 'Reposición de reproductoras')
where codigo = 'GEN-03' and not ('Reposición de reproductoras' = any(nombres_anteriores));
