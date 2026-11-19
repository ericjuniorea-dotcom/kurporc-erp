-- Configuración → Generales: cada usuario prende o apaga la ayuda de indicadores (nube al pasar el mouse)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ayuda_indicadores" BOOLEAN NOT NULL DEFAULT true;
