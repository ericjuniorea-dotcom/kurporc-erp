-- Gestación: una sola repetición de celo por servicio, la cargue quien la cargue (pantalla, nuevo servicio, importación).
-- Fechas de repetición guardadas a medianoche UTC → mediodía del mismo día (se ven el día correcto en Paraguay).
update public.heat_repeats
set "repeatDate" = date_trunc('day', "repeatDate") + interval '12 hours'
where extract(hour from "repeatDate") = 0 and extract(minute from "repeatDate") = 0;

create unique index if not exists "heat_repeats_serviceEventId_key" on public.heat_repeats ("serviceEventId");
