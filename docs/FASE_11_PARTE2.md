# Fase 11 (parte 2) — Panel de plataforma completo

## Páginas nuevas
| Ruta | Niveles | Qué hace | Registro |
|---|---|---|---|
| `/admin/produccion` | TOTAL, SOPORTE | Estado de madres, partos, NV/parto, destetados/cerda/año, mortalidad, DNP, cerdas paradas y pérdida; comparación por departamento | `acceso_plataforma` (ESTADISTICA) |
| `/admin/facturacion` | TOTAL, SOPORTE | Ranking mensual de 12 meses, con y sin IVA (5 %), lechones, precio, costo y margen por lechón | ídem |
| `/admin/datos` | TOTAL, SOPORTE | Explorador de solo lectura de las tablas con columna de organización (validadas contra `information_schema`), filtros por columna y fecha, 100 filas por página | cada consulta, cada "Mostrar" de un dato personal y cada CSV (`exportacion = true`) |
| `/admin/vendedores` | TOTAL, SOPORTE, MODERACION | Cola de verificación de tiendas; aprobar o rechazar con motivo; la tienda recibe un aviso | auditoría |
| `/admin/seguridad` | TOTAL, SOPORTE | Incidentes con cuenta regresiva de 72 h, ingresos fallidos de 7 días por IP, últimos accesos de la plataforma | auditoría |
| `/admin/privacidad` | TOTAL, SOPORTE | Solicitudes de titulares con días al vencimiento (30); responder, rechazar con motivo; aviso a la persona | auditoría + historial |
| `/admin/legal` | TOTAL (publicar), SOPORTE (ver) | Versiones por documento, aceptaciones, marcar aprobación del asesor, publicar (retira la anterior), quién falta aceptar | auditoría + historial |
| `/admin/configuracion` | TOTAL (editar), SOPORTE (ver) | Datos del operador que completan los documentos legales; planes; administradores | auditoría + historial |

El nivel LECTURA solo ve el Resumen (agregados); MODERACION, Resumen y Vendedores. El menú muestra solo lo que cada nivel puede abrir; el resto responde 404.

## "Ver todo" (modo plataforma)
1. En `/admin/organizaciones/{id}` se elige el motivo (2 horas) y se pulsa **Ver todo**.
2. Se guarda la cookie `kp_plataforma` firmada con HMAC (`CAMPOS_HMAC_KEY`), atada al administrador y con vencimiento.
3. `getSession()` devuelve esa organización con un miembro sintético que solo tiene permisos `*.ver` (sin `rrhh.datos_personales.ver`).
4. Cada request del ERP (páginas y lecturas de la API) deja una fila `ERP /ruta` en `acceso_plataforma`; la organización la ve en su actividad.
5. El middleware rechaza con 403 cualquier POST/PUT/PATCH/DELETE fuera de `/admin` y `/auth` mientras exista la cookie: ningún botón de escritura funciona.
6. Banner rojo en todo el ERP con el motivo y **Salir del modo plataforma** (`/admin/salir-modo-plataforma`).
7. En modo plataforma no se registra actividad diaria ni se generan avisos de cerdas paradas.

## Pendiente
- Mercado y Moderación: dependen de las Fases 12 y 13.
- Vistas materializadas del esquema `admin` con `pg_cron`: hoy las consultas son en vivo (volumen chico).
