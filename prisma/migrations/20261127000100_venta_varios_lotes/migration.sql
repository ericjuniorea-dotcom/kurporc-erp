-- Ventas: una venta puede tomar animales de varios lotes (cada uno con su cantidad).
ALTER TABLE "venta" ADD COLUMN IF NOT EXISTS "lotes" JSONB NOT NULL DEFAULT '[]';
-- Las ventas anteriores con un lote quedan con ese lote en la lista
UPDATE "venta" SET "lotes" = jsonb_build_array(jsonb_build_object('tipo', 'DESTETE', 'loteId', "lote_destete_id", 'cantidad', "cantidad"))
 WHERE "lote_destete_id" IS NOT NULL AND "lotes" = '[]'::jsonb;
UPDATE "venta" SET "lotes" = jsonb_build_array(jsonb_build_object('tipo', 'ENGORDE', 'loteId', "lote_engorde_id", 'cantidad', "cantidad"))
 WHERE "lote_engorde_id" IS NOT NULL AND "lotes" = '[]'::jsonb;
