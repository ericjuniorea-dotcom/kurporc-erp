-- CreateTable
CREATE TABLE "documento_legal" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "contenido_md" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "resumen_cambios" TEXT,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "requiere_reaceptacion" BOOLEAN NOT NULL DEFAULT true,
    "aprobado_por_asesor" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "vigente_desde" TIMESTAMP(3),
    "publicado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceptacion_documento" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "organizacion_id" TEXT,
    "actua_como" TEXT NOT NULL DEFAULT 'PERSONA',
    "documento_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "aceptado" BOOLEAN NOT NULL,
    "texto_casilla" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "metodo" TEXT NOT NULL DEFAULT 'CASILLA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceptacion_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_privacidad" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "vence_en" TIMESTAMP(3) NOT NULL,
    "respuesta" TEXT,
    "atendida_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_en" TIMESTAMP(3),

    CONSTRAINT "solicitud_privacidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_plataforma" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "razon_social" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "domicilio" TEXT NOT NULL,
    "correo_contacto" TEXT NOT NULL,
    "correo_privacidad" TEXT NOT NULL,
    "whatsapp_soporte" TEXT,
    "ciudad_jurisdiccion" TEXT NOT NULL DEFAULT 'Asunción',

    CONSTRAINT "configuracion_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_legal_codigo_estado_idx" ON "documento_legal"("codigo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "documento_legal_codigo_version_key" ON "documento_legal"("codigo", "version");

-- CreateIndex
CREATE INDEX "aceptacion_documento_user_id_codigo_idx" ON "aceptacion_documento"("user_id", "codigo");

-- CreateIndex
CREATE INDEX "solicitud_privacidad_user_id_idx" ON "solicitud_privacidad"("user_id");

-- CreateIndex
CREATE INDEX "solicitud_privacidad_estado_vence_en_idx" ON "solicitud_privacidad"("estado", "vence_en");

-- AddForeignKey
ALTER TABLE "aceptacion_documento" ADD CONSTRAINT "aceptacion_documento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento_legal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ================================================================
-- FASE 4 — Contratos: evidencia inmutable y documentos versionados
-- ================================================================
alter table public.documento_legal enable row level security;
alter table public.aceptacion_documento enable row level security;
alter table public.solicitud_privacidad enable row level security;
alter table public.configuracion_plataforma enable row level security;

-- Una persona ve sus propias aceptaciones y solicitudes (el resto: solo servidor)
create policy propio_select on public.aceptacion_documento for select to authenticated
  using (user_id = public.usuario_actual());
create policy propio_select on public.solicitud_privacidad for select to authenticated
  using (user_id = public.usuario_actual());
-- Los documentos publicados son públicos
create policy publicados_select on public.documento_legal for select to anon, authenticated
  using (estado = 'PUBLICADO');

-- La constancia de aceptación nunca se modifica ni se borra (D16)
drop trigger if exists solo_agregar on public.aceptacion_documento;
create trigger solo_agregar before update or delete on public.aceptacion_documento
  for each row execute function public.prohibir_modificacion();
drop trigger if exists solo_agregar_truncate on public.aceptacion_documento;
create trigger solo_agregar_truncate before truncate on public.aceptacion_documento
  for each statement execute function public.prohibir_modificacion();
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on public.aceptacion_documento from %I', r);
    end if;
  end loop;
end $$;

-- Un documento ya publicado no puede cambiar su texto: los cambios van en una versión nueva.
-- Solo se permite cambiar su estado (PUBLICADO → RETIRADO) y la marca de aprobación del asesor.
create or replace function public.proteger_documento_publicado() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.estado <> 'BORRADOR' then
      raise exception 'No se puede borrar un documento legal publicado (%, versión %)', old.codigo, old.version
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if old.estado <> 'BORRADOR' and (
       new.contenido_md is distinct from old.contenido_md or new.hash_sha256 is distinct from old.hash_sha256
    or new.resumen is distinct from old.resumen or new.titulo is distinct from old.titulo
    or new.version is distinct from old.version or new.codigo is distinct from old.codigo) then
    raise exception 'El documento % versión % ya fue publicado: para cambiarlo, creá una versión nueva', old.codigo, old.version
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists proteger_publicado on public.documento_legal;
create trigger proteger_publicado before update or delete on public.documento_legal
  for each row execute function public.proteger_documento_publicado();

-- Historial de cambios (Fase 2) en documentos, configuración y solicitudes
do $$
declare t text;
begin
  foreach t in array array['documento_legal', 'configuracion_plataforma', 'solicitud_privacidad'] loop
    execute format('drop trigger if exists historial on public.%I', t);
    execute format('create trigger historial after insert or update or delete on public.%I for each row execute function public.registrar_cambio()', t);
  end loop;
end $$;
