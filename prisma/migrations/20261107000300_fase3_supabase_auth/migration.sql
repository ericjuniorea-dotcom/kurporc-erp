-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "verification_tokens";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ================================================================
-- FASE 3 — Perfil automático al crear un usuario en Supabase Auth
-- ================================================================
-- Google trae full_name y avatar_url en raw_user_meta_data.
-- Si ya existe un perfil con ese correo (usuarios de antes de Supabase Auth),
-- se VINCULA en lugar de crear otro, pero solo si el correo está confirmado:
-- un registro sin confirmar nunca puede apropiarse de una cuenta existente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1));
  v_proveedor text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
  if new.email is null then
    return new;
  end if;

  update public.users
     set "authUserId" = new.id,
         "avatarUrl" = coalesce("avatarUrl", new.raw_user_meta_data ->> 'avatar_url'),
         "updatedAt" = now()
   where lower(email) = lower(new.email)
     and "authUserId" is null
     and new.email_confirmed_at is not null;
  if found then
    return new;
  end if;

  insert into public.users (id, email, name, "avatarUrl", "proveedorLogin", "authUserId", "tipoAcceso", "updatedAt")
  values (
    new.id::text, lower(new.email), left(v_nombre, 120),
    new.raw_user_meta_data ->> 'avatar_url',
    case when lower(new.email) like '%@usuarios.kurporc.com' then 'gestionada' else v_proveedor end,
    new.id,
    case when lower(new.email) like '%@usuarios.kurporc.com' then 'GESTIONADA'::"TipoAcceso" else 'NORMAL'::"TipoAcceso" end,
    now()
  )
  on conflict (email) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Al confirmar el correo después del registro, vincular un perfil previo con ese correo
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.users
       set "authUserId" = new.id, "updatedAt" = now()
     where lower(email) = lower(new.email) and "authUserId" is null;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

revoke all on function public.handle_new_user(), public.handle_user_confirmed() from public, anon, authenticated;
