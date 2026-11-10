-- Fase 12 · Mercado KurPorc: catálogo, tiendas, publicaciones, favoritos y denuncias.

-- CreateEnum
CREATE TYPE "UnidadBase" AS ENUM ('KG', 'DOSIS', 'ML', 'UNIDAD', 'LITRO');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('BORRADOR', 'ACTIVA', 'PAUSADA', 'RECHAZADA');


-- CreateTable
CREATE TABLE "categoria_mercado" (
    "id" UUID NOT NULL,
    "padre_id" UUID,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "requiere_verificacion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categoria_mercado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_catalogo" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria_id" UUID NOT NULL,
    "unidad_base" "UnidadBase" NOT NULL,
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "categoria_financiera" TEXT,
    "requiere_receta" BOOLEAN NOT NULL DEFAULT false,
    "aprobado" BOOLEAN NOT NULL DEFAULT true,
    "propuesto_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tienda" (
    "organizacion_id" TEXT NOT NULL,
    "descripcion" TEXT,
    "zonas_entrega" TEXT[],
    "horario" TEXT,
    "calificacion" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_resenas" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tienda_pkey" PRIMARY KEY ("organizacion_id")
);

-- CreateTable
CREATE TABLE "publicacion" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "producto_catalogo_id" UUID,
    "categoria_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "marca" TEXT,
    "precio_gs" BIGINT NOT NULL,
    "unidad_venta" TEXT NOT NULL,
    "unidad_base" "UnidadBase" NOT NULL,
    "contenido_base" DECIMAL(12,3) NOT NULL,
    "pedido_minimo" INTEGER NOT NULL DEFAULT 1,
    "stock_disponible" INTEGER,
    "plazo_entrega_dias" INTEGER NOT NULL DEFAULT 3,
    "zonas_entrega" TEXT[],
    "fotos" TEXT[],
    "requiere_receta" BOOLEAN NOT NULL DEFAULT false,
    "declaracion_sanitaria" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'BORRADOR',
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorito" (
    "user_id" TEXT NOT NULL,
    "publicacion_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorito_pkey" PRIMARY KEY ("user_id","publicacion_id")
);

