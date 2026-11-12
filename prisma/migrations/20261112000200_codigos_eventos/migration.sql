-- Códigos de la planilla en los eventos (S-0001, P-0001, AD-0001, E-0001, M-0001). La base asigna el siguiente si no viene.

-- AlterTable
ALTER TABLE "batch_sales" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "farrowing_events" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "piglet_deaths" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "piglet_movements" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "service_events" ADD COLUMN     "codigo" TEXT;


-- Asigna el siguiente código de la organización si el registro llega sin código (cargas desde la aplicación)
create or replace function public.asignar_codigo() returns trigger
  language plpgsql set search_path = '' as
$fn$
declare
  prefijo text := tg_argv[0];
  siguiente int;
begin
  if new.codigo is not null and new.codigo <> '' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || new."tenantId"));
  execute format('select coalesce(max((substring(codigo from %L))::int), 0) + 1 from public.%I where "tenantId" = $1 and codigo like $2',
                 '(\d+)$', tg_table_name)
    into siguiente using new."tenantId", prefijo || '-%';
  new.codigo := prefijo || '-' || lpad(siguiente::text, 4, '0');
  return new;
end
$fn$;

do $do$
declare t record;
begin
  for t in select * from (values ('service_events', 'S'), ('farrowing_events', 'P'), ('piglet_movements', 'AD'), ('batch_sales', 'E'), ('piglet_deaths', 'M')) as x(tabla, prefijo) loop
    execute format('drop trigger if exists codigo on public.%I', t.tabla);
    execute format('create trigger codigo before insert on public.%I for each row execute function public.asignar_codigo(%L)', t.tabla, t.prefijo);
  end loop;
end $do$;
revoke execute on function public.asignar_codigo() from public;

-- Registros existentes: el código que quedó en las notas de la importación anterior; si no hay, por orden de fecha
update public.service_events set codigo = substring(notes from '^(S-\d{4})') where codigo is null and notes ~ '^S-\d{4}';
update public.farrowing_events set codigo = substring(notes from '^(P-\d{4})') where codigo is null and notes ~ '^P-\d{4}';
update public.batch_sales set codigo = substring("transferGuide" from '^(E-\d{4})') where codigo is null and "transferGuide" ~ '^E-\d{4}';
with x as (select id, 'S-' || lpad((row_number() over (partition by "tenantId" order by "serviceDate", "createdAt") + coalesce((select max(substring(codigo from '(\d+)$')::int) from public.service_events y where y."tenantId" = s."tenantId"), 0))::text, 4, '0') as c from public.service_events s where codigo is null)
  update public.service_events s set codigo = x.c from x where x.id = s.id;
with x as (select id, 'P-' || lpad((row_number() over (partition by "tenantId" order by "startDatetime", "createdAt") + coalesce((select max(substring(codigo from '(\d+)$')::int) from public.farrowing_events y where y."tenantId" = s."tenantId"), 0))::text, 4, '0') as c from public.farrowing_events s where codigo is null)
  update public.farrowing_events s set codigo = x.c from x where x.id = s.id;
with x as (select id, 'AD-' || lpad(row_number() over (partition by "tenantId" order by "movementDate", "createdAt")::text, 4, '0') as c from public.piglet_movements where codigo is null)
  update public.piglet_movements s set codigo = x.c from x where x.id = s.id;
with x as (select id, 'M-' || lpad(row_number() over (partition by "tenantId" order by "deathDatetime", "createdAt")::text, 4, '0') as c from public.piglet_deaths where codigo is null)
  update public.piglet_deaths s set codigo = x.c from x where x.id = s.id;
with x as (select id, 'E-' || lpad((row_number() over (partition by "tenantId" order by "saleDate", "createdAt") + coalesce((select max(substring(codigo from '(\d+)$')::int) from public.batch_sales y where y."tenantId" = s."tenantId"), 0))::text, 4, '0') as c from public.batch_sales s where codigo is null)
  update public.batch_sales s set codigo = x.c from x where x.id = s.id;

create unique index if not exists service_events_codigo_key on public.service_events ("tenantId", codigo);
create unique index if not exists farrowing_events_codigo_key on public.farrowing_events ("tenantId", codigo);
create unique index if not exists piglet_movements_codigo_key on public.piglet_movements ("tenantId", codigo);
create unique index if not exists piglet_deaths_codigo_key on public.piglet_deaths ("tenantId", codigo);
create index if not exists batch_sales_codigo_idx on public.batch_sales ("tenantId", codigo);
