-- Una cerda dada de baja (muerta o descartada) no puede tener eventos reproductivos posteriores a su baja
-- ni recibir lechones. Los lechones que ella dona conservan su trazabilidad (eso sí se permite).
-- Se permiten los eventos con fecha hasta su baja: así se puede cargar la historia de una cerda que ya murió.

create or replace function public.bloquear_eventos_cerda_baja() returns trigger
  language plpgsql set search_path = '' as
$fn$
declare
  cerda text;
  fecha timestamp;
  activa boolean;
  baja timestamp;
begin
  if tg_table_name in ('weaning_events') then
    select f."sowId" into cerda from public.farrowing_events f where f.id = new."farrowingId";
  elsif tg_table_name = 'piglet_movements' then
    select f."sowId" into cerda from public.farrowing_events f where f.id = new."destinationId";
  else
    cerda := new."sowId";
  end if;
  fecha := (to_jsonb(new) ->> tg_argv[0])::timestamp;
  select s."isActive" into activa from public.sows s where s.id = cerda;
  if activa is null or activa then return new; end if;
  select max(d."discardDate") into baja from public.sow_discards d where d."sowId" = cerda;
  if baja is null or fecha > baja + interval '12 hours' then
    raise exception 'La cerda está dada de baja%: no se pueden registrar eventos ni recibir lechones después de su baja',
      coalesce(' desde el ' || to_char(baja, 'DD/MM/YYYY'), '')
      using errcode = 'check_violation';
  end if;
  return new;
end
$fn$;

do $do$
declare t record;
begin
  for t in select * from (values
    ('service_events', 'serviceDate'), ('farrowing_events', 'startDatetime'), ('pregnancy_checks', 'checkDate'),
    ('heat_repeats', 'repeatDate'), ('abortion_events', 'abortionDate'), ('weaning_events', 'weaningDate'),
    ('piglet_movements', 'movementDate')
  ) as x(tabla, columna) loop
    execute format('drop trigger if exists cerda_de_baja on public.%I', t.tabla);
    execute format('create trigger cerda_de_baja before insert on public.%I for each row execute function public.bloquear_eventos_cerda_baja(%L)', t.tabla, t.columna);
  end loop;
end $do$;

revoke execute on function public.bloquear_eventos_cerda_baja() from public;
do $do$ declare r text; begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then execute format('revoke execute on function public.bloquear_eventos_cerda_baja() from %I', r); end if;
  end loop;
end $do$;
