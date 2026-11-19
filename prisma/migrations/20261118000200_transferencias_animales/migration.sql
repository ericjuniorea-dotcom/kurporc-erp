-- Transferencias de animales entre módulos (compras desde Finanzas y traslados internos), con aceptación del que recibe.
CREATE TABLE IF NOT EXISTS "transferencias_animales" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "destino" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'EN_CAMINO',
  "motivo" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "peso_total_kg" DECIMAL(10,2),
  "edad_dias" INTEGER,
  "proveedor" TEXT,
  "movimiento_id" UUID,
  "costo_total_gs" BIGINT,
  "animales" JSONB,
  "ubicacion" TEXT,
  "sow_id" TEXT,
  "farrowing_id" TEXT,
  "nursery_batch_id" TEXT,
  "growing_batch_id" TEXT,
  "fecha_programada" DATE,
  "creada_por" TEXT,
  "enviada_por" TEXT,
  "enviada_en" TIMESTAMP(3),
  "resuelta_por" TEXT,
  "resuelta_en" TIMESTAMP(3),
  "cantidad_recibida" INTEGER,
  "peso_recibido_kg" DECIMAL(10,2),
  "nota" TEXT,
  "resultado" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transferencias_animales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transferencias_animales_cantidad_chk" CHECK ("cantidad" > 0),
  CONSTRAINT "transferencias_animales_estado_chk" CHECK ("estado" IN ('ORDEN','EN_CAMINO','RECIBIDA','RECHAZADA','ANULADA'))
);
CREATE INDEX IF NOT EXISTS "transferencias_animales_tenant_id_estado_idx" ON "transferencias_animales"("tenant_id", "estado");
CREATE INDEX IF NOT EXISTS "transferencias_animales_tenant_id_destino_estado_idx" ON "transferencias_animales"("tenant_id", "destino", "estado");
CREATE INDEX IF NOT EXISTS "transferencias_animales_sow_id_idx" ON "transferencias_animales"("sow_id");
-- Una sola transferencia abierta por reproductora y destino (la orden automática no se duplica)
CREATE UNIQUE INDEX IF NOT EXISTS "transferencias_animales_abierta_por_cerda" ON "transferencias_animales"("sow_id", "destino") WHERE "sow_id" IS NOT NULL AND "estado" IN ('ORDEN','EN_CAMINO');
-- Misma protección que el resto de las tablas de la organización (RLS activado; la app usa la conexión de servicio)
ALTER TABLE "transferencias_animales" ENABLE ROW LEVEL SECURITY;