-- CreateTable
CREATE TABLE "denuncia_publicacion" (
    "id" UUID NOT NULL,
    "publicacion_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "resuelta_por" TEXT,
    "resuelta_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncia_publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categoria_mercado_slug_key" ON "categoria_mercado"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "producto_catalogo_codigo_key" ON "producto_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "publicacion_slug_key" ON "publicacion"("slug");

-- CreateIndex
CREATE INDEX "publicacion_producto_catalogo_id_estado_idx" ON "publicacion"("producto_catalogo_id", "estado");

-- CreateIndex
CREATE INDEX "publicacion_categoria_id_estado_idx" ON "publicacion"("categoria_id", "estado");

-- CreateIndex
CREATE INDEX "publicacion_tienda_id_estado_idx" ON "publicacion"("tienda_id", "estado");

-- CreateIndex
CREATE INDEX "denuncia_publicacion_estado_created_at_idx" ON "denuncia_publicacion"("estado", "created_at");


-- ── Ids generados por la base (las semillas de abajo los usan) ─────────────
alter table "categoria_mercado"    alter column "id" set default gen_random_uuid();
alter table "producto_catalogo"    alter column "id" set default gen_random_uuid();
alter table "publicacion"          alter column "id" set default gen_random_uuid();
alter table "denuncia_publicacion" alter column "id" set default gen_random_uuid();

-- ── Integridad ─────────────────────────────────────────────────────────────
alter table "categoria_mercado" add constraint "categoria_mercado_padre_fk" foreign key ("padre_id") references "categoria_mercado"("id");
alter table "producto_catalogo" add constraint "producto_catalogo_categoria_fk" foreign key ("categoria_id") references "categoria_mercado"("id");
alter table "tienda" add constraint "tienda_organizacion_fk" foreign key ("organizacion_id") references "tenants"("id") on delete cascade;
alter table "publicacion" add constraint "publicacion_tienda_fk" foreign key ("tienda_id") references "tienda"("organizacion_id") on delete cascade;
alter table "publicacion" add constraint "publicacion_catalogo_fk" foreign key ("producto_catalogo_id") references "producto_catalogo"("id");
alter table "publicacion" add constraint "publicacion_categoria_fk" foreign key ("categoria_id") references "categoria_mercado"("id");
alter table "favorito" add constraint "favorito_publicacion_fk" foreign key ("publicacion_id") references "publicacion"("id") on delete cascade;
alter table "favorito" add constraint "favorito_user_fk" foreign key ("user_id") references "users"("id") on delete cascade;
alter table "denuncia_publicacion" add constraint "denuncia_publicacion_fk" foreign key ("publicacion_id") references "publicacion"("id") on delete cascade;
alter table "publicacion" add constraint "publicacion_precio_ck" check ("precio_gs" > 0);
alter table "publicacion" add constraint "publicacion_contenido_ck" check ("contenido_base" > 0);
alter table "publicacion" add constraint "publicacion_minimo_ck" check ("pedido_minimo" >= 1 and "plazo_entrega_dias" >= 0);
alter table "publicacion" add constraint "publicacion_fotos_ck" check (coalesce(array_length("fotos", 1), 0) <= 6);
alter table "denuncia_publicacion" add constraint "denuncia_motivo_ck" check ("motivo" in ('ENGANOSA', 'PROHIBIDA', 'PRECIO', 'SIN_DOCUMENTACION', 'OTRO'));
alter table "denuncia_publicacion" add constraint "denuncia_estado_ck" check ("estado" in ('ABIERTA', 'DESCARTADA', 'PUBLICACION_RECHAZADA'));

-- ── Búsqueda en español sin acentos ("nucleo lactacion" encuentra "Núcleo de lactación") ──
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
-- unaccent() no es inmutable: este envoltorio sí, para poder indexarlo
create or replace function public.texto_busqueda(t text) returns text
  language sql immutable parallel safe set search_path = '' as
$fn$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $fn$;
create index "publicacion_busqueda_trgm" on "publicacion"
  using gin (public.texto_busqueda("titulo" || ' ' || coalesce("marca", '') || ' ' || coalesce("descripcion", '')) extensions.gin_trgm_ops);

-- ── Acceso: solo desde el servidor ─────────────────────────────────────────
do $do$
declare t text; r text;
begin
  foreach t in array array['categoria_mercado', 'producto_catalogo', 'tienda', 'publicacion', 'favorito', 'denuncia_publicacion'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end $do$;

-- ── Fotos: bucket público de Supabase Storage (WebP de hasta 300 KB) ───────
do $do$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('mercado', 'mercado', true, 307200, array['image/webp'])
    on conflict (id) do nothing;
  end if;
end $do$;

-- ── Tiendas existentes ─────────────────────────────────────────────────────
insert into "tienda" ("organizacion_id", "zonas_entrega")
select "id", case when "departamento" is null then '{}'::text[] else array["departamento"] end
from "tenants" where "tipo" = 'VENDEDOR'
on conflict do nothing;

-- ── Árbol de categorías ────────────────────────────────────────────────────
insert into "categoria_mercado" ("slug", "nombre", "icono", "orden", "requiere_verificacion") values
  ('alimentacion', 'Alimentación', 'wheat', 1, false),
  ('sanidad', 'Sanidad', 'vaccine', 2, false),
  ('reproduccion', 'Reproducción', 'dna', 3, false),
  ('genetica-animales', 'Genética y animales', 'pig', 4, true),
  ('equipos', 'Equipos e instalaciones', 'building-warehouse', 5, false),
  ('servicios', 'Servicios', 'truck', 6, false)
on conflict (slug) do nothing;

insert into "categoria_mercado" ("padre_id", "slug", "nombre", "orden", "requiere_verificacion")
select p."id", h.slug, h.nombre, h.orden, h.verif
from (values
  ('alimentacion', 'materias-primas', 'Materias primas', 1, false),
  ('alimentacion', 'nucleos', 'Núcleos', 2, false),
  ('alimentacion', 'preiniciales-iniciadores', 'Pre-iniciales e iniciadores', 3, false),
  ('alimentacion', 'balanceados', 'Balanceados terminados', 4, false),
  ('alimentacion', 'aditivos', 'Aditivos y suplementos', 5, false),
  ('sanidad', 'vacunas', 'Vacunas', 1, false),
  ('sanidad', 'medicamentos', 'Medicamentos', 2, false),
  ('sanidad', 'vitaminas', 'Vitaminas y minerales', 3, false),
  ('sanidad', 'desinfectantes', 'Desinfectantes', 4, false),
  ('reproduccion', 'semen', 'Semen', 1, false),
  ('reproduccion', 'insumos-reproduccion', 'Catéteres e insumos de laboratorio', 2, false),
  ('genetica-animales', 'matrices', 'Matrices', 1, true),
  ('genetica-animales', 'reproductores', 'Reproductores', 2, true),
  ('genetica-animales', 'lechones', 'Lechones', 3, true),
  ('genetica-animales', 'cerdos-terminados', 'Cerdos terminados', 4, true),
  ('equipos', 'jaulas-slats', 'Jaulas y slats', 1, false),
  ('equipos', 'comederos-bebederos', 'Comederos y bebederos', 2, false),
  ('equipos', 'calefaccion', 'Lámparas y calefacción', 3, false),
  ('servicios', 'flete', 'Flete', 1, false),
  ('servicios', 'veterinario', 'Veterinario', 2, false),
  ('servicios', 'construccion', 'Construcción', 3, false)
) as h(padre, slug, nombre, orden, verif)
join "categoria_mercado" p on p."slug" = h.padre
on conflict (slug) do nothing;

-- ── Catálogo maestro: los insumos que ya maneja el ERP ─────────────────────
insert into "producto_catalogo" ("codigo", "nombre", "categoria_id", "unidad_base", "categoria_financiera", "requiere_receta", "atributos")
select x.codigo, x.nombre, c."id", x.unidad::"UnidadBase", x.fin, x.receta, x.attr::jsonb
from (values
  ('ALI-MP-MAIZ', 'Maíz', 'materias-primas', 'KG', 'Balanceado de gestación', false, '{}'),
  ('ALI-MP-EXPELLER', 'Expeller de soja', 'materias-primas', 'KG', 'Balanceado de gestación', false, '{}'),
  ('ALI-MP-CASCARILLA', 'Cascarilla de soja', 'materias-primas', 'KG', 'Balanceado de gestación', false, '{}'),
  ('ALI-MP-ACEITE', 'Aceite de soja', 'materias-primas', 'LITRO', 'Balanceado de lactación', false, '{}'),
  ('ALI-NUC-GES', 'Núcleo de gestación', 'nucleos', 'KG', 'Balanceado de gestación', false, '{"fase":"gestacion"}'),
  ('ALI-NUC-LAC', 'Núcleo de lactación', 'nucleos', 'KG', 'Balanceado de lactación', false, '{"fase":"lactacion"}'),
  ('ALI-NUC-INI', 'Núcleo iniciador', 'nucleos', 'KG', 'Inicial', false, '{"fase":"iniciador"}'),
  ('ALI-PRE-1', 'Pre-inicial 1', 'preiniciales-iniciadores', 'KG', 'Pre-inicial 1', false, '{}'),
  ('ALI-PRE-2', 'Pre-inicial 2', 'preiniciales-iniciadores', 'KG', 'Pre-inicial 2', false, '{}'),
  ('ALI-INI', 'Iniciador', 'preiniciales-iniciadores', 'KG', 'Inicial', false, '{}'),
  ('ALI-VILO-BABY', 'Vilo Baby', 'preiniciales-iniciadores', 'KG', 'Vilo Baby', false, '{}'),
  ('ALI-SECUESTRANTE', 'Secuestrante de micotoxinas', 'aditivos', 'KG', 'Balanceado de gestación', false, '{}'),
  ('ALI-BAL-GES', 'Balanceado de gestación', 'balanceados', 'KG', 'Balanceado de gestación', false, '{}'),
  ('ALI-BAL-LAC', 'Balanceado de lactación', 'balanceados', 'KG', 'Balanceado de lactación', false, '{}'),
  ('ALI-BAL-CRE', 'Balanceado de crecimiento', 'balanceados', 'KG', 'Balanceado de crecimiento', false, '{}'),
  ('ALI-BAL-TER', 'Balanceado de terminación', 'balanceados', 'KG', 'Balanceado de terminación', false, '{}'),
  ('SAN-VAC-CIRCO-MHYO', 'Vacuna circovirus PCV2 + Mycoplasma hyopneumoniae', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Circovirus porcino tipo 2 + neumonía enzoótica"}'),
  ('SAN-VAC-PARVO-LEPTO-ERY', 'Vacuna parvovirus, leptospirosis y erisipela', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Parvovirus, leptospirosis y erisipela"}'),
  ('SAN-VAC-GLASSER', 'Vacuna enfermedad de Glässer', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Enfermedad de Glässer"}'),
  ('SAN-VAC-ILEITIS', 'Vacuna ileítis (Lawsonia)', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Ileítis porcina"}'),
  ('SAN-VAC-RINITIS', 'Vacuna rinitis atrófica', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Rinitis atrófica (Bordetella / Pasteurella)"}'),
  ('SAN-VAC-COLI-CLOS', 'Vacuna diarrea neonatal (E. coli / Clostridium)', 'vacunas', 'DOSIS', 'Sanidad', true, '{"enfermedad":"Diarrea neonatal"}'),
  ('SAN-MED-HIERRO', 'Hierro dextrano 200 mg', 'medicamentos', 'ML', 'Sanidad', false, '{"uso":"Anemia ferropénica del lechón"}'),
  ('SAN-MED-TOLTRAZURIL', 'Toltrazuril', 'medicamentos', 'ML', 'Sanidad', true, '{"uso":"Coccidiosis del lechón"}'),
  ('SAN-MED-AMOXICILINA', 'Amoxicilina inyectable', 'medicamentos', 'ML', 'Sanidad', true, '{}'),
  ('SAN-MED-PENICILINA', 'Penicilina inyectable', 'medicamentos', 'ML', 'Sanidad', true, '{}'),
  ('SAN-MED-OXITETRA', 'Oxitetraciclina', 'medicamentos', 'ML', 'Sanidad', true, '{}'),
  ('SAN-MED-OXITOCINA', 'Oxitocina', 'medicamentos', 'ML', 'Sanidad', true, '{}'),
  ('SAN-MED-DEXA', 'Dexametasona', 'medicamentos', 'ML', 'Sanidad', true, '{}'),
  ('SAN-VIT-ADE', 'Vitaminas A, D y E', 'vitaminas', 'ML', 'Sanidad', false, '{}'),
  ('SAN-VIT-MULTI', 'Multivitamínico', 'vitaminas', 'ML', 'Sanidad', false, '{}'),
  ('SAN-DES-AMONIO', 'Desinfectante amonio cuaternario', 'desinfectantes', 'LITRO', 'Limpieza', false, '{}'),
  ('SAN-DES-GLUTAR', 'Desinfectante glutaraldehído', 'desinfectantes', 'LITRO', 'Limpieza', false, '{}'),
  ('REP-SEMEN', 'Dosis de semen porcino', 'semen', 'DOSIS', 'Genética y reproducción', false, '{}'),
  ('REP-CATETER', 'Catéter de inseminación', 'insumos-reproduccion', 'UNIDAD', 'Genética y reproducción', false, '{}'),
  ('GEN-MATRIZ', 'Hembra de reposición', 'matrices', 'UNIDAD', 'Genética y reproducción', false, '{}'),
  ('GEN-VERRACO', 'Verraco', 'reproductores', 'UNIDAD', 'Genética y reproducción', false, '{}'),
  ('GEN-LECHON', 'Lechón destetado', 'lechones', 'UNIDAD', 'Compra de lechones para engorde', false, '{}'),
  ('GEN-TERMINADO', 'Cerdo terminado', 'cerdos-terminados', 'KG', null, false, '{}'),
  ('EQU-LAMPARA', 'Lámpara infrarroja', 'calefaccion', 'UNIDAD', 'Mantenimiento', false, '{}'),
  ('EQU-COMEDERO', 'Comedero', 'comederos-bebederos', 'UNIDAD', 'Mantenimiento', false, '{}'),
  ('EQU-BEBEDERO', 'Bebedero tipo chupete', 'comederos-bebederos', 'UNIDAD', 'Mantenimiento', false, '{}'),
  ('EQU-SLAT', 'Slat plástico', 'jaulas-slats', 'UNIDAD', 'Mantenimiento', false, '{}'),
  ('EQU-JAULA-PARIDERA', 'Jaula paridera', 'jaulas-slats', 'UNIDAD', 'Mantenimiento', false, '{}'),
  ('SER-FLETE', 'Flete de animales o insumos', 'flete', 'UNIDAD', 'Flete de entrega', false, '{}'),
  ('SER-VETERINARIO', 'Visita veterinaria', 'veterinario', 'UNIDAD', 'Servicios veterinarios', false, '{}')
) as x(codigo, nombre, cat, unidad, fin, receta, attr)
join "categoria_mercado" c on c."slug" = x.cat
on conflict (codigo) do nothing;
