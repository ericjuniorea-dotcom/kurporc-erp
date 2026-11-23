-- Finanzas · costeo por etapa · Fase 1: catálogos por organización (etapas, categorías, subcategorías, proyectos)
CREATE TABLE IF NOT EXISTS "etapa_costo" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "incluye" TEXT NOT NULL DEFAULT '',
  "unidad_costeo" TEXT NOT NULL DEFAULT '',
  "rol_responsable" TEXT NOT NULL DEFAULT '',
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "etapa_costo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "etapa_costo_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "etapa_costo_tipo_chk" CHECK ("tipo" IN ('PRODUCTIVA','APOYO','ESTRUCTURA','FINANCIERA','INVERSION','PENDIENTE_REPARTO'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "etapa_costo_organizacion_id_codigo_key" ON "etapa_costo"("organizacion_id", "codigo");

CREATE TABLE IF NOT EXISTS "categoria_gasto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "categoria_gasto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categoria_gasto_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "categoria_gasto_organizacion_id_codigo_key" ON "categoria_gasto"("organizacion_id", "codigo");

CREATE TABLE IF NOT EXISTS "subcategoria_gasto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "categoria_id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "modo" TEXT NOT NULL,
  "etapa_regla" TEXT NOT NULL DEFAULT '',
  "etapa_codigo" TEXT,
  "nota_control" TEXT,
  "nombres_anteriores" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "subcategoria_gasto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcategoria_gasto_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "subcategoria_gasto_categoria_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_gasto"("id") ON DELETE CASCADE,
  CONSTRAINT "subcategoria_gasto_modo_chk" CHECK ("modo" IN ('INVENTARIO','DIRECTO','REPARTO','INVERSION'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "subcategoria_gasto_organizacion_id_codigo_key" ON "subcategoria_gasto"("organizacion_id", "codigo");
CREATE INDEX IF NOT EXISTS "subcategoria_gasto_categoria_id_idx" ON "subcategoria_gasto"("categoria_id");

CREATE TABLE IF NOT EXISTS "proyecto_inversion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizacion_id" TEXT NOT NULL,
  "granja_id" TEXT,
  "nombre" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PLANIFICADO',
  "presupuesto_gs" BIGINT,
  "fecha_inicio" DATE NOT NULL,
  "fecha_fin" DATE,
  "vida_util_meses" INTEGER,
  "etapa_codigo" TEXT,
  "notas" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proyecto_inversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proyecto_inversion_org_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "proyecto_inversion_estado_chk" CHECK ("estado" IN ('PLANIFICADO','EN_CURSO','TERMINADO','CANCELADO'))
);
CREATE INDEX IF NOT EXISTS "proyecto_inversion_organizacion_id_idx" ON "proyecto_inversion"("organizacion_id");

-- Ítems de inventario: subcategoría de gasto y etapa de consumo por defecto
ALTER TABLE "vacunas" ADD COLUMN IF NOT EXISTS "subcategoria_gasto_id" UUID;
ALTER TABLE "vacunas" ADD COLUMN IF NOT EXISTS "etapa_consumo_codigo" TEXT;

-- Misma protección que el resto (RLS activado; la app usa la conexión de servicio)
ALTER TABLE "etapa_costo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categoria_gasto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subcategoria_gasto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proyecto_inversion" ENABLE ROW LEVEL SECURITY;
