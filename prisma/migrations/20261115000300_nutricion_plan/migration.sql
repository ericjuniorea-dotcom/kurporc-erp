-- Sanidad y Nutrición · Parte 3: cada tipo de balanceado pertenece a un módulo y tiene su consumo teórico.
-- Puede haber varios balanceados por módulo (lechones: Vilo Baby, Pre-inicial 1 y 2; engorde: crecimiento y terminación).
drop index if exists "feed_types_tenantId_phase_key";

alter table "feed_types"
  add column "modulo" text,
  add column "kg_por_animal_dia" decimal(8,3),
  add column "por" text not null default 'TOTAL';

update "feed_types" set "modulo" = case "phase"
  when 'GESTATION'   then 'GESTACION'
  when 'LACTATION'   then 'MATERNIDAD_HEMBRAS'
  when 'PRE_STARTER' then 'MATERNIDAD_LECHONES'
  when 'PHASE_1'     then 'INICIACION'
  when 'PHASE_2'     then 'INICIACION'
  when 'GROWING'     then 'ENGORDE'
  else 'GESTACION' end;
update "feed_types" set "por" = case "modulo"
  when 'GESTACION' then 'HEMBRA' when 'MATERNIDAD_HEMBRAS' then 'HEMBRA' when 'MATERNIDAD_LECHONES' then 'LECHON' else 'TOTAL' end;

alter table "feed_types" alter column "modulo" set not null;
alter table "feed_types" add constraint "feed_types_modulo_ck"
  check ("modulo" in ('GESTACION', 'MATERNIDAD_HEMBRAS', 'MATERNIDAD_LECHONES', 'INICIACION', 'ENGORDE'));
alter table "feed_types" add constraint "feed_types_por_ck" check ("por" in ('HEMBRA', 'LECHON', 'TOTAL'));
alter table "feed_types" add constraint "feed_types_kg_ck" check ("kg_por_animal_dia" is null or "kg_por_animal_dia" between 0 and 100);
create index "feed_types_tenantId_modulo_idx" on "feed_types"("tenantId", "modulo");
