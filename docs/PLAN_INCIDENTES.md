# Plan de respuesta a incidentes de seguridad

Base legal: Ley N° 7593/2025 de Protección de Datos Personales. Ante un incidente que afecte datos
personales hay que **notificar a la Agencia Nacional de Protección de Datos Personales y a las personas
afectadas dentro de las 72 horas** de conocido el incidente.

Responsable de coordinar: el Super Administrador de la plataforma. Suplente: Administración.

## Qué es un incidente
- Acceso no autorizado a datos de una organización (por ejemplo, un usuario que ve datos de otra granja).
- Filtración de una clave: base de datos, `SUPABASE_SERVICE_ROLE_KEY`, `CAMPOS_CIFRADOS_KEY`, `CAMPOS_HMAC_KEY`, `CRON_SECRET`, token de WhatsApp, `OPENAI_API_KEY`, clave secreta de Turnstile o del correo (SMTP).
- Pérdida o borrado de datos sin respaldo.
- Cuenta tomada por un tercero (sobre todo una de propietario o de Super Administrador).
- Ráfaga de ingresos fallidos o de errores 5xx que indique un ataque.

## Pasos

### 1. Detectar (hora 0)
Anotar fecha y hora exactas en que se supo. **Desde ahí corren las 72 horas.**
Fuentes: Panel de plataforma → Seguridad (ingresos fallidos por IP, accesos de la plataforma), auditoría (`auditoria`: `LOGIN_FALLIDO`, `LOGIN_BLOQUEADO`, `DATO_PERSONAL_VISTO`, `EXPORTACION`),
logs de Vercel (incluidos los avisos `[csp]`), avisos de usuarios en Sugerencias o soporte@kurporc.com.
**Registrar el incidente enseguida en Panel → Seguridad → Registrar incidente**: la pantalla muestra cuántas horas quedan de las 72.

### 2. Contener (primeras horas)
- Clave filtrada → rotarla de inmediato:
  - Base de datos: Supabase → Settings → Database → Reset password; actualizar `DATABASE_URL` y `DIRECT_URL` en Vercel y en `.env`.
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Settings → API → regenerar; actualizarla en Vercel y hacer Redeploy.
  - Sesiones: Supabase → Authentication → cerrar las sesiones del usuario afectado (o de todos, rotando el JWT secret).
  - `CAMPOS_HMAC_KEY`: al cambiarla se invalidan las cookies del modo plataforma (los administradores vuelven a elegir el motivo).
  - `CRON_SECRET`, token de WhatsApp, `OPENAI_API_KEY`, Turnstile, SMTP: regenerar en su proveedor, actualizar en Vercel, Redeploy.
  - `CAMPOS_CIFRADOS_KEY`: **no borrar la anterior**. Agregar `k2`, re-cifrar y recién después retirar `k1` (ver `src/lib/seguridad/cifrado.ts`).
- Cuenta tomada → suspender al miembro o desactivar al usuario (`users.isActive = false`). Si es un Super Administrador, quitarlo en Panel → Administradores (siempre queda un TOTAL).
- Ataque en curso → pausar el proyecto en Vercel si hace falta.
- Hacer un respaldo del estado actual (docs/RESTAURACION.md) para poder investigar.

### 3. Evaluar a quién afecta
- Qué datos: tablas y campos (¿personales? ¿sensibles? ¿cifrados?).
- De qué organizaciones y cuántas personas.
- Usar `historial_cambio` y `auditoria` para reconstruir qué pasó, cuándo y quién.

### 4. Notificar (antes de las 72 h)
- **Agencia Nacional de Protección de Datos Personales:** qué pasó, datos y personas afectadas, medidas tomadas, contacto.
- **Personas afectadas:** en lenguaje simple, qué pasó, qué datos, qué hicimos y qué pueden hacer ellas (por ejemplo, cambiar la contraseña).
- **Organizaciones afectadas** (propietarios): lo mismo, más el detalle de sus datos.
- Si todavía no se sabe todo, notificar igual dentro del plazo y completar después.

### 5. Corregir
Arreglar la causa, desplegar, agregar una prueba automática que lo detecte (`supabase/tests/`).

### 6. Registrar lo aprendido
Una fila en la tabla `incidente_seguridad` (fecha de detección, descripción, datos y personas afectadas,
notificado a la Agencia en, notificado a titulares en, medidas, estado) y un párrafo en "Historial" abajo.
Se carga y actualiza en `/admin/seguridad` (Panel de plataforma → Seguridad).

## Contactos
| Qué | Dónde |
|---|---|
| Agencia Nacional de Protección de Datos Personales | [completar cuando se publique el canal oficial] |
| Soporte de Supabase | supabase.com/dashboard/support |
| Soporte de Vercel | vercel.com/help |
| Correo de privacidad de KurPorc | `configuracion_plataforma.correo_privacidad` (Fase 4) |

## Simulacro
Una vez antes de abrir el registro al público (Anexo F) y después una vez por año. Dura unos 45 minutos y no toca producción.

**Guion:** "Un operario avisa por WhatsApp que ve los funcionarios de otra granja."
1. (5 min) Anotar la hora 0 y registrar el incidente de prueba en Panel → Seguridad con la descripción "SIMULACRO".
2. (10 min) Contener: decidir qué cuenta suspender y qué clave habría que rotar. Ubicar dónde se rota cada una (sin rotarlas).
3. (10 min) Evaluar: con Panel → Actividad y Panel → Datos (motivo SEGURIDAD), reconstruir qué vio el operario y de qué organización.
4. (10 min) Redactar los dos avisos (Agencia y personas afectadas) con la plantilla del paso 4, sin enviarlos.
5. (5 min) Restaurar el último respaldo en una base local (docs/RESTAURACION.md, procedimiento A) y comparar la cantidad de filas.
6. (5 min) Cerrar el incidente de prueba y anotar abajo qué faltó o qué tardó.

## Historial
| Fecha | Incidente | Resultado |
|---|---|---|
| — | Sin incidentes registrados | — |
| 10/11/2026 | Prueba técnica previa al lanzamiento (no es simulacro completo): restauración del respaldo del 10/11 en una base local | 140 tablas, 910.131 filas, iguales a producción. Falta el simulacro con el equipo |
