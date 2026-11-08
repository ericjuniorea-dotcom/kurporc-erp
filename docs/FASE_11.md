# Fase 11 — Panel del Super Administrador (`/admin`)

## Parte 1 (migración `20261108000600_fase11_admin`)

| Punto | Implementación |
|---|---|
| Acceso | Solo quien está en `admin_plataforma`, **con segundo factor verificado en la sesión**. Un usuario común recibe 404. Sin segundo factor se muestra cómo activarlo |
| Quién puede ser administrador | Lo controla la base: solo un administrador **TOTAL** autoriza, cambia o quita administradores (`controlar_admin_plataforma`), queda `otorgado_por`, se audita, y nunca queda la plataforma sin un TOTAL. El script `db:superadmin` exige `AUTORIZA_EMAIL` de un TOTAL |
| Resumen | Usuarios, nuevos en 7 días, activos (hoy, 7 y 30 días), organizaciones por tipo, granjas, madres, ingresos registrados del mes de toda la plataforma, solicitudes de privacidad, incidentes, ingresos fallidos, altas por día |
| Cuentas | Cada persona: tipo, cómo ingresa, segundo factor, términos aceptados, primeros pasos, organizaciones, días de uso, último acceso. Embudo de registro |
| Organizaciones | Tipo, departamento, plan, estado, miembros, granjas, madres, ingresos del mes, última actividad |
| Detalle | Pide el **motivo** (vale 2 horas), queda en `acceso_plataforma` (inmutable) y la organización lo ve en Equipo → Actividad. Muestra producción del mes, finanzas, miembros y auditoría |
| Actividad | Todo lo que hacen las personas (auditoría de toda la plataforma) con filtros, y los accesos de la plataforma |
| Administradores | Lista con quién autorizó a cada uno; autorizar por correo con nivel, quitar |
| Uso diario | `actividad_diaria` se escribe después de responder (`after`), como máximo cada 10 minutos por persona |
| Pruebas | `supabase/tests/fase11_admin.sql` (6 controles), en la CI |

## Parte 2 (pendiente)
"Ver todo" en modo plataforma (el ERP completo de una organización en solo lectura), explorador de datos con exportación registrada, producción y facturación comparadas entre granjas, Mercado y vendedores, privacidad, legal, seguridad y configuración.
