-- Buzón · conversaciones: cada mensaje del buzón es un hilo con ida y vuelta entre el cliente y la plataforma.
-- El registro queda por organización (sugerencia.organizacion_id) y no se borra al cerrar el mensaje.
create table public.sugerencia_mensaje (
  id              uuid not null default gen_random_uuid(),
  sugerencia_id   uuid not null references public.sugerencia(id) on delete cascade,
  autor_id        text not null,
  de_plataforma   boolean not null default false,
  texto           text not null,
  created_at      timestamp(3) not null default current_timestamp,
  constraint sugerencia_mensaje_pkey primary key (id),
  constraint sugerencia_mensaje_texto_check check (length(texto) between 1 and 4000)
);
create index sugerencia_mensaje_sugerencia_idx on public.sugerencia_mensaje(sugerencia_id, created_at);

-- Las respuestas que ya existían pasan a ser el primer mensaje de la plataforma en su hilo
insert into public.sugerencia_mensaje (sugerencia_id, autor_id, de_plataforma, texto, created_at)
select id, 'plataforma', true, respuesta, updated_at from public.sugerencia where respuesta is not null and length(respuesta) > 0;

alter table public.sugerencia_mensaje enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.sugerencia_mensaje from %I', r);
    end if;
  end loop;
end $$;
