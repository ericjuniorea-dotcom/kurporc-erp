-- CreateEnum
CREATE TYPE "TipoMovFinanciero" AS ENUM ('INGRESO', 'GASTO', 'INVERSION', 'FINANCIAMIENTO');

-- CreateEnum
CREATE TYPE "Naturaleza" AS ENUM ('FIJO', 'VARIABLE', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('PAGADO', 'PENDIENTE', 'COBRADO', 'POR_COBRAR', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'DEBITO_AUTOMATICO', 'TARJETA', 'CREDITO_PROVEEDOR');

-- CreateEnum
CREATE TYPE "OrigenMovFinanciero" AS ENUM ('MANUAL', 'VENTA', 'CUOTA_PRESTAMO', 'PEDIDO_MERCADO', 'SUELDO', 'PROVISION', 'IMPORTACION', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoCuentaFondos" AS ENUM ('CAJA', 'CAJA_CHICA', 'BANCO', 'COOPERATIVA', 'OTRA');

-- CreateTable
CREATE TABLE "cuenta_fondos" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuentaFondos" NOT NULL,
    "numero_cifrado" TEXT,
    "saldo_inicial_gs" BIGINT NOT NULL DEFAULT 0,
    "fecha_saldo_inicial" DATE,
    "monto_asignado_gs" BIGINT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_fondos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_financiera" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMovFinanciero" NOT NULL,
    "area" TEXT NOT NULL,
    "naturaleza" "Naturaleza" NOT NULL,
    "signo" INTEGER NOT NULL,
    "unidad_default" TEXT NOT NULL,
    "subcategorias" TEXT[],
    "grupo_tablero" TEXT,
    "grupo_costo" TEXT,
    "dieta" TEXT,
    "vida_util" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_financiera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contraparte" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tienda_id" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contraparte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID NOT NULL,
    "granja_id" TEXT,
    "fecha" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "tipo" "TipoMovFinanciero" NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria_id" UUID NOT NULL,
    "subcategoria" TEXT,
    "cantidad" DECIMAL(14,3),
    "unidad_medida" TEXT,
    "contraparte_id" UUID,
    "medio_pago" "MedioPago",
    "cuenta_fondos_id" UUID,
    "monto_gs" BIGINT NOT NULL,
    "estado" "EstadoMovimiento" NOT NULL,
    "observacion" TEXT,
    "naturaleza" "Naturaleza" NOT NULL DEFAULT 'NO_APLICA',
    "area" TEXT NOT NULL DEFAULT '',
    "signo" INTEGER NOT NULL DEFAULT 0,
    "mes" INTEGER NOT NULL DEFAULT 0,
    "precio_unitario_gs" DECIMAL(16,2),
    "producto_sanitario_id" TEXT,
    "ml_por_unidad" DECIMAL(10,2),
    "ml_comprados" DECIMAL(14,2),
    "origen" "OrigenMovFinanciero" NOT NULL DEFAULT 'MANUAL',
    "origen_id" TEXT,
    "es_interno" BOOLEAN NOT NULL DEFAULT false,
    "factura_numero" TEXT,
    "comprobante_path" TEXT,
    "motivo_anulacion" TEXT,
    "anulado_por" TEXT,
    "anulado_en" TIMESTAMP(3),
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_movimiento" (
    "id" UUID NOT NULL,
    "movimiento_id" UUID NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "monto_gs" BIGINT NOT NULL,
    "cuenta_fondos_id" UUID,
    "medio_pago" "MedioPago",
    "comprobante_path" TEXT,
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID NOT NULL,
    "granja_id" TEXT,
    "fecha_salida" DATE NOT NULL,
    "tipo_venta" TEXT NOT NULL,
    "lote_destete_id" TEXT,
    "lote_engorde_id" TEXT,
    "edad_prom_dias" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "kg_totales" DECIMAL(12,2) NOT NULL,
    "modo_precio" TEXT NOT NULL DEFAULT 'POR_KG',
    "precio_gs_kg" BIGINT,
    "precio_gs_cabeza" BIGINT,
    "importe_gs" BIGINT NOT NULL,
    "destino" TEXT NOT NULL,
    "cliente_id" UUID NOT NULL,
    "recibe_por" TEXT,
    "remito_factura" TEXT,
    "guia_traslado" TEXT,
    "fecha_vencimiento_cobro" DATE,
    "movimiento_id" UUID NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamo" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID NOT NULL,
    "acreedor_id" UUID NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto_recibido_gs" BIGINT NOT NULL,
    "cuota_mensual_gs" BIGINT NOT NULL,
    "numero_cuotas" INTEGER NOT NULL,
    "primer_vencimiento" DATE NOT NULL,
    "debito_automatico" BOOLEAN NOT NULL DEFAULT false,
    "cuenta_debito_id" UUID,
    "observacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuota_prestamo" (
    "id" UUID NOT NULL,
    "prestamo_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimiento" DATE NOT NULL,
    "monto_gs" BIGINT NOT NULL,
    "movimiento_id" UUID,

    CONSTRAINT "cuota_prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto_gs" BIGINT NOT NULL,

    CONSTRAINT "presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aporte_capital_previsto" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto_gs" BIGINT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "aporte_capital_previsto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluacion_inversion" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "fecha_prevista" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "monto_total_gs" BIGINT NOT NULL,
    "forma_pago" TEXT NOT NULL,
    "financiamiento_gs" BIGINT NOT NULL DEFAULT 0,
    "plazo_meses" INTEGER NOT NULL DEFAULT 0,
    "tasa_anual" DECIMAL(7,4),
    "estado" TEXT NOT NULL DEFAULT 'EN_EVALUACION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluacion_inversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_financieros" (
    "organizacion_id" TEXT NOT NULL,
    "precio_referencia_lechon_gs" BIGINT NOT NULL DEFAULT 435000,
    "precio_kg_vivo_gs" BIGINT NOT NULL DEFAULT 18500,
    "peso_venta_kg" DECIMAL(6,2) NOT NULL DEFAULT 25,
    "modo_proyeccion_ventas" TEXT NOT NULL DEFAULT 'PARAMETRO',
    "lechones_a_vender_mes" INTEGER NOT NULL DEFAULT 80,
    "precio_esperado_lechon_gs" BIGINT NOT NULL DEFAULT 435000,
    "otros_ingresos_mes_gs" BIGINT NOT NULL DEFAULT 0,
    "colchon_meses_egreso" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "consumo_gestacion_kg_dia" DECIMAL(5,2) NOT NULL DEFAULT 2.5,
    "consumo_lactacion_kg_dia" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "pre_inicial1_kg_lechon" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "pre_inicial2_kg_lechon" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "inicial_kg_lechon" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "tasa_descuento_van" DECIMAL(5,4) NOT NULL DEFAULT 0.12,
    "crecimiento_flujo_anual" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "meta_cobertura_dias" INTEGER NOT NULL DEFAULT 30,
    "alerta_cobertura_dias" INTEGER NOT NULL DEFAULT 20,
    "meta_desvio" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "alerta_desvio" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "vida_obra_anios" INTEGER NOT NULL DEFAULT 20,
    "vida_equipos_anios" INTEGER NOT NULL DEFAULT 10,
    "modo_amortizacion" TEXT NOT NULL DEFAULT 'POR_ACTIVO',
    "amortizar_matrices" BOOLEAN NOT NULL DEFAULT false,
    "vida_matriz_meses" INTEGER NOT NULL DEFAULT 36,
    "valor_descarte_matriz_gs" BIGINT NOT NULL DEFAULT 2000000,
    "imputacion_sanidad" TEXT NOT NULL DEFAULT 'USO',
    "tasa_ips_patronal" DECIMAL(5,4) NOT NULL DEFAULT 0.165,
    "provisionar_aguinaldo" BOOLEAN NOT NULL DEFAULT true,
    "limite_aprobacion_pago_gs" BIGINT,
    "matrices_activas_manual" INTEGER,

    CONSTRAINT "parametros_financieros_pkey" PRIMARY KEY ("organizacion_id")
);

-- CreateTable
CREATE TABLE "cierre_mes" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "unidad_id" UUID,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "saldos_declarados" JSONB NOT NULL DEFAULT '[]',
    "snapshot" JSONB,
    "cerrado_por" TEXT,
    "cerrado_en" TIMESTAMP(3),
    "motivo_reapertura" TEXT,

    CONSTRAINT "cierre_mes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldo_declarado" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "cuenta_fondos_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "saldo_gs" BIGINT NOT NULL,
    "observacion" TEXT,
    "declarado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_declarado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causa_desvio" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "categoria_id" UUID NOT NULL,
    "mes" INTEGER NOT NULL,
    "causa" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "causa_desvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recomendacion" (
    "id" UUID NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "problema" TEXT NOT NULL,
    "situacion" TEXT NOT NULL,
    "mejora" TEXT NOT NULL,
    "impacto" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "generada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recomendacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacion_fila_original" (
    "id" BIGSERIAL NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "importacion_id" UUID NOT NULL,
    "archivo" TEXT NOT NULL,
    "hoja" TEXT NOT NULL,
    "fila" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacion_fila_original_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_fondos_organizacion_id_nombre_key" ON "cuenta_fondos"("organizacion_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_financiera_organizacion_id_nombre_key" ON "categoria_financiera"("organizacion_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "contraparte_organizacion_id_nombre_key" ON "contraparte"("organizacion_id", "nombre");

-- CreateIndex
CREATE INDEX "movimiento_organizacion_id_mes_idx" ON "movimiento"("organizacion_id", "mes");

-- CreateIndex
CREATE INDEX "movimiento_organizacion_id_categoria_id_mes_idx" ON "movimiento"("organizacion_id", "categoria_id", "mes");

-- CreateIndex
CREATE INDEX "movimiento_organizacion_id_estado_idx" ON "movimiento"("organizacion_id", "estado");

-- CreateIndex
CREATE INDEX "pago_movimiento_movimiento_id_idx" ON "pago_movimiento"("movimiento_id");

-- CreateIndex
CREATE INDEX "pago_movimiento_fecha_pago_idx" ON "pago_movimiento"("fecha_pago");

-- CreateIndex
CREATE INDEX "venta_organizacion_id_fecha_salida_idx" ON "venta"("organizacion_id", "fecha_salida");

-- CreateIndex
CREATE UNIQUE INDEX "cuota_prestamo_prestamo_id_numero_key" ON "cuota_prestamo"("prestamo_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_organizacion_id_unidad_id_categoria_id_mes_key" ON "presupuesto"("organizacion_id", "unidad_id", "categoria_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_mes_organizacion_id_unidad_id_mes_key" ON "cierre_mes"("organizacion_id", "unidad_id", "mes");

-- CreateIndex
CREATE INDEX "saldo_declarado_organizacion_id_cuenta_fondos_id_fecha_idx" ON "saldo_declarado"("organizacion_id", "cuenta_fondos_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "causa_desvio_organizacion_id_categoria_id_mes_key" ON "causa_desvio"("organizacion_id", "categoria_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "recomendacion_organizacion_id_codigo_mes_key" ON "recomendacion"("organizacion_id", "codigo", "mes");

-- CreateIndex
CREATE INDEX "importacion_fila_original_organizacion_id_importacion_id_idx" ON "importacion_fila_original"("organizacion_id", "importacion_id");

-- AddForeignKey
ALTER TABLE "cuenta_fondos" ADD CONSTRAINT "cuenta_fondos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_financiera" ADD CONSTRAINT "categoria_financiera_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contraparte" ADD CONSTRAINT "contraparte_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_financiera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_contraparte_id_fkey" FOREIGN KEY ("contraparte_id") REFERENCES "contraparte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_movimiento" ADD CONSTRAINT "pago_movimiento_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuota_prestamo" ADD CONSTRAINT "cuota_prestamo_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aporte_capital_previsto" ADD CONSTRAINT "aporte_capital_previsto_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_inversion" ADD CONSTRAINT "evaluacion_inversion_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_financieros" ADD CONSTRAINT "parametros_financieros_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_mes" ADD CONSTRAINT "cierre_mes_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_declarado" ADD CONSTRAINT "saldo_declarado_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "causa_desvio" ADD CONSTRAINT "causa_desvio_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacion" ADD CONSTRAINT "recomendacion_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Fase 8 · SQL propio: reglas del libro, cierres, seguridad y catálogo

alter table public.movimiento add constraint movimiento_monto_positivo check (monto_gs > 0);
alter table public.movimiento add constraint movimiento_cantidad_positiva check (cantidad is null or cantidad > 0);
alter table public.pago_movimiento add constraint pago_monto_positivo check (monto_gs > 0);
alter table public.categoria_financiera add constraint categoria_signo check (signo in (-1, 1));
-- una categoría del sistema por nombre (el unique con organizacion_id null no lo impide)
create unique index categoria_financiera_sistema_nombre on public.categoria_financiera (nombre) where organizacion_id is null;

-- ¿El mes está cerrado para la organización?
create or replace function public.mes_cerrado(p_org text, p_mes int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cierre_mes where organizacion_id = p_org and unidad_id is null and mes = p_mes and estado = 'CERRADO');
$$;
revoke all on function public.mes_cerrado(text, int) from public;

-- Completa las columnas automáticas (N a T y W de la planilla) y valida
create or replace function public.completar_movimiento() returns trigger
language plpgsql set search_path = public as $$
declare c record;
begin
  if tg_op = 'UPDATE' and old.estado = 'ANULADO' then
    raise exception 'Un movimiento anulado no se modifica';
  end if;
  if tg_op = 'UPDATE' and old.organizacion_id <> new.organizacion_id then
    raise exception 'Un movimiento no cambia de organización';
  end if;
  new.mes := extract(year from new.fecha)::int * 100 + extract(month from new.fecha)::int;
  if public.mes_cerrado(new.organizacion_id, new.mes)
     or (tg_op = 'UPDATE' and public.mes_cerrado(old.organizacion_id, old.mes)) then
    raise exception 'El mes % está cerrado: reabrilo para hacer cambios', new.mes;
  end if;
  select tipo, naturaleza, area, signo, organizacion_id into c from public.categoria_financiera where id = new.categoria_id;
  if not found or (c.organizacion_id is not null and c.organizacion_id <> new.organizacion_id) then
    raise exception 'Categoría inexistente para esta organización';
  end if;
  if c.tipo <> new.tipo then
    raise exception 'La categoría no corresponde al tipo de movimiento';
  end if;
  new.naturaleza := c.naturaleza;
  new.area := c.area;
  new.signo := c.signo;
  new.precio_unitario_gs := case when new.cantidad is not null and new.cantidad > 0 then round(new.monto_gs / new.cantidad, 2) end;
  new.ml_comprados := case when new.cantidad is not null and new.ml_por_unidad is not null then new.cantidad * new.ml_por_unidad end;
  return new;
end $$;
create trigger completar before insert or update on public.movimiento
  for each row execute function public.completar_movimiento();

-- Nunca se borra un movimiento ni un pago: se anula. Solo se permite cuando se elimina la organización entera (cascada).
create or replace function public.prohibir_borrado_financiero() returns trigger
language plpgsql set search_path = public as $$
declare v_org text;
begin
  if tg_table_name = 'pago_movimiento' then
    select organizacion_id into v_org from public.movimiento where id = old.movimiento_id;
    if v_org is null then return old; end if;  -- el movimiento ya se borró en cascada
  else
    v_org := old.organizacion_id;
  end if;
  if exists (select 1 from public.tenants where id = v_org) then
    raise exception 'Los registros financieros no se borran: se anulan con motivo';
  end if;
  return old;
end $$;
create trigger sin_borrar before delete on public.movimiento
  for each row execute function public.prohibir_borrado_financiero();
create trigger sin_borrar before delete on public.pago_movimiento
  for each row execute function public.prohibir_borrado_financiero();

-- Pagos: no en anulados ni en meses cerrados, nunca más que el monto; el estado se recalcula solo
create or replace function public.validar_pago() returns trigger
language plpgsql set search_path = public as $$
declare m record; v_pagado bigint;
begin
  if tg_op = 'UPDATE' then raise exception 'Un pago registrado no se modifica'; end if;
  select organizacion_id, monto_gs, estado into m from public.movimiento where id = new.movimiento_id for update;
  if m.estado = 'ANULADO' then raise exception 'No se registran pagos sobre un movimiento anulado'; end if;
  if public.mes_cerrado(m.organizacion_id, extract(year from new.fecha_pago)::int * 100 + extract(month from new.fecha_pago)::int) then
    raise exception 'El mes del pago está cerrado';
  end if;
  select coalesce(sum(monto_gs), 0) into v_pagado from public.pago_movimiento where movimiento_id = new.movimiento_id;
  if v_pagado + new.monto_gs > m.monto_gs then
    raise exception 'El pago supera el saldo del movimiento (saldo: %)', m.monto_gs - v_pagado;
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.pago_movimiento
  for each row execute function public.validar_pago();

create or replace function public.recalcular_estado_movimiento() returns trigger
language plpgsql set search_path = public as $$
declare m record; v_pagado bigint;
begin
  select id, monto_gs, signo, estado into m from public.movimiento where id = new.movimiento_id;
  if m.estado = 'ANULADO' then return null; end if;
  select coalesce(sum(monto_gs), 0) into v_pagado from public.pago_movimiento where movimiento_id = m.id;
  update public.movimiento
     set estado = (case
       when v_pagado >= m.monto_gs then (case when m.signo > 0 then 'COBRADO' else 'PAGADO' end)
       else (case when m.signo > 0 then 'POR_COBRAR' else 'PENDIENTE' end) end)::"EstadoMovimiento"
   where id = m.id
     and estado is distinct from (case
       when v_pagado >= m.monto_gs then (case when m.signo > 0 then 'COBRADO' else 'PAGADO' end)
       else (case when m.signo > 0 then 'POR_COBRAR' else 'PENDIENTE' end) end)::"EstadoMovimiento";
  return null;
end $$;
create trigger recalcular_estado after insert on public.pago_movimiento
  for each row execute function public.recalcular_estado_movimiento();

create or replace view public.v_movimiento_saldo with (security_invoker = true) as
  select m.id, m.organizacion_id, m.monto_gs, coalesce(sum(p.monto_gs), 0)::bigint as pagado_gs,
         (m.monto_gs - coalesce(sum(p.monto_gs), 0))::bigint as saldo_gs
    from public.movimiento m
    left join public.pago_movimiento p on p.movimiento_id = m.id
   where m.estado <> 'ANULADO'
   group by m.id;

do $$
declare t text; r text;
begin
  foreach t in array array['cuenta_fondos', 'categoria_financiera', 'contraparte', 'movimiento', 'pago_movimiento', 'venta',
    'prestamo', 'cuota_prestamo', 'presupuesto', 'aporte_capital_previsto', 'evaluacion_inversion', 'parametros_financieros',
    'cierre_mes', 'saldo_declarado', 'causa_desvio', 'recomendacion', 'importacion_fila_original'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.v_movimiento_saldo from %I', r);
    end if;
  end loop;
end $$;

-- Políticas de lectura (por si en el futuro se abre la API): solo la propia organización
do $$
declare t text;
begin
  foreach t in array array['cuenta_fondos', 'contraparte', 'movimiento', 'venta', 'prestamo', 'presupuesto', 'aporte_capital_previsto',
    'evaluacion_inversion', 'parametros_financieros', 'cierre_mes', 'saldo_declarado', 'causa_desvio', 'recomendacion'] loop
    execute format('create policy org_select on public.%I for select to authenticated using (organizacion_id in (select public.mis_orgs()))', t);
  end loop;
end $$;
create policy org_select on public.categoria_financiera for select to authenticated
  using (organizacion_id is null or organizacion_id in (select public.mis_orgs()));
create policy org_select on public.pago_movimiento for select to authenticated
  using (movimiento_id in (select id from public.movimiento where organizacion_id in (select public.mis_orgs())));
create policy org_select on public.cuota_prestamo for select to authenticated
  using (prestamo_id in (select id from public.prestamo where organizacion_id in (select public.mis_orgs())));

do $$
declare t text;
begin
  foreach t in array array['cuenta_fondos', 'categoria_financiera', 'contraparte', 'movimiento', 'pago_movimiento', 'venta',
    'prestamo', 'cuota_prestamo', 'presupuesto', 'aporte_capital_previsto', 'evaluacion_inversion', 'parametros_financieros',
    'cierre_mes', 'saldo_declarado', 'causa_desvio'] loop
    execute format('drop trigger if exists historial on public.%I', t);
    execute format('create trigger historial after insert or update or delete on public.%I for each row execute function public.registrar_cambio()', t);
  end loop;
end $$;

alter table public.categoria_financiera alter column id set default gen_random_uuid();
-- Sin fábrica de balanceado (decisión 16): el balanceado se compra a proveedores.
insert into public.categoria_financiera (nombre, tipo, area, naturaleza, signo, unidad_default, subcategorias, grupo_tablero, grupo_costo, dieta, vida_util, orden, es_sistema) values
  ('Venta de lechones',                  'INGRESO',        'Comercial',       'NO_APLICA', 1,  'GRANJA', array['Engorde','Consumo','Carneado'], null, null, null, null, 10, true),
  ('Venta de madres',                    'INGRESO',        'Comercial',       'NO_APLICA', 1,  'GRANJA', array['Matriz de descarte'], null, null, null, null, 11, true),
  ('Venta de reproductores',             'INGRESO',        'Comercial',       'NO_APLICA', 1,  'GRANJA', array['Macho','Dosis seminales'], null, null, null, null, 12, true),
  ('Venta de cerdos terminados',         'INGRESO',        'Comercial',       'NO_APLICA', 1,  'GRANJA', array['Frigorífico','Consumo'], null, null, null, null, 13, true),
  ('Otros ingresos',                     'INGRESO',        'Comercial',       'NO_APLICA', 1,  'GRANJA', array['Chatarra','Servicios'], null, null, null, null, 14, true),
  ('Balanceado de gestación',            'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'GESTACION', null, 20, true),
  ('Balanceado de lactación',            'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'LACTACION', null, 21, true),
  ('Vilo Baby',                          'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Creep feed'], 'BALANCEADO', 'ALIMENTACION', 'VILO_BABY', null, 22, true),
  ('Pre-inicial 1',                      'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'PRE_INICIAL_1', null, 23, true),
  ('Pre-inicial 2',                      'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'PRE_INICIAL_2', null, 24, true),
  ('Inicial',                            'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'INICIAL', null, 25, true),
  ('Balanceado de crecimiento',          'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'CRECIMIENTO', null, 26, true),
  ('Balanceado de terminación',          'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Comprado a proveedor'], 'BALANCEADO', 'ALIMENTACION', 'TERMINACION', null, 27, true),
  ('Sanidad',                            'GASTO',          'Sanidad',         'VARIABLE', -1,  'GRANJA', array['Vacunas','Medicamentos','Insumos descartables'], 'SANIDAD_VET', 'OTROS_DIRECTOS', null, null, 30, true),
  ('Servicios veterinarios',             'GASTO',          'Sanidad',         'VARIABLE', -1,  'GRANJA', array['Honorarios','Ecografía'], 'SANIDAD_VET', 'OTROS_DIRECTOS', null, null, 31, true),
  ('Genética y reproducción',            'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Dosis seminales'], 'GENETICA', 'OTROS_DIRECTOS', null, null, 32, true),
  ('Compra de lechones para engorde',    'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Lechones'], 'GENETICA', 'OTROS_DIRECTOS', null, null, 33, true),
  ('Personal producción',                'GASTO',          'Producción',      'FIJO',     -1,  'GRANJA', array['Oficial de granja','Jornales'], 'PERSONAL', 'OTROS_DIRECTOS', null, null, 40, true),
  ('Personal administración',            'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['Administrador de granja'], 'PERSONAL', 'ESTRUCTURA', null, null, 41, true),
  ('Cargas sociales (IPS y aguinaldo)',  'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['IPS','Provisión de aguinaldo'], 'PERSONAL', 'ESTRUCTURA', null, null, 42, true),
  ('Energía',                            'GASTO',          'Producción',      'FIJO',     -1,  'GRANJA', array['Energía eléctrica'], 'ENERGIA_AGUA', 'OTROS_DIRECTOS', null, null, 50, true),
  ('Agua',                               'GASTO',          'Producción',      'FIJO',     -1,  'GRANJA', array['Agua'], 'ENERGIA_AGUA', 'OTROS_DIRECTOS', null, null, 51, true),
  ('Limpieza',                           'GASTO',          'Producción',      'VARIABLE', -1,  'GRANJA', array['Insumos de limpieza'], 'MANT_LIMPIEZA', 'OTROS_DIRECTOS', null, null, 52, true),
  ('Mantenimiento',                      'GASTO',          'Mantenimiento',   'FIJO',     -1,  'GRANJA', array['Equipos','Repuestos'], 'MANT_LIMPIEZA', 'OTROS_DIRECTOS', null, null, 53, true),
  ('Flete de entrega',                   'GASTO',          'Logística',       'VARIABLE', -1,  'GRANJA', array['Entrega de lechones'], 'LOGISTICA', 'OTROS_DIRECTOS', null, null, 60, true),
  ('Combustible',                        'GASTO',          'Logística',       'VARIABLE', -1,  'GRANJA', array['Retiro de semen','Viajes'], 'LOGISTICA', 'OTROS_DIRECTOS', null, null, 61, true),
  ('Servicios',                          'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['Internet','Telefonía'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 70, true),
  ('Servicios profesionales',            'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['Contabilidad','Asesoría'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 71, true),
  ('Impuestos y tasas',                  'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['IVA','IRE','Tasas','Servicio sanitario'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 72, true),
  ('Gastos bancarios',                   'GASTO',          'Administración',  'FIJO',     -1,  'GRANJA', array['Comisiones'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 73, true),
  ('Comercial y marketing',              'GASTO',          'Comercial',       'VARIABLE', -1,  'GRANJA', array['Publicidad','Carneo','Envases'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 74, true),
  ('Otros gastos',                       'GASTO',          'Otros',           'FIJO',     -1,  'GRANJA', array['A clasificar'], 'ADMIN_OTROS', 'ESTRUCTURA', null, null, 75, true),
  ('Terreno',                            'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'COMUN',  array['Terreno','Titulación'], null, null, null, null, 80, true),
  ('Obra civil',                         'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'GRANJA', array['Gestación','Paridera','Casa','Destete'], null, null, null, 'OBRA', 81, true),
  ('Jaulas',                             'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'GRANJA', array['Gestación','Maternidad'], null, null, null, 'EQUIPOS', 82, true),
  ('Electricidad',                       'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'COMUN',  array['Instalación eléctrica','Tableros'], null, null, null, 'OBRA', 83, true),
  ('Equipamiento',                       'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'GRANJA', array['Equipamiento médico','Cámaras','Herramientas'], null, null, null, 'EQUIPOS', 84, true),
  ('Vehículos',                          'INVERSION',      'Logística',       'NO_APLICA', -1, 'COMUN',  array['Motocicleta','Camión'], null, null, null, 'EQUIPOS', 85, true),
  ('Matrices y reproductores',           'INVERSION',      'Producción',      'NO_APLICA', -1, 'GRANJA', array['Matrices','Reproductor'], null, null, null, 'MATRIZ', 86, true),
  ('Otras inversiones',                  'INVERSION',      'Infraestructura', 'NO_APLICA', -1, 'COMUN',  array['A clasificar'], null, null, null, null, 87, true),
  ('Préstamo recibido',                  'FINANCIAMIENTO', 'Administración',  'NO_APLICA', 1,  'COMUN',  array['Banco','Cooperativa'], null, null, null, null, 90, true),
  ('Aporte de capital',                  'FINANCIAMIENTO', 'Administración',  'NO_APLICA', 1,  'COMUN',  array['Aporte del titular','Aporte de socios'], null, null, null, null, 91, true),
  ('Pago de cuota de préstamo',          'FINANCIAMIENTO', 'Administración',  'NO_APLICA', -1, 'COMUN',  array['Capital + interés'], null, null, null, null, 92, true),
  ('Intereses y comisiones',             'FINANCIAMIENTO', 'Administración',  'NO_APLICA', -1, 'COMUN',  array['Intereses','Comisiones'], null, null, null, null, 93, true),
  ('Retiro del titular',                 'FINANCIAMIENTO', 'Administración',  'NO_APLICA', -1, 'COMUN',  array['Retiro de utilidades'], null, null, null, null, 94, true);
alter table public.categoria_financiera alter column id drop default;
