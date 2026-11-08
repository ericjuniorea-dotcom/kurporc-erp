-- AlterTable
ALTER TABLE "admin_plataforma" ADD COLUMN     "otorgado_por" TEXT;

-- CreateTable
CREATE TABLE "acceso_plataforma" (
    "id" UUID NOT NULL,
    "admin_id" TEXT NOT NULL,
    "organizacion_id" TEXT,
    "seccion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle_motivo" TEXT,
    "exportacion" BOOLEAN NOT NULL DEFAULT false,
    "filas" INTEGER,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acceso_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acceso_plataforma_organizacion_id_created_at_idx" ON "acceso_plataforma"("organizacion_id", "created_at");

-- CreateIndex
CREATE INDEX "acceso_plataforma_admin_id_created_at_idx" ON "acceso_plataforma"("admin_id", "created_at");


-- ════════════════════════════════════════════════════════════════════
-- Fase 11 · SQL propio: accesos de la plataforma y control de super administradores
-- ════════════════════════════════════════════════════════════════════

-- El registro de accesos es de solo agregar
create trigger solo_agregar before update or delete on public.acceso_plataforma
  for each row execute function public.prohibir_modificacion();
create trigger solo_agregar_truncate before truncate on public.acceso_plataforma
  for each statement execute function public.prohibir_modificacion();

alter table public.acceso_plataforma enable row level security;
-- La organización ve quién de la plataforma entró a sus datos (Fase 4.4)
create policy org_select on public.acceso_plataforma for select to authenticated
  using (organizacion_id in (select public.mis_orgs()));
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.acceso_plataforma from %I', r);
      execute format('revoke insert, update, delete, truncate on public.admin_plataforma from %I', r);
    end if;
  end loop;
end $$;

-- Nadie se vuelve super administrador sin la autorización de un administrador TOTAL existente.
-- El actor sale de la sesión (usuario_actual) o de app.actor_id (scripts y servidor con Prisma).
create or replace function public.controlar_admin_plataforma() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := coalesce(public.usuario_actual(), nullif(current_setting('app.actor_id', true), ''));
  v_totales int;
begin
  if not exists (select 1 from public.admin_plataforma a where a.user_id = v_actor and a.nivel = 'TOTAL') then
    raise exception 'Solo un Super Administrador TOTAL puede autorizar o quitar administradores de la plataforma'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'INSERT' then
    new.otorgado_por := v_actor;
    return new;
  end if;
  -- Siempre tiene que quedar al menos un administrador TOTAL
  select count(*) into v_totales from public.admin_plataforma
   where nivel = 'TOTAL' and user_id <> old.user_id;
  if old.nivel = 'TOTAL' and v_totales = 0 and (tg_op = 'DELETE' or new.nivel <> 'TOTAL') then
    raise exception 'No se puede dejar la plataforma sin un Super Administrador TOTAL';
  end if;
  if tg_op = 'UPDATE' then return new; end if;
  return old;
end $$;
revoke all on function public.controlar_admin_plataforma() from public;
create trigger controlar before insert or update or delete on public.admin_plataforma
  for each row execute function public.controlar_admin_plataforma();

-- Historial de cambios de administradores
drop trigger if exists historial on public.admin_plataforma;
create trigger historial after insert or update or delete on public.admin_plataforma
  for each row execute function public.registrar_cambio();
