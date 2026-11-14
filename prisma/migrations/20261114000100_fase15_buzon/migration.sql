-- Fase 15.2 · Buzón categorizado: «Función nueva», módulo, prioridad, hoja de ruta pública y votos.
alter table public.sugerencia drop constraint sugerencia_tipo_check;
alter table public.sugerencia add constraint sugerencia_tipo_check
  check (tipo in ('CONSULTA','SUGERENCIA','PROBLEMA','FUNCION_NUEVA'));
alter table public.sugerencia drop constraint sugerencia_estado_check;
alter table public.sugerencia add constraint sugerencia_estado_check
  check (estado in ('NUEVA','EN_REVISION','EN_DESARROLLO','HECHA','DESCARTADA'));

alter table public.sugerencia
  add column modulo text,
  add column titulo text,
  add column problema text,
  add column como_funcionaria text,
  add column prioridad text,
  add column publica boolean not null default false,
  add column titulo_publico text,
  add column descripcion_publica text,
  add column agrupada_en uuid references public.sugerencia(id) on delete set null;

alter table public.sugerencia add constraint sugerencia_prioridad_check
  check (prioridad is null or prioridad in ('BAJA','MEDIA','ALTA'));
alter table public.sugerencia add constraint sugerencia_funcion_check
  check (tipo <> 'FUNCION_NUEVA' or (titulo is not null and problema is not null and como_funcionaria is not null));
alter table public.sugerencia add constraint sugerencia_publica_check
  check (not publica or (titulo_publico is not null and descripcion_publica is not null));
create index sugerencia_tipo_estado_idx on public.sugerencia(tipo, estado);
create index sugerencia_modulo_idx on public.sugerencia(modulo);

create table public.sugerencia_voto (
  sugerencia_id   uuid not null references public.sugerencia(id) on delete cascade,
  usuario_id      text not null,
  organizacion_id text,
  created_at      timestamp(3) not null default current_timestamp,
  primary key (sugerencia_id, usuario_id)
);
create index sugerencia_voto_org_idx on public.sugerencia_voto(sugerencia_id, organizacion_id);

alter table public.sugerencia_voto enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.sugerencia_voto from %I', r);
    end if;
  end loop;
end $$;
