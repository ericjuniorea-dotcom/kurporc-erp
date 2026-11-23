-- Finanzas · costeo por etapa · Fase 2: cada movimiento lleva su subcategoría de gasto, su etapa (o proyecto, si es
-- inversión) y una marca de «pendiente de revisión». La categoría anterior se conserva intacta.
ALTER TABLE "movimiento"
  ADD COLUMN IF NOT EXISTS "subcategoria_gasto_id" UUID,
  ADD COLUMN IF NOT EXISTS "etapa_codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "proyecto_id" UUID,
  ADD COLUMN IF NOT EXISTS "revision_pendiente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "motivo_revision" TEXT,
  ADD COLUMN IF NOT EXISTS "clasificado_por" TEXT,
  ADD COLUMN IF NOT EXISTS "clasificado_en" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_subcategoria_gasto_fkey" FOREIGN KEY ("subcategoria_gasto_id") REFERENCES "subcategoria_gasto"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_proyecto_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto_inversion"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "movimiento_organizacion_id_revision_pendiente_idx" ON "movimiento"("organizacion_id", "revision_pendiente");
CREATE INDEX IF NOT EXISTS "movimiento_organizacion_id_etapa_codigo_mes_idx" ON "movimiento"("organizacion_id", "etapa_codigo", "mes");

-- Clasificar (subcategoría, etapa, proyecto, revisión) no cambia importes: se permite también en movimientos
-- anulados y en meses cerrados. Cualquier otro cambio sigue con las reglas de siempre.
create or replace function public.completar_movimiento() returns trigger
language plpgsql set search_path = public as $$
declare c record;
declare solo_clasificacion constant text[] := array['subcategoria_gasto_id', 'etapa_codigo', 'proyecto_id', 'revision_pendiente',
  'motivo_revision', 'clasificado_por', 'clasificado_en', 'updated_at'];
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - solo_clasificacion) = (to_jsonb(new) - solo_clasificacion) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.estado = 'ANULADO' then
    raise exception 'Un movimiento anulado no se modifica';
  end if;
  if tg_op = 'UPDATE' and old.organizacion_id <> new.organizacion_id then
    raise exception 'Un movimiento no cambia de organización';
  end if;
  new.mes := extract(year from new.fecha)::int * 100 + extract(month from new.fecha)::int;
  if public.mes_cerrado(new.organizacion_id, new.mes)
     or (tg_op = 'UPDATE' and public.mes_cerrado(old.organizacion_id, old.mes)) then
    raise exception 'El mes % está cerrado: reabrilo para hacer cambios', new.mes;
  end if;
  select tipo, naturaleza, area, signo, organizacion_id into c from public.categoria_financiera where id = new.categoria_id;
  if not found or (c.organizacion_id is not null and c.organizacion_id <> new.organizacion_id) then
    raise exception 'Categoría inexistente para esta organización';
  end if;
  if c.tipo <> new.tipo then
    raise exception 'La categoría no corresponde al tipo de movimiento';
  end if;
  new.naturaleza := c.naturaleza;
  new.area := c.area;
  new.signo := c.signo;
  new.precio_unitario_gs := case when new.cantidad is not null and new.cantidad > 0 then round(new.monto_gs / new.cantidad, 2) end;
  new.ml_comprados := case when new.cantidad is not null and new.ml_por_unidad is not null then new.cantidad * new.ml_por_unidad end;
  return new;
end $$;
