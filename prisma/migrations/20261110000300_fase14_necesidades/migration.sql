-- Fase 14 · Motor de necesidades: parámetros de compra y fotos del cálculo.

-- CreateTable
CREATE TABLE "parametro_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizacion_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'AUTO',
    "lead_time_dias" INTEGER NOT NULL DEFAULT 5,
    "seguridad_dias" INTEGER NOT NULL DEFAULT 7,
    "ciclo_compra_dias" INTEGER NOT NULL DEFAULT 7,
    "unidad_compra" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "merma_pct" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "userId" TEXT,

    CONSTRAINT "parametro_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "necesidad_snapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizacion_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "producto_catalogo_id" UUID,
    "metodo" TEXT NOT NULL,
    "stock_actual" DECIMAL(14,3) NOT NULL,
    "en_transito" DECIMAL(14,3) NOT NULL,
    "consumo_diario" DECIMAL(14,3) NOT NULL,
    "cobertura_dias" DECIMAL(8,1),
    "fecha_quiebre" DATE,
    "cantidad_sugerida" DECIMAL(14,3) NOT NULL,
    "urgencia" TEXT NOT NULL,
    "explicacion" TEXT NOT NULL,
    "proyeccion" JSONB NOT NULL DEFAULT '[]',
    "calculado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "necesidad_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametro_compra_organizacion_id_stock_item_id_key" ON "parametro_compra"("organizacion_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "necesidad_snapshot_organizacion_id_calculado_en_idx" ON "necesidad_snapshot"("organizacion_id", "calculado_en");

-- CreateIndex
CREATE INDEX "necesidad_snapshot_organizacion_id_stock_item_id_calculado__idx" ON "necesidad_snapshot"("organizacion_id", "stock_item_id", "calculado_en");

-- AddForeignKey
ALTER TABLE "parametro_compra" ADD CONSTRAINT "parametro_compra_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_compra" ADD CONSTRAINT "parametro_compra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necesidad_snapshot" ADD CONSTRAINT "necesidad_snapshot_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necesidad_snapshot" ADD CONSTRAINT "necesidad_snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


alter table "parametro_compra" add constraint "parametro_compra_ck" check (
  "metodo" in ('AUTO', 'RACION', 'PROGRAMADO', 'HISTORICO', 'NO_PREDECIR')
  and "lead_time_dias" between 0 and 120 and "seguridad_dias" between 0 and 120 and "ciclo_compra_dias" between 0 and 120
  and "unidad_compra" > 0 and "merma_pct" >= 0 and "merma_pct" < 0.9);
alter table "necesidad_snapshot" add constraint "necesidad_urgencia_ck" check ("urgencia" in ('CRITICA', 'PRONTO', 'OK', 'SIN_DATOS'));

do $do$
declare t text; r text;
begin
  foreach t in array array['parametro_compra', 'necesidad_snapshot'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end $do$;
