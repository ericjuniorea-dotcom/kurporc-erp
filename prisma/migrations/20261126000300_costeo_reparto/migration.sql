-- Finanzas · costeo por etapa · Fase 5: reparto de los gastos compartidos (CMP) al cerrar el mes.
-- Regla por concepto (subcategoría) y resultado por mes. El movimiento original no se toca: el reparto queda aparte
-- y se puede rehacer mientras el mes esté abierto.
CREATE TABLE IF NOT EXISTS "regla_reparto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "subcategoria_codigo" TEXT NOT NULL,          -- MOB-01… o '*' para el resto
  "criterio" TEXT NOT NULL,                     -- PERSONAL | POTENCIA | ANIMALES | PORCENTAJE | ETAPA
  "valores" JSONB NOT NULL DEFAULT '{}',        -- POTENCIA: kW por etapa; PORCENTAJE: % por etapa
  "etapa_codigo" TEXT,                          -- ETAPA: todo a esta etapa
  "actualizado_por" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "regla_reparto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "regla_reparto_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "regla_reparto_criterio_chk" CHECK ("criterio" IN ('PERSONAL','POTENCIA','ANIMALES','PORCENTAJE','ETAPA'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "regla_reparto_org_sub_key" ON "regla_reparto"("organizacion_id", "subcategoria_codigo");

CREATE TABLE IF NOT EXISTS "reparto_mes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "mes" INTEGER NOT NULL,
  "movimiento_id" UUID NOT NULL,
  "etapa_codigo" TEXT NOT NULL,
  "porcentaje" DECIMAL(7,4) NOT NULL,
  "monto_gs" BIGINT NOT NULL,
  "criterio" TEXT NOT NULL,
  "creado_por" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reparto_mes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reparto_mes_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "reparto_mes_mov_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimiento"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "reparto_mes_mov_etapa_key" ON "reparto_mes"("movimiento_id", "etapa_codigo");
CREATE INDEX IF NOT EXISTS "reparto_mes_org_mes_idx" ON "reparto_mes"("organizacion_id", "mes");
ALTER TABLE "regla_reparto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reparto_mes" ENABLE ROW LEVEL SECURITY;
