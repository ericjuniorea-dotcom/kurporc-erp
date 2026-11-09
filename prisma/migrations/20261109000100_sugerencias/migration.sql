-- Consultas y sugerencias desde la app (soporte@kurporc.com)
CREATE TABLE "sugerencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" TEXT NOT NULL,
    "organizacion_id" TEXT,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "pagina" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'NUEVA',
    "respuesta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sugerencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sugerencia_tipo_check" CHECK ("tipo" IN ('CONSULTA','SUGERENCIA','PROBLEMA')),
    CONSTRAINT "sugerencia_estado_check" CHECK ("estado" IN ('NUEVA','EN_REVISION','HECHA','DESCARTADA')),
    CONSTRAINT "sugerencia_mensaje_check" CHECK (length("mensaje") between 3 and 4000)
);
CREATE INDEX "sugerencia_estado_created_at_idx" ON "sugerencia"("estado", "created_at");
CREATE INDEX "sugerencia_usuario_id_idx" ON "sugerencia"("usuario_id");

-- Solo el servidor la lee y escribe
alter table public.sugerencia enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.sugerencia from %I', r);
    end if;
  end loop;
end $$;
