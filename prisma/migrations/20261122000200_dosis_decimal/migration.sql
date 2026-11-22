-- La cantidad aplicada se descuenta del lote en ml o dosis y puede tener decimales (0,5 ml × 15 lechones = 7,5 ml).
ALTER TABLE "aplicaciones_vacunas" ALTER COLUMN "dosisAplicadas" TYPE DECIMAL(10,3) USING "dosisAplicadas"::DECIMAL(10,3);
