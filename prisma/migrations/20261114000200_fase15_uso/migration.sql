-- Fase 15.3 · Uso real: tiempo con la pestaña en uso (latido cada 60 s) y por módulo.
-- La fecha es la de Asunción a medianoche, igual que hoyUTC() con la que se escribe actividad_diaria.
-- El control de latidos repetidos vive en la base: funciona igual con varias instancias del servidor.
alter table public.actividad_diaria
  add column segundos int not null default 0,
  add column ultimo_latido timestamptz;

create table public.uso_diario (
  user_id         text not null,
  fecha           date not null,
  organizacion_id text,
  modulo          text not null,
  segundos        int  not null default 0,
  latidos         int  not null default 0,
  primary key (user_id, fecha, modulo)
);
create index uso_diario_org_fecha_idx on public.uso_diario(organizacion_id, fecha);

create or replace function public.registrar_latido(p_user text, p_org text, p_modulo text) returns void
language plpgsql as $$
declare v_fecha date := (now() at time zone 'America/Asuncion')::date; v_ultimo timestamptz; v_seg int;
begin
  insert into public.actividad_diaria (user_id, fecha, organizacion_id, accesos)
  values (p_user, v_fecha, p_org, 1)
  on conflict (user_id, fecha) do nothing;

  select ultimo_latido into v_ultimo from public.actividad_diaria
  where user_id = p_user and fecha = v_fecha for update;

  if v_ultimo is not null and now() - v_ultimo < interval '45 seconds' then return; end if;  -- latido repetido
  v_seg := case when v_ultimo is null then 30
                else least(60, greatest(0, extract(epoch from now() - v_ultimo)))::int end;

  update public.actividad_diaria
     set segundos = segundos + v_seg, ultimo_latido = now(), organizacion_id = coalesce(p_org, organizacion_id)
   where user_id = p_user and fecha = v_fecha;

  insert into public.uso_diario (user_id, fecha, organizacion_id, modulo, segundos, latidos)
  values (p_user, v_fecha, p_org, p_modulo, v_seg, 1)
  on conflict (user_id, fecha, modulo) do update
    set segundos = public.uso_diario.segundos + v_seg,
        latidos = public.uso_diario.latidos + 1,
        organizacion_id = coalesce(excluded.organizacion_id, public.uso_diario.organizacion_id);
end $$;

alter table public.uso_diario enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.uso_diario from %I', r);
      execute format('revoke execute on function public.registrar_latido(text, text, text) from %I', r);
    end if;
  end loop;
  revoke execute on function public.registrar_latido(text, text, text) from public;
end $$;
