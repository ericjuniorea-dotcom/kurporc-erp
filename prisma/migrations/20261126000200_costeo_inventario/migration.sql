-- Finanzas · costeo por etapa · Fase 4: inventario a costo promedio ponderado, salidas con etapa (y lote/motivo),
-- conteo físico mensual. Las reglas viven en la base: valen igual para toda pantalla que mueva stock.

-- 1) Columnas nuevas
ALTER TABLE "vacunas" ADD COLUMN IF NOT EXISTS "costo_promedio" DECIMAL(14,4);
ALTER TABLE "movimientos_inventario"
  ADD COLUMN IF NOT EXISTS "etapa_codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "lote_animal" TEXT,
  ADD COLUMN IF NOT EXISTS "motivo" TEXT,
  ADD COLUMN IF NOT EXISTS "costo_unitario" DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS "costo_gs" BIGINT,
  ADD COLUMN IF NOT EXISTS "conteo_id" UUID;
CREATE INDEX IF NOT EXISTS "movimientos_inventario_tenant_etapa_fecha_idx" ON "movimientos_inventario"("tenantId", "etapa_codigo", "fecha");

-- 2) Conteo físico mensual
CREATE TABLE IF NOT EXISTS "conteo_inventario" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" TEXT NOT NULL,
  "fecha" DATE NOT NULL,
  "mes" INTEGER NOT NULL,
  "valor_sistema_gs" BIGINT NOT NULL DEFAULT 0,
  "diferencia_gs" BIGINT NOT NULL DEFAULT 0,
  "creado_por" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conteo_inventario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conteo_inventario_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "conteo_inventario_tenant_mes_idx" ON "conteo_inventario"("tenant_id", "mes");
CREATE TABLE IF NOT EXISTS "conteo_inventario_item" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conteo_id" UUID NOT NULL,
  "producto_id" TEXT NOT NULL,
  "saldo_sistema" DECIMAL(12,3) NOT NULL,
  "contado" DECIMAL(12,3) NOT NULL,
  "diferencia" DECIMAL(12,3) NOT NULL,
  "costo_unitario" DECIMAL(14,4),
  "diferencia_gs" BIGINT NOT NULL DEFAULT 0,
  "motivo" TEXT,
  CONSTRAINT "conteo_inventario_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conteo_inventario_item_conteo_fkey" FOREIGN KEY ("conteo_id") REFERENCES "conteo_inventario"("id") ON DELETE CASCADE,
  CONSTRAINT "conteo_inventario_item_producto_fkey" FOREIGN KEY ("producto_id") REFERENCES "vacunas"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "conteo_inventario_item_conteo_idx" ON "conteo_inventario_item"("conteo_id");
ALTER TABLE "conteo_inventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conteo_inventario_item" ENABLE ROW LEVEL SECURITY;

-- 3) Costo promedio ponderado (R4). Todas las unidades en stock de un producto valen lo mismo: el promedio.
--    Al entrar una compra el promedio se recalcula; al salir, la salida se valoriza al promedio y éste no cambia.
--    El valor total del stock se conserva (Σ cantidad × costo). Los lotes sin costo toman el promedio.
create or replace function public.kp_costo_promedio(p_producto text) returns numeric
language plpgsql set search_path = public as $$
declare v_prom numeric;
begin
  select sum("cantidadActual" * "costoUnitario") / nullif(sum("cantidadActual"), 0) into v_prom
  from lotes_vacunas where "vacunaId" = p_producto and "cantidadActual" > 0 and "costoUnitario" is not null;
  if v_prom is null then
    select costo_promedio into v_prom from vacunas where id = p_producto; -- sin stock valorizado: se mantiene el último
    return v_prom;
  end if;
  v_prom := round(v_prom, 4);
  update lotes_vacunas set "costoUnitario" = v_prom
   where "vacunaId" = p_producto and "cantidadActual" > 0 and "costoUnitario" is distinct from v_prom;
  update vacunas set costo_promedio = v_prom where id = p_producto and costo_promedio is distinct from v_prom;
  return v_prom;
end $$;

create or replace function public.kp_lote_costo_promedio() returns trigger
language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return null; end if; -- el propio ajuste de costos no se vuelve a disparar
  perform public.kp_costo_promedio(new."vacunaId");
  return null;
end $$;
drop trigger if exists costo_promedio on public.lotes_vacunas;
create trigger costo_promedio after insert or update of "cantidadActual", "costoUnitario" on public.lotes_vacunas
  for each row execute function public.kp_lote_costo_promedio();

