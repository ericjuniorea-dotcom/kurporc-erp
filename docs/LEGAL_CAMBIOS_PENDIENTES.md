# Cambios pendientes en los textos legales

Los textos versionados (`PRIVACIDAD.md`, `TERMINOS.md`, etc.) **no se editan** hasta que el asesor legal apruebe una versión nueva:
publicar una versión nueva vuelve a pedir la aceptación a todas las personas. Acá se juntan los cambios propuestos.

## Fase 15.3 · Tiempo de uso (noviembre de 2026)

Desde la Fase 15.3 la plataforma registra **cuánto tiempo** se usa cada módulo: un latido cada 60 s mientras la pestaña está a la vista
y la persona tocó, tecleó o desplazó la pantalla en los últimos 2 minutos. Se guarda por persona, día y módulo (tabla `uso_diario`)
y el total del día en `actividad_diaria.segundos`. No se registra lo que se escribe ni qué datos se miran; en modo plataforma no se cuenta.

**Política de Privacidad, punto 5(e)** — hoy dice:
> Estadísticas de uso de la plataforma: cuántas cuentas hay, qué módulos se usan, cómo funciona el servicio.

Texto propuesto:
> Estadísticas de uso de la plataforma: cuántas cuentas hay, qué módulos se usan **y durante cuánto tiempo aproximado**, cómo funciona el servicio.
> El tiempo se estima con señales periódicas mientras la pantalla está en uso; no registramos lo que escribís ni qué datos mirás.

**Registro de tratamientos, actividad 12** (`docs/REGISTRO_TRATAMIENTOS.md`, documento interno): sumar a «Datos» el
«tiempo de uso estimado por módulo y día». Conservación: el detalle por persona, mientras haya cuenta; el agregado, sin plazo.

**Baja de cuenta:** al ejecutar una supresión, borrar las filas de la persona en `actividad_diaria` y en `uso_diario`
(o conservar solo el agregado sin `user_id`). Hoy la supresión se ejecuta a mano desde el panel de Privacidad.
