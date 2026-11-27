-- Finanzas · costeo · R4: el flete de una compra (LOG-02) se suma al costo del ítem que llegó al inventario.
ALTER TABLE "movimiento" ADD COLUMN IF NOT EXISTS "flete_recepcion_id" UUID;
DO $$ BEGIN
  ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_flete_recepcion_fkey" FOREIGN KEY ("flete_recepcion_id") REFERENCES "recepcion_inventario"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "recepcion_inventario" ADD COLUMN IF NOT EXISTS "flete_gs" BIGINT NOT NULL DEFAULT 0;
