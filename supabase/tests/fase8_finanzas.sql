-- Fase 8 — Reglas del libro de movimientos. Todo se deshace al final.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase8_finanzas.sql

begin;

do $$
declare
  v_org text; v_user text; v_unidad uuid; v_gasto uuid; v_ingreso uuid; v_mov uuid; v_venta uuid;
  v_mov_estado text; v_mes int; v_signo int; v_precio numeric;
begin
  select id into v_org from tenants limit 1;
  select id into v_user from users limit 1;
  insert into unidad_negocio (id, organizacion_id, codigo, nombre, tipo) values (gen_random_uuid(), v_org, 'PRUEBA-F8', 'Prueba', 'GRANJA') returning id into v_unidad;
  select id into v_gasto from categoria_financiera where organizacion_id is null and nombre = 'Balanceado de gestación';
  select id into v_ingreso from categoria_financiera where organizacion_id is null and nombre = 'Venta de lechones';
  if v_gasto is null or v_ingreso is null then raise exception '0: faltan las categorías del sistema'; end if;

  -- 1. Las columnas automáticas se completan solas (mes, signo, naturaleza, precio unitario)
  insert into movimiento (id, organizacion_id, unidad_id, fecha, tipo, concepto, categoria_id, cantidad, monto_gs, estado, creado_por, updated_at)
  values (gen_random_uuid(), v_org, v_unidad, '2026-09-15', 'GASTO', 'Prueba balanceado', v_gasto, 1000, 3500000, 'PENDIENTE', v_user, now())
  returning id, mes, signo, precio_unitario_gs into v_mov, v_mes, v_signo, v_precio;
  if v_mes <> 202609 or v_signo <> -1 or v_precio <> 3500 then raise exception '1: automáticos mal (mes %, signo %, precio %)', v_mes, v_signo, v_precio; end if;
  if (select naturaleza::text from movimiento where id = v_mov) <> 'VARIABLE' then raise exception '1: naturaleza no copiada'; end if;

  -- 2. La categoría tiene que corresponder al tipo
  begin
    insert into movimiento (id, organizacion_id, unidad_id, fecha, tipo, concepto, categoria_id, monto_gs, estado, creado_por, updated_at)
    values (gen_random_uuid(), v_org, v_unidad, '2026-09-15', 'INGRESO', 'mal', v_gasto, 10, 'POR_COBRAR', v_user, now());
    raise exception '2: aceptó una categoría de gasto en un ingreso';
  exception when raise_exception then if sqlerrm like '2:%' then raise; end if; end;

  -- 3. Pago parcial: sigue pendiente; pago del resto: queda pagado
  insert into pago_movimiento (id, movimiento_id, fecha_pago, monto_gs, creado_por) values (gen_random_uuid(), v_mov, '2026-09-20', 1500000, v_user);
  select estado::text into v_mov_estado from movimiento where id = v_mov;
  if v_mov_estado <> 'PENDIENTE' then raise exception '3: con pago parcial quedó %', v_mov_estado; end if;
  if (select saldo_gs from v_movimiento_saldo where id = v_mov) <> 2000000 then raise exception '3: saldo mal calculado'; end if;
  begin
    insert into pago_movimiento (id, movimiento_id, fecha_pago, monto_gs, creado_por) values (gen_random_uuid(), v_mov, '2026-09-21', 2000001, v_user);
    raise exception '3: aceptó un pago mayor al saldo';
  exception when raise_exception then if sqlerrm like '3:%' then raise; end if; end;
  insert into pago_movimiento (id, movimiento_id, fecha_pago, monto_gs, creado_por) values (gen_random_uuid(), v_mov, '2026-09-25', 2000000, v_user);
  select estado::text into v_mov_estado from movimiento where id = v_mov;
  if v_mov_estado <> 'PAGADO' then raise exception '3: con el total pagado quedó %', v_mov_estado; end if;

  -- 4. Un ingreso cobrado queda COBRADO
  insert into movimiento (id, organizacion_id, unidad_id, fecha, tipo, concepto, categoria_id, monto_gs, estado, creado_por, updated_at)
  values (gen_random_uuid(), v_org, v_unidad, '2026-09-10', 'INGRESO', 'Venta prueba', v_ingreso, 4350000, 'POR_COBRAR', v_user, now()) returning id into v_venta;
  insert into pago_movimiento (id, movimiento_id, fecha_pago, monto_gs, creado_por) values (gen_random_uuid(), v_venta, '2026-09-12', 4350000, v_user);
  if (select estado::text from movimiento where id = v_venta) <> 'COBRADO' then raise exception '4: el ingreso no quedó cobrado'; end if;

  -- 5. No se borra: ni el movimiento ni el pago
  begin delete from movimiento where id = v_mov; raise exception '5: se pudo borrar un movimiento';
  exception when raise_exception then if sqlerrm like '5:%' then raise; end if; end;
  begin delete from pago_movimiento where movimiento_id = v_mov; raise exception '5: se pudo borrar un pago';
  exception when raise_exception then if sqlerrm like '5:%' then raise; end if; end;

  -- 6. Un anulado no se toca ni recibe pagos
  insert into movimiento (id, organizacion_id, unidad_id, fecha, tipo, concepto, categoria_id, monto_gs, estado, creado_por, updated_at)
  values (gen_random_uuid(), v_org, v_unidad, '2026-09-11', 'GASTO', 'a anular', v_gasto, 100, 'PENDIENTE', v_user, now()) returning id into v_mov;
  update movimiento set estado = 'ANULADO', motivo_anulacion = 'cargado dos veces' where id = v_mov;
  begin update movimiento set monto_gs = 200 where id = v_mov; raise exception '6: se pudo modificar un anulado';
  exception when raise_exception then if sqlerrm like '6:%' then raise; end if; end;
  begin insert into pago_movimiento (id, movimiento_id, fecha_pago, monto_gs, creado_por) values (gen_random_uuid(), v_mov, '2026-09-12', 100, v_user);
    raise exception '6: aceptó un pago sobre un anulado';
  exception when raise_exception then if sqlerrm like '6:%' then raise; end if; end;

  -- 7. Mes cerrado: no acepta movimientos nuevos ni cambios
  insert into cierre_mes (id, organizacion_id, mes, estado) values (gen_random_uuid(), v_org, 202608, 'CERRADO');
  begin
    insert into movimiento (id, organizacion_id, unidad_id, fecha, tipo, concepto, categoria_id, monto_gs, estado, creado_por, updated_at)
    values (gen_random_uuid(), v_org, v_unidad, '2026-08-20', 'GASTO', 'en mes cerrado', v_gasto, 100, 'PENDIENTE', v_user, now());
    raise exception '7: aceptó un movimiento en un mes cerrado';
  exception when raise_exception then if sqlerrm like '7:%' then raise; end if; end;
  begin update movimiento set fecha = '2026-08-05' where id = v_venta; raise exception '7: se pudo mover un movimiento a un mes cerrado';
  exception when raise_exception then if sqlerrm like '7:%' then raise; end if; end;

  -- 8. Los cambios quedan en el historial
  if not exists (select 1 from historial_cambio where tabla = 'movimiento' and registro_id = v_venta::text) then
    raise exception '8: el movimiento no quedó en el historial';
  end if;

  raise notice 'OK — reglas del libro de movimientos (Fase 8) verificadas';
end $$;

-- 9. Las API de Supabase no ven las tablas financieras
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_table_privilege('authenticated', 'public.movimiento', 'select') then
    raise exception '9: el rol authenticated puede leer movimiento';
  end if;
end $$;

rollback;
