-- Fase 13 · Cotizaciones, pedidos, eventos, reseñas y vínculo stock ↔ catálogo.

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'ENVIADO', 'CONFIRMADO', 'RECHAZADO', 'EN_CAMINO', 'ENTREGADO', 'RECIBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPagoPedido" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'CONTRA_ENTREGA', 'CREDITO_VENDEDOR');

-- CreateTable
CREATE TABLE "solicitud_cotizacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comprador_id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "granja_destino_id" TEXT,
    "departamento" TEXT NOT NULL,
    "fecha_requerida" DATE,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "nota" TEXT,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_cotizacion_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitud_id" UUID NOT NULL,
    "producto_catalogo_id" UUID NOT NULL,
    "cantidad_base" DECIMAL(14,3) NOT NULL,
    "nota" TEXT,

    CONSTRAINT "solicitud_cotizacion_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_cotizacion_tienda" (
    "solicitud_id" UUID NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "vista_en" TIMESTAMP(3),

    CONSTRAINT "solicitud_cotizacion_tienda_pkey" PRIMARY KEY ("solicitud_id","tienda_id")
);

-- CreateTable
CREATE TABLE "respuesta_cotizacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitud_id" UUID NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "costo_envio_gs" BIGINT NOT NULL DEFAULT 0,
    "plazo_dias" INTEGER NOT NULL,
    "valida_hasta" DATE NOT NULL,
    "nota" TEXT,
    "respondida_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuesta_cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" TEXT NOT NULL,
    "comprador_id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID,
    "granja_destino_id" TEXT,
    "tienda_id" TEXT NOT NULL,
    "respuesta_id" UUID,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'BORRADOR',
    "subtotal_gs" BIGINT NOT NULL,
    "envio_gs" BIGINT NOT NULL DEFAULT 0,
    "total_gs" BIGINT NOT NULL,
    "metodo_pago" "MetodoPagoPedido" NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "direccion" TEXT,
    "fecha_estimada" DATE,
    "aprobado_por" TEXT,
    "notas" TEXT,
    "movimiento_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "publicacion_id" UUID,
    "producto_catalogo_id" UUID,
    "descripcion" TEXT NOT NULL,
    "unidad_venta" TEXT NOT NULL,
    "unidad_base" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "contenido_base" DECIMAL(12,3) NOT NULL,
    "precio_unitario_gs" BIGINT NOT NULL,
    "subtotal_gs" BIGINT NOT NULL,
    "cantidad_recibida" DECIMAL(14,3),

    CONSTRAINT "pedido_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "estado" "EstadoPedido" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resena" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "respuesta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_item_catalogo" (
    "organizacion_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "producto_catalogo_id" UUID NOT NULL,

    CONSTRAINT "stock_item_catalogo_pkey" PRIMARY KEY ("organizacion_id","stock_item_id")
);

