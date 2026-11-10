# Registro de actividades de tratamiento de datos personales

Ley N° 7593/2025 de Protección de Datos Personales · Anexo F.2 del plan de la plataforma.
Responsable: el operador de KurPorc (datos en Panel de plataforma → Configuración). Contacto de privacidad: `configuracion_plataforma.correo_privacidad`.
Última revisión: 10/11/2026 · Estado: **borrador para revisión del asesor legal**.

## Roles
- **KurPorc es responsable** de los datos de las cuentas (personas que se registran) y del Mercado.
- **KurPorc es encargado** de los datos de terceros que carga cada organización (funcionarios, clientes, proveedores): la organización es responsable y KurPorc los trata por su cuenta, según el Acuerdo de Uso y Tratamiento de Datos de la Organización.

## Actividades

| # | Actividad | Finalidad | Titulares | Datos | Base legal | Conservación |
|---|---|---|---|---|---|---|
| 1 | Cuentas e ingreso | Prestar el servicio, seguridad | Personas registradas, operarios con cuenta gestionada | Nombre, correo, foto de Google, teléfono, departamento, distrito, contraseña (solo en forma no legible), segundo factor, IP, navegador, fecha y hora de ingreso | Contrato (Términos) | Mientras haya cuenta; al darse de baja se borra o anonimiza |
| 2 | Aceptación de documentos | Prueba de consentimiento | Personas registradas | Documento, versión, hash del texto mostrado, texto de la casilla, fecha, IP, navegador | Obligación legal | Solo agregar; se conserva aun después de la baja |
| 3 | Gestión productiva, sanitaria, de stock y financiera | Prestar el servicio a la organización | Organizaciones; indirectamente sus funcionarios y contrapartes | Datos de la granja, movimientos, ventas, compras, cuentas | Contrato (Acuerdo de la Organización) | Mientras la organización tenga cuenta; los registros contables, el plazo que fije la ley |
| 4 | RRHH de la organización (encargado) | Por cuenta de la organización | Funcionarios | Nombre, cédula, cuenta bancaria y domicilio (**cifrados en la base**), sueldos, asistencia | Instrucciones de la organización | Lo que indique la organización y la ley laboral |
| 5 | Contrapartes (encargado) | Por cuenta de la organización | Clientes y proveedores | Nombre, RUC, teléfono, correo | Instrucciones de la organización | Mientras la organización los mantenga |
| 6 | Mercado | Publicar, cotizar, pedir, reseñar | Tiendas y compradores | Datos de la tienda, publicaciones, cotizaciones, pedidos, reseñas, favoritos, denuncias | Contrato (Términos del Mercado y de Vendedor) | Pedidos y eventos: solo agregar, mientras existan las organizaciones; reseñas públicas hasta que se borre la cuenta |
| 7 | Seguridad y auditoría | Prevenir fraudes y accesos indebidos | Todas las personas | Acciones, IP, navegador, intentos de ingreso fallidos | Interés legítimo / obligación legal | Solo agregar (`auditoria`, `historial_cambio`) |
| 8 | Accesos de la plataforma | Transparencia del acceso del equipo de KurPorc | Organizaciones | Quién accedió, sección, motivo, filas, IP | Contrato (Política, punto 4) | Solo agregar (`acceso_plataforma`); la organización lo ve |
| 9 | Soporte y sugerencias | Responder consultas y mejorar | Personas que escriben | Mensaje, página, organización | Consentimiento al enviar | Mientras sea útil para el soporte |
| 10 | Bot de WhatsApp | Cargar datos por WhatsApp | Miembros que usan el bot | Número, mensajes, audios (transcriptos) | Contrato | Mensajes según la configuración de la organización |
| 11 | Derechos de los titulares | Atender solicitudes | Personas registradas | Tipo de solicitud, detalle, respuesta | Obligación legal | Mientras haya cuenta y lo que fije la ley |
| 12 | Estadística de la plataforma | Saber cómo se usa el servicio | Personas y organizaciones | Uso diario agregado, métricas | Interés legítimo (Política (e)) | Agregado; el detalle diario, mientras haya cuenta |
| 13 | Motor de necesidades y avisos | Prestar el servicio | Organizaciones | Cálculos de stock y consumo | Contrato | Fotos del cálculo: 120 días |

## Encargados (proveedores) y transferencias internacionales

| Proveedor | Para qué | Dónde | ¿Figura en la Política v1.1? |
|---|---|---|---|
| Supabase | Base de datos, ingreso, fotos del Mercado | San Pablo, Brasil (`sa-east-1`) | Sí |
| Vercel | Alojamiento del sitio | San Pablo, Brasil (`gru1`) y red global | Sí |
| Google | Ingreso con Google | EE. UU. y otros | Sí |
| Meta (WhatsApp Business) | Bot de WhatsApp | EE. UU. y otros | **No: agregar** |
| OpenAI | Transcripción de audios del bot | EE. UU. | **No: agregar** |
| Cloudflare (Turnstile) | CAPTCHA en ingreso, registro y recuperación (cuando se active) | Red global | **No: agregar** |
| Proveedor de correo (SMTP) | Correos de cuenta (cuando se configure) | A definir | **No: agregar al elegirlo** |

## Medidas de seguridad (resumen)
- Cifrado en tránsito (HTTPS con HSTS) y en reposo (Supabase); cédula, cuenta bancaria y domicilio de funcionarios cifrados además con clave propia (AES-GCM).
- Seguridad por fila activada en las 140 tablas; la API pública no tiene acceso directo a ellas (revisado el 10/11/2026).
- Permisos por persona, granja y unidad de negocio; segundo factor para plata, sueldos y datos personales; segundo factor obligatorio en el panel de plataforma.
- Tablas de solo agregar: `auditoria`, `historial_cambio`, `aceptacion_documento`, `acceso_plataforma`, `pedido_evento`.
- Límites de intentos de ingreso, registro y recuperación; CAPTCHA listo para activar.
- Respaldos antes de cada cambio de la base y restauración probada (docs/RESTAURACION.md).
- Plan de incidentes con aviso dentro de las 72 horas (docs/PLAN_INCIDENTES.md).

## Pendiente para el asesor legal
1. Agregar a Meta, OpenAI, Cloudflare y el proveedor de correo a la Política (punto 5) y a las transferencias internacionales (punto 6), y publicarla como versión nueva desde Panel → Legal.
2. Confirmar los plazos de conservación de los registros contables y de las constancias de aceptación.
3. Confirmar el canal oficial de la Agencia Nacional de Protección de Datos Personales para el plan de incidentes.
