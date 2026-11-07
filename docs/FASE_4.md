# Fase 4 — Contratos, aceptación y privacidad

Estado: **aplicada en producción el 07/11/2026**.

## Qué se hizo

| Punto | Implementación |
|---|---|
| Documentos versionados | Tabla `documento_legal`. Textos en [docs/legal/](legal/) cargados con `npm run db:legales`. Un documento publicado **no se puede reescribir ni borrar** (trigger): los cambios van en una versión nueva. Historial de cambios activo |
| Versión 1.0 | Términos, Privacidad, Acuerdo de la Organización, Condiciones del Mercado y para Vendedores. Publicados como **versión preliminar en revisión legal** (`aprobado_por_asesor = false`), por decisión del dueño, para poder abrir el ingreso |
| Aceptación (decisión 18) | **Una sola casilla**, desmarcada: "Soy mayor de 18 años y acepto los Términos y Condiciones y la Política de Privacidad de KurPorc", con enlaces. Sin tildarla, "Continuar con Google" está deshabilitado y la plataforma no se puede usar |
| Evidencia | `aceptacion_documento`, **de solo agregar**: versión, hash del texto exacto mostrado (con los datos del operador), la frase de la casilla, fecha, IP, navegador y método. El servidor compara el hash con la versión vigente antes de guardar |
| Bloqueo | Quien no aceptó la versión vigente va a `/legal/aceptar`; ni las pantallas ni las APIs del ERP responden hasta aceptar. "No acepto" cierra la sesión |
| Nueva versión | Al publicar una versión con `requiere_reaceptacion`, todos la aceptan en su siguiente ingreso (pantalla "Actualizamos nuestros términos") |
| Páginas públicas | `/terminos`, `/privacidad`, `/legal/[codigo]`: "Lo más importante" arriba y el texto completo, con versión, fecha y huella. Visor de Markdown que arma React (sin HTML crudo) |
| Portal de privacidad | `/cuenta/privacidad` (accesible aunque no se haya aceptado): corregir datos, **descargar mis datos** (JSON, 10 por día, auditado), ver lo aceptado, solicitudes con **plazo de 30 días** visible, pedido de **baja** con 30 días para arrepentirse (un propietario con equipo primero transfiere o cierra) |

## Criterios de aceptación
- [x] Una cuenta nueva no entra a ninguna pantalla privada sin aceptar Términos y Privacidad.
- [x] ~~La casilla no se puede marcar sin llegar al final del texto~~ → reemplazado por la decisión 18 (una casilla, sin lectura obligatoria).
- [x] Cada aceptación guarda versión, hash, IP y navegador (sin tiempo de lectura, por la decisión 18).
- [ ] PDF de constancia por correo → se hace con el servicio de correo (Fase 6). La constancia ya se ve en `/cuenta/privacidad` y se descarga en el JSON.
- [x] Publicar una versión nueva con reaceptación obliga a aceptarla en el siguiente ingreso.
- [x] Cada persona acepta por sí misma: no existe forma de aceptar por otro.
- [x] "Descargar mis datos" entrega todo lo de la persona.
- [x] Una solicitud de privacidad muestra los días que faltan para el vencimiento.
- [ ] No publicar documentos sin aprobación del asesor en producción → **excepción decidida por el dueño**: se publicó la 1.0 preliminar. Cuando el abogado apruebe, se publica la 1.1 con `aprobado_por_asesor = true` y todos la vuelven a aceptar.
- [x] Pruebas en verde contra producción: `supabase/tests/fase4_contratos.sql`.

## Pendiente
1. **Datos del operador** (razón social, RUC, domicilio, correo de contacto y de privacidad): hoy los documentos muestran "[a completar]".
2. **Publicar la app de Google**: cargar en Google Auth Platform → Información de la marca la página principal `https://www.kurporc.com`, privacidad `https://www.kurporc.com/privacidad` y términos `https://www.kurporc.com/terminos`, y tocar "Publicar app".
3. **Revisión del abogado** de los textos (Anexo B, puntos B.0).
4. Consentimientos opcionales (comunicaciones y comparativas) y Acuerdo de la Organización al crear una organización → Fase 6.
5. Exportar y cerrar una organización y "Accesos de la plataforma a tu cuenta" (4.4) → Fases 7 y 11.
6. `docs/REGISTRO_TRATAMIENTOS.md` (4.5).