-- CreateIndex
CREATE INDEX "solicitud_cotizacion_organizacion_id_estado_idx" ON "solicitud_cotizacion"("organizacion_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_cotizacion_tienda_tienda_id_idx" ON "solicitud_cotizacion_tienda"("tienda_id");

-- CreateIndex
CREATE UNIQUE INDEX "respuesta_cotizacion_solicitud_id_tienda_id_key" ON "respuesta_cotizacion"("solicitud_id", "tienda_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_numero_key" ON "pedido"("numero");

-- CreateIndex
CREATE INDEX "pedido_tienda_id_estado_idx" ON "pedido"("tienda_id", "estado");

-- CreateIndex
CREATE INDEX "pedido_organizacion_id_estado_idx" ON "pedido"("organizacion_id", "estado");

-- CreateIndex
CREATE INDEX "pedido_evento_pedido_id_created_at_idx" ON "pedido_evento"("pedido_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "resena_pedido_id_key" ON "resena"("pedido_id");

-- CreateIndex
CREATE INDEX "resena_tienda_id_created_at_idx" ON "resena"("tienda_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_item_catalogo_organizacion_id_producto_catalogo_id_idx" ON "stock_item_catalogo"("organizacion_id", "producto_catalogo_id");

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion" ADD CONSTRAINT "solicitud_cotizacion_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion" ADD CONSTRAINT "solicitud_cotizacion_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion_item" ADD CONSTRAINT "solicitud_cotizacion_item_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion_item" ADD CONSTRAINT "solicitud_cotizacion_item_producto_catalogo_id_fkey" FOREIGN KEY ("producto_catalogo_id") REFERENCES "producto_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion_tienda" ADD CONSTRAINT "solicitud_cotizacion_tienda_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cotizacion_tienda" ADD CONSTRAINT "solicitud_cotizacion_tienda_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("organizacion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_cotizacion" ADD CONSTRAINT "respuesta_cotizacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_cotizacion" ADD CONSTRAINT "respuesta_cotizacion_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("organizacion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("organizacion_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_respuesta_id_fkey" FOREIGN KEY ("respuesta_id") REFERENCES "respuesta_cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "publicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_producto_catalogo_id_fkey" FOREIGN KEY ("producto_catalogo_id") REFERENCES "producto_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_evento" ADD CONSTRAINT "pedido_evento_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resena" ADD CONSTRAINT "resena_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resena" ADD CONSTRAINT "resena_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("organizacion_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_catalogo" ADD CONSTRAINT "stock_item_catalogo_producto_catalogo_id_fkey" FOREIGN KEY ("producto_catalogo_id") REFERENCES "producto_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Reglas de datos ────────────────────────────────────────────────────────
alter table "solicitud_cotizacion_item" add constraint "sci_cantidad_ck" check ("cantidad_base" > 0);
alter table "solicitud_cotizacion" add constraint "sc_estado_ck" check ("estado" in ('ABIERTA', 'CERRADA', 'VENCIDA', 'CANCELADA'));
alter table "solicitud_cotizacion" add constraint "sc_origen_ck" check ("origen" in ('MANUAL', 'MOTOR_NECESIDADES'));
alter table "respuesta_cotizacion" add constraint "rc_valores_ck" check ("costo_envio_gs" >= 0 and "plazo_dias" >= 0);
alter table "pedido" add constraint "pedido_montos_ck" check ("subtotal_gs" >= 0 and "envio_gs" >= 0 and "total_gs" = "subtotal_gs" + "envio_gs");
alter table "pedido_item" add constraint "pedido_item_ck" check ("cantidad" > 0 and "contenido_base" > 0 and "precio_unitario_gs" >= 0 and "subtotal_gs" >= 0);
alter table "resena" add constraint "resena_calificacion_ck" check ("calificacion" between 1 and 5);

-- ── Numeración PED-AAAA-000123 ─────────────────────────────────────────────
create sequence if not exists public.pedido_numero_seq;
create or replace function public.siguiente_numero_pedido() returns text
  language sql volatile set search_path = '' as
$fn$ select 'PED-' || to_char(now() at time zone 'America/Asuncion', 'YYYY') || '-' || lpad(nextval('public.pedido_numero_seq')::text, 6, '0') $fn$;

-- ── Ningún cambio de estado sin pedido_evento ──────────────────────────────
-- El evento lo escribe la base con el actor de la transacción (app.actor_id) y la nota (app.nota).
create or replace function public.registrar_evento_pedido() returns trigger
  language plpgsql security definer set search_path = '' as
$fn$
declare actor text := nullif(current_setting('app.actor_id', true), '');
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;
  if actor is null then
    raise exception 'Cambio de estado de pedido sin actor (app.actor_id)' using errcode = 'insufficient_privilege';
  end if;
  insert into public.pedido_evento (pedido_id, estado, actor_id, nota)
  values (new.id, new.estado, actor, nullif(current_setting('app.nota', true), ''));
  return new;
end
$fn$;
drop trigger if exists evento_pedido on public.pedido;
create trigger evento_pedido after insert or update of estado on public.pedido
  for each row execute function public.registrar_evento_pedido();

-- pedido_evento es de solo agregar
create or replace function public.pedido_evento_inmutable() returns trigger
  language plpgsql as
$fn$
begin
  raise exception 'pedido_evento no se modifica ni se borra' using errcode = 'insufficient_privilege';
end
$fn$;
drop trigger if exists inmutable on public.pedido_evento;
create trigger inmutable before update or delete on public.pedido_evento
  for each row when (pg_trigger_depth() = 0) execute function public.pedido_evento_inmutable();

-- ── Calificación de la tienda = promedio de sus reseñas ─────────────────────
create or replace function public.recalcular_calificacion_tienda() returns trigger
  language plpgsql security definer set search_path = '' as
$fn$
declare t text := coalesce(new.tienda_id, old.tienda_id);
begin
  update public.tienda set
    calificacion = coalesce((select round(avg(calificacion)::numeric, 2) from public.resena where tienda_id = t), 0),
    total_resenas = (select count(*) from public.resena where tienda_id = t)
  where organizacion_id = t;
  return null;
end
$fn$;
drop trigger if exists calificacion on public.resena;
create trigger calificacion after insert or update of calificacion or delete on public.resena
  for each row execute function public.recalcular_calificacion_tienda();

-- ── Acceso: solo desde el servidor ─────────────────────────────────────────
do $do$
declare t text; r text;
begin
  foreach t in array array['solicitud_cotizacion', 'solicitud_cotizacion_item', 'solicitud_cotizacion_tienda', 'respuesta_cotizacion',
                           'pedido', 'pedido_item', 'pedido_evento', 'resena', 'stock_item_catalogo'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on sequence public.pedido_numero_seq from %I', r);
      execute format('revoke execute on function public.siguiente_numero_pedido() from %I', r);
    end if;
  end loop;
end $do$;
