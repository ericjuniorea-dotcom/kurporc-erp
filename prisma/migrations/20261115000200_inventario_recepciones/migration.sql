-- Inventario (ex Logística) · Parte 1: la compra se registra en Finanzas y llega a Inventario como recepción
-- pendiente; el encargado la acepta y recién ahí entra al stock (con lote, vencimiento y costo).
-- Cada movimiento de stock guarda qué persona lo hizo.

create table "recepcion_inventario" (
  "id"                uuid not null default gen_random_uuid(),
  "tenant_id"         text not null,
  "movimiento_id"     uuid,
  "producto_id"       text not null,
  "cantidad"          decimal(12,3) not null,
  "costo_unitario"    decimal(14,4),
  "proveedor"         text,
  "numero_lote"       text,
  "fecha_vencimiento" date,
  "comprado_por"      text not null,
  "estado"            text not null default 'PENDIENTE',
  "cantidad_recibida" decimal(12,3),
  "lote_id"           text,
  "resuelta_por"      text,
  "resuelta_en"       timestamp(3),
  "nota"              text,
  "created_at"        timestamp(3) not null default current_timestamp,
  constraint "recepcion_inventario_pkey" primary key ("id"),
  constraint "recepcion_inventario_estado_ck" check ("estado" in ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'ANULADA')),
  constraint "recepcion_inventario_cantidad_ck" check ("cantidad" > 0 and ("cantidad_recibida" is null or "cantidad_recibida" >= 0))
);
create index "recepcion_inventario_tenant_id_estado_idx" on "recepcion_inventario"("tenant_id", "estado");
create index "recepcion_inventario_movimiento_id_idx" on "recepcion_inventario"("movimiento_id");
alter table "recepcion_inventario" add constraint "recepcion_inventario_movimiento_id_fkey"
  foreign key ("movimiento_id") references "movimiento"("id") on delete set null on update cascade;
alter table "recepcion_inventario" add constraint "recepcion_inventario_producto_id_fkey"
  foreign key ("producto_id") references "vacunas"("id") on delete restrict on update cascade;
alter table "recepcion_inventario" add constraint "recepcion_inventario_lote_id_fkey"
  foreign key ("lote_id") references "lotes_vacunas"("id") on delete set null on update cascade;

-- Quién hizo cada movimiento de stock (compra recibida, vacuna aplicada, balanceado del día…)
alter table "movimientos_inventario" add column "usuario_id" text, add column "nota" text;

do $do$
declare r text;
begin
  alter table public.recepcion_inventario enable row level security;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.recepcion_inventario from %I', r);
    end if;
  end loop;
end $do$;
