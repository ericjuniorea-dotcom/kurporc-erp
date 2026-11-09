-- Fase 10 · cerdas paradas: parámetros del cálculo y de las alertas
ALTER TABLE "parametros_financieros"
  ADD COLUMN "tolerancia_servicio_dias" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "edad_primer_servicio_dias" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "adaptacion_nulipara_dias" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "alerta_vacia_sin_decision_dias" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "alerta_descarte_sin_salir_dias" INTEGER NOT NULL DEFAULT 15;
