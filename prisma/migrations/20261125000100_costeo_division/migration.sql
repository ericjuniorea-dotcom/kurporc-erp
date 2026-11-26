-- Finanzas · costeo por etapa · Fase 3: «Dividir entre etapas». Un gasto que sirve a varias etapas se reparte por
-- porcentajes que suman exactamente 100 %; el monto de cada parte queda guardado (la última absorbe el redondeo).
CREATE TABLE IF NOT EXISTS "movimiento_etapa" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "movimiento_id" UUID NOT NULL,
  "etapa_codigo" TEXT NOT NULL,
  "porcentaje" DECIMAL(5,2) NOT NULL,
  "monto_gs" BIGINT NOT NULL,
  CONSTRAINT "movimiento_etapa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "movimiento_etapa_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "movimiento_etapa_mov_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimiento"("id") ON DELETE CASCADE,
  CONSTRAINT "movimiento_etapa_pct_chk" CHECK ("porcentaje" > 0 AND "porcentaje" <= 100),
  CONSTRAINT "movimiento_etapa_monto_chk" CHECK ("monto_gs" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "movimiento_etapa_movimiento_id_etapa_codigo_key" ON "movimiento_etapa"("movimiento_id", "etapa_codigo");
CREATE INDEX IF NOT EXISTS "movimiento_etapa_organizacion_id_etapa_codigo_idx" ON "movimiento_etapa"("organizacion_id", "etapa_codigo");
ALTER TABLE "movimiento_etapa" ENABLE ROW LEVEL SECURITY;