-- 4) Etapa de una salida según su origen (Nutrición, Vacunación, Tratamiento) o la etapa de consumo del ítem
create or replace function public.kp_etapa_de_salida(p_origen text, p_ref text, p_producto text) returns text
language plpgsql stable set search_path = public as $$
declare v text;
begin
  if p_origen = 'ALIMENTACION' then
    select case when t.modulo = 'GESTACION' then 'GES' when t.modulo like 'MATERNIDAD%' then 'MAT'
                when t.modulo = 'INICIACION' then 'DES' when t.modulo = 'ENGORDE' then 'ENG' end
      into v from feed_records r join feed_types t on t.id = r."feedTypeId" where r.id = p_ref;
  elsif p_origen = 'VACUNACION' then
    select case lower(e.sector) when 'gestacion' then 'GES' when 'maternidad' then 'MAT' when 'iniciacion' then 'DES'
                when 'recria' then 'DES' when 'engorde' then 'ENG' when 'cuarentena' then 'GES' when 'plantel' then 'GES' end
      into v from eventos_vacunacion e
     where e.id = p_ref or e.id = (select a."eventoId" from aplicaciones_vacunas a where a."grupoAplicacionId" = p_ref limit 1)
     limit 1;
  elsif p_origen = 'TRATAMIENTO' then
    select case when c."farrowingId" is not null or c."pigletId" is not null then 'MAT'
                when s."plantelState"::text = 'FARROWING' then 'MAT' when c."sowId" is not null then 'GES' end
      into v from curative_treatments c left join sows s on s.id = c."sowId" where c.id = p_ref;
  end if;
  if v is null then select etapa_consumo_codigo into v from vacunas where id = p_producto; end if;
  return v;
end $$;

-- 5) Cada movimiento de inventario queda valorizado y, si es salida o ajuste, con su etapa
create or replace function public.kp_valorizar_movimiento_inventario() returns trigger
language plpgsql set search_path = public as $$
declare v_costo numeric;
begin
  if new.costo_unitario is null then
    if new."loteId" is not null then select "costoUnitario" into v_costo from lotes_vacunas where id = new."loteId"; end if;
    if v_costo is null then select costo_promedio into v_costo from vacunas where id = new."productoId"; end if;
    new.costo_unitario := v_costo;
  end if;
  if new.costo_gs is null and new.costo_unitario is not null then
    new.costo_gs := round(abs(new.cantidad) * new.costo_unitario);
  end if;
  -- Consumos y sus devoluciones (anulaciones) llevan etapa; los ajustes de una recepción, no
  if new.etapa_codigo is null and (new.origen::text in ('ALIMENTACION', 'VACUNACION', 'TRATAMIENTO', 'MATERNIDAD') or new.tipo::text = 'SALIDA') then
    new.etapa_codigo := public.kp_etapa_de_salida(new.origen::text, new."referenciaId", new."productoId");
  end if;
  return new;
end $$;
drop trigger if exists valorizar on public.movimientos_inventario;
create trigger valorizar before insert on public.movimientos_inventario
  for each row execute function public.kp_valorizar_movimiento_inventario();

-- Etapa de consumo de vacunas, medicamentos y suplementos según a quién se aplican (editable en Catálogos de costos)
update vacunas set etapa_consumo_codigo = case lower(sector_destino) when 'lechon' then 'MAT' when 'cerda' then 'GES'
    when 'verraco' then 'GES' when 'plantel' then 'GES' when 'lote' then 'DES' end
 where etapa_consumo_codigo is null and categoria::text in ('VACUNA', 'MEDICAMENTO', 'SUPLEMENTO');

-- 6) Puesta en marcha: promedio de cada producto con stock (conserva el valor total) y etapa/valor de lo ya cargado
do $$ declare p record; begin
  for p in select distinct "vacunaId" as id from lotes_vacunas loop perform public.kp_costo_promedio(p.id); end loop;
end $$;
update movimientos_inventario m set etapa_codigo = public.kp_etapa_de_salida(m.origen::text, m."referenciaId", m."productoId")
 where m.etapa_codigo is null and (m.origen::text in ('ALIMENTACION', 'VACUNACION', 'TRATAMIENTO', 'MATERNIDAD') or m.tipo::text = 'SALIDA');
update movimientos_inventario m
   set costo_unitario = l."costoUnitario", costo_gs = round(abs(m.cantidad) * l."costoUnitario")
  from lotes_vacunas l
 where l.id = m."loteId" and m.costo_unitario is null and l."costoUnitario" is not null;
update movimientos_inventario m
   set costo_unitario = v.costo_promedio, costo_gs = round(abs(m.cantidad) * v.costo_promedio)
  from vacunas v
 where v.id = m."productoId" and m.costo_unitario is null and v.costo_promedio is not null;
