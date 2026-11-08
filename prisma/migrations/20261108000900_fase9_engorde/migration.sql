-- AlterTable
ALTER TABLE "growing_batches" ADD COLUMN     "alimentoLoProvee" TEXT NOT NULL DEFAULT 'PROPIO',
ADD COLUMN     "costoIngresoGs" BIGINT,
ADD COLUMN     "curvaId" TEXT,
ADD COLUMN     "genetica" TEXT,
ADD COLUMN     "integradorId" TEXT,
ADD COLUMN     "modalidad" TEXT NOT NULL DEFAULT 'PROPIO',
ADD COLUMN     "pagoIntegracion" TEXT,
ADD COLUMN     "sexo" TEXT,
ADD COLUMN     "tarifaIntegracionGs" BIGINT;

-- AlterTable
ALTER TABLE "parametros_financieros" ADD COLUMN     "porcentaje_estructura_engorde" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "precio_transferencia_lechon" TEXT NOT NULL DEFAULT 'MERCADO';

-- AlterTable
ALTER TABLE "venta" ADD COLUMN     "descuentos_gs" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "flete_gs" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "kg_canal" DECIMAL(12,2),
ADD COLUMN     "rendimiento_pct" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "withdrawal_periods" ADD COLUMN     "animales" INTEGER,
ADD COLUMN     "costoGs" BIGINT,
ADD COLUMN     "growingBatchId" TEXT,
ADD COLUMN     "mlAplicados" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "curva_engorde" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puntos" JSONB NOT NULL,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curva_engorde_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curva_engorde_organizacion_id_idx" ON "curva_engorde"("organizacion_id");

-- AddForeignKey
ALTER TABLE "withdrawal_periods" ADD CONSTRAINT "withdrawal_periods_growingBatchId_fkey" FOREIGN KEY ("growingBatchId") REFERENCES "growing_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


alter table public.curva_engorde enable row level security;
create policy org_select on public.curva_engorde for select to authenticated using (organizacion_id in (select public.mis_orgs()));
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then execute format('revoke all on public.curva_engorde from %I', r); end if;
  end loop;
end $$;
