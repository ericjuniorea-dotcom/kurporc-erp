# Plan de respuesta a incidentes de seguridad

Base legal: Ley N° 7593/2025 de Protección de Datos Personales. Ante un incidente que afecte datos
personales hay que **notificar a la Agencia Nacional de Protección de Datos Personales y a las personas
afectadas dentro de las 72 horas** de conocido el incidente.

Responsable de coordinar: el Super Administrador de la plataforma. Suplente: Administración.

## Qué es un incidente
- Acceso no autorizado a datos de una organización (por ejemplo, un usuario que ve datos de otra granja).
- Filtración de una clave: base de datos, `NEXTAUTH_SECRET`, `CAMPOS_CIFRADOS_KEY`, API keys, token de WhatsApp.
- Pérdida o borrado de datos sin respaldo.
- Cuenta tomada por un tercero (sobre todo una de propietario o de Super Administrador).
- Ráfaga de ingresos fallidos o de errores 5xx que indique un ataque.

## Pasos

### 1. Detectar (hora 0)
Anotar fecha y hora exactas en que se supo. **Desde ahí corren las 72 horas.**
Fuentes: alertas, auditoría (`auditoria`: `LOGIN_FALLIDO`, `LOGIN_BLOQUEADO`, `DATO_PERSONAL_VISTO`, `EXPORTACION`),
logs de Vercel, avisos de usuarios.

### 2. Contener (primeras horas)
- Clave filtrada → rotarla de inmediato:
  - Base de datos: Supabase → Settings → Database → Reset password; actualizar `DATABASE_URL` y `DIRECT_URL` en Vercel y en `.env`.
  - `NEXTAUTH_SECRET`: cambiarla en Vercel (cierra todas las sesiones).
  - `CAMPOS_CIFRADOS_KEY`: **no borrar la anterior**. Agregar `k2`, re-cifrar y recién después retirar `k1` (ver `src/lib/seguridad/cifrado.ts`).
- Cuenta tomada → suspender al miembro o desactivar al usuario (`users.isActive = false`).
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
La pantalla para cargarlo es `/admin/seguridad` (Fase 11); mientras tanto se carga por SQL.

## Contactos
| Qué | Dónde |
|---|---|
| Agencia Nacional de Protección de Datos Personales | [completar cuando se publique el canal oficial] |
| Soporte de Supabase | supabase.com/dashboard/support |
| Soporte de Vercel | vercel.com/help |
| Correo de privacidad de KurPorc | `configuracion_plataforma.correo_privacidad` (Fase 4) |

## Simulacro
Una vez antes de abrir el registro al público (Anexo F) y después una vez por año.

## Historial
| Fecha | Incidente | Resultado |
|---|---|---|
| — | Sin incidentes registrados | — |
