-- Imita lo mínimo de Supabase en un Postgres común (solo para pruebas locales y CI):
-- roles de la API, esquema auth con auth.users y auth.uid().
-- Nunca correr contra la base de Supabase: ahí estos objetos ya existen.
-- Idempotente: se puede correr varias veces.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}',
  raw_app_meta_data jsonb default '{}',
  created_at timestamptz default now()
);

-- Igual que en Supabase: el usuario sale del claim "sub" del JWT del request.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
