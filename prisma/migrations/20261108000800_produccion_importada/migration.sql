-- CreateTable
CREATE TABLE "produccion_mensual_importada" (
    "organizacion_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "servicios" INTEGER NOT NULL DEFAULT 0,
    "partos" INTEGER NOT NULL DEFAULT 0,
    "nacidos_totales" INTEGER NOT NULL DEFAULT 0,
    "nacidos_vivos" INTEGER NOT NULL DEFAULT 0,
    "muertos_al_nacer" INTEGER NOT NULL DEFAULT 0,
    "destetados" INTEGER NOT NULL DEFAULT 0,
    "muertos_lactancia" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "produccion_mensual_importada_pkey" PRIMARY KEY ("organizacion_id","mes")
);


alter table public.produccion_mensual_importada enable row level security;
create policy org_select on public.produccion_mensual_importada for select to authenticated using (organizacion_id in (select public.mis_orgs()));
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then execute format('revoke all on public.produccion_mensual_importada from %I', r); end if;
  end loop;
end $$;
drop trigger if exists historial on public.produccion_mensual_importada;
