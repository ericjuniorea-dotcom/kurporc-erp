-- CreateTable
CREATE TABLE "ruc_dnit" (
    "ruc" INTEGER NOT NULL,
    "dv" SMALLINT NOT NULL,
    "razon_social" TEXT NOT NULL,

    CONSTRAINT "ruc_dnit_pkey" PRIMARY KEY ("ruc")
);


-- Padrón público de la DNIT: solo lo lee el servidor
alter table public.ruc_dnit enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.ruc_dnit from %I', r);
    end if;
  end loop;
end $$;
