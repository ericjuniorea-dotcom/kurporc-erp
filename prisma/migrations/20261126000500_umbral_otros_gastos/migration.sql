-- Finanzas · Fugas (R14): alerta cuando «Otros gastos» (OTR-01) supera este % del gasto total.
ALTER TABLE "parametros_financieros" ADD COLUMN IF NOT EXISTS "umbral_otros_gastos" DECIMAL(5,4) NOT NULL DEFAULT 0.03;
