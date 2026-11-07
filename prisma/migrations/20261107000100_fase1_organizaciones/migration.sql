-- CreateEnum
CREATE TYPE "TipoRegistro" AS ENUM ('COMPRADOR', 'INDIVIDUAL', 'EMPRESA', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('INDIVIDUAL', 'EMPRESA', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "EstadoOrganizacion" AS ENUM ('ACTIVA', 'SUSPENDIDA', 'EN_BAJA');

-- CreateEnum
CREATE TYPE "EstadoVerificacion" AS ENUM ('NO_APLICA', 'PENDIENTE', 'VERIFICADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoMiembro" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "Alcance" AS ENUM ('TODAS', 'SELECCION');

-- CreateEnum
CREATE TYPE "EfectoPermiso" AS ENUM ('PERMITIR', 'DENEGAR');

-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'REVOCADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoAcceso" AS ENUM ('NORMAL', 'GESTIONADA');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('GRANJA', 'COMUN', 'OTRA');

-- AlterEnum
BEGIN;
CREATE TYPE "CategoriaProducto_new" AS ENUM ('VACUNA', 'SUPLEMENTO', 'MEDICAMENTO', 'BALANCEADO', 'EQUIPAMIENTO');
ALTER TABLE "vacunas" ALTER COLUMN "categoria" DROP DEFAULT;
ALTER TABLE "vacunas" ALTER COLUMN "categoria" TYPE "CategoriaProducto_new" USING ("categoria"::text::"CategoriaProducto_new");
ALTER TYPE "CategoriaProducto" RENAME TO "CategoriaProducto_old";
ALTER TYPE "CategoriaProducto_new" RENAME TO "CategoriaProducto";
DROP TYPE "CategoriaProducto_old";
ALTER TABLE "vacunas" ALTER COLUMN "categoria" SET DEFAULT 'VACUNA';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LocationType_new" AS ENUM ('GESTATION', 'MATERNITY', 'NURSERY', 'GROWING', 'OTHER');
ALTER TABLE "farm_locations" ALTER COLUMN "locationType" TYPE "LocationType_new" USING ("locationType"::text::"LocationType_new");
ALTER TYPE "LocationType" RENAME TO "LocationType_old";
ALTER TYPE "LocationType_new" RENAME TO "LocationType";
DROP TYPE "LocationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrigenMovimiento_new" AS ENUM ('VACUNACION', 'TRATAMIENTO', 'MATERNIDAD', 'ALIMENTACION', 'COMPRA', 'AJUSTE_MANUAL');
ALTER TABLE "movimientos_inventario" ALTER COLUMN "origen" TYPE "OrigenMovimiento_new" USING ("origen"::text::"OrigenMovimiento_new");
ALTER TYPE "OrigenMovimiento" RENAME TO "OrigenMovimiento_old";
ALTER TYPE "OrigenMovimiento_new" RENAME TO "OrigenMovimiento";
DROP TYPE "OrigenMovimiento_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "bal_production_orders" DROP CONSTRAINT "bal_production_orders_formulaVersionId_fkey";

-- DropForeignKey
ALTER TABLE "bal_production_orders" DROP CONSTRAINT "bal_production_orders_loteInventarioId_fkey";

-- DropForeignKey
ALTER TABLE "formula_ingredients" DROP CONSTRAINT "formula_ingredients_formulaVersionId_fkey";

-- DropForeignKey
ALTER TABLE "formula_ingredients" DROP CONSTRAINT "formula_ingredients_rawMaterialId_fkey";

-- DropForeignKey
ALTER TABLE "formula_versions" DROP CONSTRAINT "formula_versions_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "formula_versions" DROP CONSTRAINT "formula_versions_formulaId_fkey";

-- DropForeignKey
ALTER TABLE "formulas" DROP CONSTRAINT "formulas_feedTypeId_fkey";

-- DropForeignKey
ALTER TABLE "lotes_inventario_nutricion" DROP CONSTRAINT "lotes_inventario_nutricion_loteId_fkey";

-- DropForeignKey
ALTER TABLE "lotes_inventario_nutricion" DROP CONSTRAINT "lotes_inventario_nutricion_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "nutritional_targets" DROP CONSTRAINT "nutritional_targets_feedTypeId_fkey";

-- AlterTable
ALTER TABLE "farm_locations" ADD COLUMN     "granjaId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "codigoUnion" TEXT NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
ADD COLUMN     "compartirBenchmark" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creadoPor" TEXT,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "distrito" TEXT,
ADD COLUMN     "estado" "EstadoOrganizacion" NOT NULL DEFAULT 'ACTIVA',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "pais" TEXT NOT NULL DEFAULT 'PY',
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "rubro" TEXT,
ADD COLUMN     "ruc" TEXT,
ADD COLUMN     "tipo" "TipoOrganizacion" NOT NULL DEFAULT 'EMPRESA',
ADD COLUMN     "verificacion" "EstadoVerificacion" NOT NULL DEFAULT 'NO_APLICA',
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authUserId" UUID,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bajaSolicitadaEn" TIMESTAMP(3),
ADD COLUMN     "debeCambiarClave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declaraMayorEdad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "distrito" TEXT,
ADD COLUMN     "onboardingCompleto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proveedorLogin" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "tipoAcceso" "TipoAcceso" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "tipoRegistro" "TipoRegistro" NOT NULL DEFAULT 'COMPRADOR',
ADD COLUMN     "ultimoAcceso" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vacunas" DROP COLUMN "materialType";

-- DropTable
DROP TABLE "bal_production_orders";

-- DropTable
DROP TABLE "formula_ingredients";

-- DropTable
DROP TABLE "formula_versions";

-- DropTable
DROP TABLE "formulas";

-- DropTable
DROP TABLE "lotes_inventario_nutricion";

-- DropTable
DROP TABLE "nutritional_targets";

-- DropEnum
DROP TYPE "FormulaStatus";

-- DropEnum
DROP TYPE "ProductionOrderStatus";

-- DropEnum
DROP TYPE "RawMaterialType";

-- CreateTable
CREATE TABLE "granja" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT,
    "distrito" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "granja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad_negocio" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoUnidad" NOT NULL,
    "granja_id" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidad_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembro" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rol_id" UUID,
    "es_propietario" BOOLEAN NOT NULL DEFAULT false,
    "cargo" TEXT,
    "estado" "EstadoMiembro" NOT NULL DEFAULT 'ACTIVO',
    "alcance_granjas" "Alcance" NOT NULL DEFAULT 'TODAS',
    "alcance_unidades" "Alcance" NOT NULL DEFAULT 'TODAS',
    "limite_compra_gs" BIGINT,
    "invitado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembro_granja" (
    "miembro_id" UUID NOT NULL,
    "granja_id" TEXT NOT NULL,

    CONSTRAINT "miembro_granja_pkey" PRIMARY KEY ("miembro_id","granja_id")
);

-- CreateTable
CREATE TABLE "miembro_unidad" (
    "miembro_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,

    CONSTRAINT "miembro_unidad_pkey" PRIMARY KEY ("miembro_id","unidad_id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "clave" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "sensible" BOOLEAN NOT NULL DEFAULT false,
    "solo_propietario" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" UUID NOT NULL,
    "permiso_clave" TEXT NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_clave")
);

-- CreateTable
CREATE TABLE "miembro_permiso" (
    "miembro_id" UUID NOT NULL,
    "permiso_clave" TEXT NOT NULL,
    "efecto" "EfectoPermiso" NOT NULL,

    CONSTRAINT "miembro_permiso_pkey" PRIMARY KEY ("miembro_id","permiso_clave")
);

-- CreateTable
CREATE TABLE "invitacion" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol_id" UUID NOT NULL,
    "cargo" TEXT,
    "ajustes" JSONB NOT NULL DEFAULT '[]',
    "granjas" JSONB NOT NULL DEFAULT '[]',
    "unidades" JSONB NOT NULL DEFAULT '[]',
    "limite_compra_gs" BIGINT,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "invitado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_union" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_union_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_plataforma" (
    "user_id" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'TOTAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_plataforma_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "actividad_diaria" (
    "user_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "organizacion_id" TEXT,
    "accesos" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "actividad_diaria_pkey" PRIMARY KEY ("user_id","fecha")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "organizacion_id" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "granja_organizacion_id_idx" ON "granja"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "granja_organizacion_id_codigo_key" ON "granja"("organizacion_id", "codigo");

-- CreateIndex
CREATE INDEX "unidad_negocio_organizacion_id_idx" ON "unidad_negocio"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_negocio_organizacion_id_codigo_key" ON "unidad_negocio"("organizacion_id", "codigo");

-- CreateIndex
CREATE INDEX "miembro_user_id_idx" ON "miembro"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "miembro_organizacion_id_user_id_key" ON "miembro"("organizacion_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_organizacion_id_codigo_key" ON "rol"("organizacion_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "invitacion_token_hash_key" ON "invitacion"("token_hash");

-- CreateIndex
CREATE INDEX "invitacion_organizacion_id_estado_idx" ON "invitacion"("organizacion_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_union_organizacion_id_user_id_key" ON "solicitud_union"("organizacion_id", "user_id");

-- CreateIndex
CREATE INDEX "notificacion_user_id_leida_idx" ON "notificacion"("user_id", "leida");

-- CreateIndex
CREATE INDEX "farm_locations_granjaId_idx" ON "farm_locations"("granjaId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_codigoUnion_key" ON "tenants"("codigoUnion");

-- CreateIndex
CREATE INDEX "tenants_tipo_idx" ON "tenants"("tipo");

-- CreateIndex
CREATE INDEX "tenants_departamento_idx" ON "tenants"("departamento");

-- CreateIndex
CREATE UNIQUE INDEX "users_authUserId_key" ON "users"("authUserId");

-- AddForeignKey
ALTER TABLE "farm_locations" ADD CONSTRAINT "farm_locations_granjaId_fkey" FOREIGN KEY ("granjaId") REFERENCES "granja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "granja" ADD CONSTRAINT "granja_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_negocio" ADD CONSTRAINT "unidad_negocio_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_negocio" ADD CONSTRAINT "unidad_negocio_granja_id_fkey" FOREIGN KEY ("granja_id") REFERENCES "granja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro" ADD CONSTRAINT "miembro_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_granja" ADD CONSTRAINT "miembro_granja_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_granja" ADD CONSTRAINT "miembro_granja_granja_id_fkey" FOREIGN KEY ("granja_id") REFERENCES "granja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_unidad" ADD CONSTRAINT "miembro_unidad_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_unidad" ADD CONSTRAINT "miembro_unidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol" ADD CONSTRAINT "rol_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_clave_fkey" FOREIGN KEY ("permiso_clave") REFERENCES "permiso"("clave") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_permiso" ADD CONSTRAINT "miembro_permiso_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_permiso" ADD CONSTRAINT "miembro_permiso_permiso_clave_fkey" FOREIGN KEY ("permiso_clave") REFERENCES "permiso"("clave") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_plataforma" ADD CONSTRAINT "admin_plataforma_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ================================================================
-- FASE 1 — SQL que Prisma no maneja: funciones de seguridad y RLS
-- (escrito a mano; Prisma no lo vuelve a generar ni lo borra)
-- ================================================================

-- Usuario de la app (users.id) que corresponde a la sesión de Supabase Auth.
-- Hasta la Fase 3 nadie tiene authUserId, así que devuelve null y RLS no deja ver nada.
create or replace function public.usuario_actual() returns text
language sql stable security definer set search_path = public as $$
  select id from public.users where "authUserId" = auth.uid()
$$;

-- Organizaciones donde el usuario es miembro activo
create or replace function public.mis_orgs() returns setof text
language sql stable security definer set search_path = public as $$
  select m.organizacion_id from public.miembro m
  where m.user_id = public.usuario_actual() and m.estado = 'ACTIVO'
$$;

-- ¿El usuario actual tiene el permiso en esa organización (y granja / unidad)?
create or replace function public.tiene_permiso(
  p_org text, p_clave text, p_granja text default null, p_unidad uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  with m as (
    select id, rol_id, es_propietario, alcance_granjas, alcance_unidades
    from public.miembro
    where user_id = public.usuario_actual() and organizacion_id = p_org and estado = 'ACTIVO'
  )
  select exists (
    select 1 from m
    where (
      m.es_propietario
      or (
        ( exists (select 1 from public.rol_permiso rp where rp.rol_id = m.rol_id and rp.permiso_clave = p_clave)
          or exists (select 1 from public.miembro_permiso mp where mp.miembro_id = m.id and mp.permiso_clave = p_clave and mp.efecto = 'PERMITIR') )
        and not exists (select 1 from public.miembro_permiso mp where mp.miembro_id = m.id and mp.permiso_clave = p_clave and mp.efecto = 'DENEGAR')
      )
    )
    and (p_granja is null or m.es_propietario or m.alcance_granjas = 'TODAS'
         or exists (select 1 from public.miembro_granja mg where mg.miembro_id = m.id and mg.granja_id = p_granja))
    and (p_unidad is null or m.es_propietario or m.alcance_unidades = 'TODAS'
         or exists (select 1 from public.miembro_unidad mu where mu.miembro_id = m.id and mu.unidad_id = p_unidad))
  )
$$;

create or replace function public.es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_plataforma where user_id = public.usuario_actual())
$$;

revoke all on function public.usuario_actual(), public.mis_orgs(), public.es_superadmin() from public;
revoke all on function public.tiene_permiso(text, text, text, uuid) from public;
grant execute on function public.usuario_actual(), public.mis_orgs(), public.es_superadmin() to authenticated;
grant execute on function public.tiene_permiso(text, text, text, uuid) to authenticated;

-- ── RLS en TODAS las tablas de public ──────────────────────────────
-- La app escribe y lee con Prisma (dueño de las tablas → no le aplica RLS).
-- Esto cierra la API REST de Supabase (roles anon / authenticated): sin una
-- política explícita no se lee ni se escribe nada.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Tablas del ERP con "tenantId": un miembro activo puede LEER las de su organización.
-- El filtro fino por permiso (modulo.recurso.ver) se agrega en la Fase 7.
-- No hay políticas de escritura: toda escritura pasa por el servidor.
do $$
declare t record;
begin
  for t in
    select c.table_name from information_schema.columns c
    join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public'
    where c.table_schema = 'public' and c.column_name = 'tenantId' and c.table_name <> 'users'
  loop
    execute format('drop policy if exists org_select on public.%I', t.table_name);
    execute format('create policy org_select on public.%I for select to authenticated using ("tenantId" in (select public.mis_orgs()))', t.table_name);
  end loop;
end $$;

-- Tablas nuevas de plataforma
create policy org_select on public.granja for select to authenticated
  using (organizacion_id in (select public.mis_orgs()));
create policy org_select on public.unidad_negocio for select to authenticated
  using (organizacion_id in (select public.mis_orgs()));
create policy org_select on public.miembro for select to authenticated
  using (user_id = public.usuario_actual() or organizacion_id in (select public.mis_orgs()));
create policy org_select on public.miembro_granja for select to authenticated
  using (exists (select 1 from public.miembro m where m.id = miembro_id and m.organizacion_id in (select public.mis_orgs())));
create policy org_select on public.miembro_unidad for select to authenticated
  using (exists (select 1 from public.miembro m where m.id = miembro_id and m.organizacion_id in (select public.mis_orgs())));
create policy org_select on public.miembro_permiso for select to authenticated
  using (exists (select 1 from public.miembro m where m.id = miembro_id and m.organizacion_id in (select public.mis_orgs())));
create policy org_select on public.rol for select to authenticated
  using (organizacion_id is null or organizacion_id in (select public.mis_orgs()));
create policy org_select on public.rol_permiso for select to authenticated
  using (exists (select 1 from public.rol r where r.id = rol_id and (r.organizacion_id is null or r.organizacion_id in (select public.mis_orgs()))));
create policy catalogo_select on public.permiso for select to authenticated using (true);
create policy propio_select on public.tenants for select to authenticated
  using (id in (select public.mis_orgs()));
create policy propio_select on public.users for select to authenticated
  using ("authUserId" = auth.uid());
create policy propio_select on public.notificacion for select to authenticated
  using (user_id = public.usuario_actual());
create policy propio_update on public.notificacion for update to authenticated
  using (user_id = public.usuario_actual()) with check (user_id = public.usuario_actual());
create policy propio_select on public.solicitud_union for select to authenticated
  using (user_id = public.usuario_actual());
-- admin_plataforma, invitacion, actividad_diaria, accounts, sessions,
-- verification_tokens, roles, user_roles: sin políticas → solo servidor.

-- Compañeros de organización: nombre, foto y cargo (nunca correo ni teléfono)
create or replace view public.v_companeros with (security_barrier = true) as
  select m.organizacion_id, u.id as user_id, u.name as nombre, u."avatarUrl" as avatar_url, m.cargo
  from public.miembro m
  join public.users u on u.id = m.user_id
  where m.estado = 'ACTIVO' and m.organizacion_id in (select public.mis_orgs());
revoke all on public.v_companeros from anon;
grant select on public.v_companeros to authenticated;
