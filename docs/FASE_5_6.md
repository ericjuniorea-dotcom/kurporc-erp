# Fases 5 y 6 — Página de inicio, registro y primeros pasos

Estado: **en producción desde el 07/11/2026**. Sin cambios en la base de datos.

## Fase 5 — Página de inicio (`/`)
- Barra con Producto, Para quién, Precios y Preguntas; "Ingresar" y "Crear cuenta" (o "Ir a mi panel" con sesión).
- Hero, las tres ramas (Finanzas "en construcción", Compras "próximamente"), cómo funciona, **¿Para quién es?** (cada tarjeta abre `/registro?tipo=...`), "Nació en una granja real", tus datos, precios (Gratis / Profesional próximamente), preguntas frecuentes y pie con razón social, RUC, domicilio y contacto desde `configuracion_plataforma`.
- Vista previa del tablero dibujada en la página (colores pastel de estados: servidas amarillo, gestantes verde, lactancia azul, vacías rojo), fondo blanco en ambos temas.
- `sitemap.xml`, `robots.txt` y metadatos Open Graph.
- La sección "Vista del Mercado" no se muestra: todavía no hay publicaciones (Fase 12).

## Fase 6 — Registro y primeros pasos
- `/registro`: cuatro opciones, casilla única de aceptación, "Crear cuenta con Google" o correo y contraseña. Sin la casilla no se crea la cuenta.
- `/onboarding`:
  1. Tipo (si no vino elegido), incluido **"Tengo un código de empresa"**.
  2. Tus datos: nombre, WhatsApp +595, departamento y distrito.
  3. Según el tipo:
     - **Mi granja / Empresa:** nombre, razón social y RUC (opcionales), primera granja, madres aproximadas, sistema productivo y casilla del **Acuerdo de la Organización**.
     - **Vendedor:** RUC (obligatorio, con dígito verificador), razón social, qué vende, dónde entrega, WhatsApp y casilla de las **Condiciones para Vendedores**. La tienda queda **en revisión**.
     - **Solo comprar:** termina en el paso 2.
- El alta crea en una transacción: organización, granja, unidades `COMUN` y `GRANJA-…`, roles copiados de las plantillas, la persona como Administrador General, protocolo sanitario por defecto y las 6 etapas de alimentación. La aceptación del acuerdo queda registrada en nombre de la organización.
- Reenviar el formulario no duplica la organización (clave de creación).
- Prueba automática: `npm run prueba:alta` (también en la CI).

## Criterios de aceptación
- [x] Los 4 caminos terminan en la pantalla correcta y crean exactamente los registros descritos.
- [x] Ninguna organización se crea sin la aceptación del acuerdo guardada.
- [x] Recargar o reenviar no duplica organizaciones.
- [x] RUC inválido muestra un error claro; obligatorio solo para vendedores.
- [x] Cada tarjeta de "¿Para quién es?" abre el registro con el tipo elegido.
- [ ] Lighthouse ≥ 90 en móvil → medir desde el navegador.

## Pendiente
- **Invitar al equipo** al crear una empresa: llega con Equipo y permisos (Fase 7), igual que aprobar los pedidos de "Tengo un código de empresa".
- **Subir la constancia de RUC** del vendedor y la cola de verificación: Fases 11 y 12.
- **Convertir una cuenta individual en empresa**: Fase 7.

## Antes de anunciar la plataforma al público
1. Servicio de correo propio (SMTP, por ejemplo Resend) en Supabase: el gratuito manda ~2 correos por hora.
2. CAPTCHA (Turnstile) en registro, recuperación e ingreso.
3. Revisión de los textos legales por el abogado → publicar versión 1.1 aprobada.
4. Plan Pro de Supabase (respaldos diarios).
5. CSP en modo bloqueo (`CSP_MODO=enforce`) después de revisar los informes.
6. Lista OWASP del Anexo F y prueba de penetración.
