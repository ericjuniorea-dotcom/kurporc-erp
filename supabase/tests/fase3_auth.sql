-- Fase 3 — Perfil automático al registrarse en Supabase Auth.
-- Todo en una transacción que se deshace.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fase3_auth.sql

begin;

do $$
declare
  v_existente text;
  v_email text;
  v_nuevo uuid := gen_random_uuid();
  v_otro uuid := gen_random_uuid();
  v_confirmado uuid := gen_random_uuid();
  r record;
begin
  -- Un perfil de antes de Supabase Auth (sin authUserId)
  insert into users (id, email, name, "updatedAt") values ('prueba-legado', 'legado.prueba@kurporc.test', 'Perfil legado', now());
  v_email := 'legado.prueba@kurporc.test';

  -- 1. Registro nuevo con Google (correo confirmado): crea el perfil con nombre y foto
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
  values (v_nuevo, 'Nuevo.Prueba@kurporc.test', now(),
          '{"full_name": "Persona de Prueba", "avatar_url": "https://lh3.googleusercontent.com/x"}', '{"provider": "google"}');
  select * into r from users where "authUserId" = v_nuevo;
  if r.id is null then raise exception '1: no se creó el perfil'; end if;
  if r.id <> v_nuevo::text then raise exception '1: el id del perfil debería ser el de auth'; end if;
  if r.email <> 'nuevo.prueba@kurporc.test' then raise exception '1: el correo no se normalizó: %', r.email; end if;
  if r.name <> 'Persona de Prueba' or r."avatarUrl" is null then raise exception '1: faltan nombre o foto de Google'; end if;
  if r."proveedorLogin" <> 'google' then raise exception '1: proveedor incorrecto: %', r."proveedorLogin"; end if;
  if r."tenantId" is not null then raise exception '1: un perfil nuevo no debe tener organización'; end if;
  if exists (select 1 from miembro where user_id = r.id) then raise exception '1: un perfil nuevo no debe ser miembro de nada'; end if;

  -- 2. Correo SIN confirmar igual a un perfil existente: NO se apropia de la cuenta ni crea otra
  insert into auth.users (id, email, email_confirmed_at) values (v_otro, upper(v_email), null);
  if exists (select 1 from users where id = 'prueba-legado' and "authUserId" is not null) then
    raise exception '2: un registro sin confirmar se vinculó a una cuenta existente';
  end if;
  if (select count(*) from users where lower(email) = v_email) <> 1 then raise exception '2: se duplicó el perfil'; end if;

  -- 3. Al confirmar ese correo, recién ahí se vincula
  update auth.users set email_confirmed_at = now() where id = v_otro;
  if not exists (select 1 from users where id = 'prueba-legado' and "authUserId" = v_otro) then
    raise exception '3: al confirmar el correo no se vinculó el perfil existente';
  end if;

  -- 4. Registro confirmado de un correo con perfil previo: se vincula directamente
  insert into users (id, email, name, "updatedAt") values ('prueba-legado-2', 'legado2.prueba@kurporc.test', 'Otro legado', now());
  insert into auth.users (id, email, email_confirmed_at) values (v_confirmado, 'legado2.prueba@kurporc.test', now());
  if not exists (select 1 from users where id = 'prueba-legado-2' and "authUserId" = v_confirmado) then
    raise exception '4: no se vinculó el perfil existente';
  end if;

  -- 5. Cuenta gestionada (operario): queda marcada como tal
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (gen_random_uuid(), 'operario.prueba.demo@usuarios.kurporc.com', now(), '{"full_name": "Operario de prueba"}');
  select * into r from users where email = 'operario.prueba.demo@usuarios.kurporc.com';
  if r."tipoAcceso" <> 'GESTIONADA' or r."proveedorLogin" <> 'gestionada' then raise exception '5: la cuenta gestionada no quedó marcada'; end if;
end $$;

select 'OK — perfil automático de la Fase 3 verificado' as resultado;
rollback;
