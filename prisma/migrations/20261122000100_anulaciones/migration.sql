-- Anular en vez de borrar: cargas de Nutrición y aplicaciones de vacunas quedan con quién, cuándo y por qué.
ALTER TABLE "feed_records" ADD COLUMN IF NOT EXISTS "anulado_en" TIMESTAMP(3);
ALTER TABLE "feed_records" ADD COLUMN IF NOT EXISTS "anulado_por" TEXT;
ALTER TABLE "feed_records" ADD COLUMN IF NOT EXISTS "motivo_anulacion" TEXT;
ALTER TABLE "aplicaciones_vacunas" ADD COLUMN IF NOT EXISTS "anulada_en" TIMESTAMP(3);
ALTER TABLE "aplicaciones_vacunas" ADD COLUMN IF NOT EXISTS "anulada_por" TEXT;
ALTER TABLE "aplicaciones_vacunas" ADD COLUMN IF NOT EXISTS "motivo_anulacion" TEXT;

-- Permiso nuevo: anular cargas de Nutrición (sensible; solo lo da el Administrador General)
INSERT INTO "permiso" ("clave", "modulo", "recurso", "accion", "grupo", "descripcion", "sensible", "solo_propietario", "orden")
VALUES ('alimentacion.consumos.anular', 'alimentacion', 'consumos', 'anular', 'Producción', 'Registro de balanceado entregado a cada sector y lote', true, false, 56)
ON CONFLICT ("clave") DO UPDATE SET "sensible" = true;
UPDATE "permiso" SET "sensible" = true WHERE "clave" LIKE '%.anular';

-- Anular lo otorga solo el Administrador General, persona por persona: se saca de los roles que no son el suyo
DELETE FROM "rol_permiso" rp USING "rol" r
WHERE rp."rol_id" = r."id" AND rp."permiso_clave" LIKE '%.anular' AND COALESCE(r."codigo", '') <> 'ADMIN_GENERAL';
