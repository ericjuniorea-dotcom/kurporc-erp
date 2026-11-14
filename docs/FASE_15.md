# Fase 15 — Panel del Super Administrador: buzón, uso real y botón de Ayuda

Verificado contra el código del repositorio `kurporc-erp` (commit `a63da3c`, 14/11/2026). Todo lo que dice «hoy» se leyó en esos archivos.

## Estado de la implementación (14/11/2026)

| Subfase | Commit | Migración en producción |
|---|---|---|
| 15.1 Ayuda plegable | ver `git log --grep "fase 15.1"` | — |
| 15.2 Buzón y hoja de ruta | ver `git log --grep "fase 15.2"` | `20261114000100_fase15_buzon` |
| 15.3 Uso real | ver `git log --grep "fase 15.3"` | `20261114000200_fase15_uso` |
| 15.4 Panel | ver `git log --grep "fase 15.4"` | — |
| 15.5 Pruebas y documentación | junto con 15.4 | — |

**Diferencias con lo especificado abajo:**
- **Fecha del latido (5.1):** `registrar_latido` usa la fecha de **Asunción** (`now() at time zone 'America/Asuncion'`), no la de UTC. Así coincide de verdad con `hoyUTC()`, que devuelve el día de Asunción a medianoche, y con las filas que ya escribe `registrarActividad` en `actividad_diaria`. Con UTC, entre las 21:00 y las 24:00 de Asunción el latido caía en el día siguiente.
- **Ruta del latido:** usa `prisma.$executeRaw` (la función devuelve `void`, que `$queryRaw` no sabe leer).
- **Aviso al cliente (4.4):** no hay campana de notificaciones en la app. Además de la fila en `notificacion`, la pestaña de Ayuda muestra un punto cuando hay respuestas sin leer y las marca leídas al abrir el panel.
- **Agrupar (4.4):** siempre se agrupa en la raíz (un solo nivel); los mensajes y votos del agrupado pasan al principal. Un agrupado no se puede publicar.
- **«Pedida por» y votos:** cuentan organizaciones distintas entre los autores del grupo y quienes votaron (`demanda()` en `src/lib/buzon/datos.ts`).
- **Verde (6.3):** además de usar y cargar en 7 días, exige los primeros pasos completos (así lo dice la fila «Amarillo»).
- **Baja de cuenta (5.4):** hoy la supresión se ejecuta a mano; quedó anotado en `docs/legal/CAMBIOS_PENDIENTES.md` borrar `actividad_diaria` y `uso_diario`.
- **«Otro» en Ver ERP:** pide el detalle con un cuadro del navegador.

---

## 0. Reglas para quien implemente

- Leer antes: `docs/FASE_11.md`, `docs/FASE_11_PARTE2.md`, `docs/SOPORTE_Y_PRODUCCION.md`, `docs/CORREO_Y_CAPTCHA.md` y las reglas de diseño del proyecto (`DESIGN.md`).
- No romper lo que ya funciona. Las rutas `/admin/*` actuales se conservan; si una se renombra, la vieja redirige a la nueva.
- Textos de la interfaz en español con voseo, como el resto de la app («Contanos», «Escribinos»).
- Ningún texto de la plataforma usa nombres de personas: se habla de roles («Super Administrador», «Administración»).
- Diseño: usar los tokens existentes (`var(--bg-surface)`, `var(--border-default)`, `.btn`, `.kp-input`, `.kp-table`), bordes de 0,5 px, íconos Tabler en línea (outline), peso 400 o 500, sin degradados ni sombras decorativas.
- Gráficos: tarjeta blanca (`--bg-surface` en tema claro), colores pastel, estilo minimalista y **sin textos superpuestos** (las etiquetas van fuera de la barra, nunca encima).
- Orden de trabajo: 15.1 → 15.2 → 15.3 → 15.4 → 15.5. Cada subfase se despliega sola. 15.1 es urgente y no lleva migración.
- Las migraciones nuevas siguen el patrón de `20261109000100_sugerencias`: RLS activado y `revoke all` para `anon` y `authenticated` (solo el servidor lee y escribe).

## 1. Decisiones

| # | Decisión | Estado |
|---|---|---|
| 1 | **La base de datos es la fuente de verdad del buzón** (tabla `sugerencia`). El correo no guarda nada: solo avisa | Firme |
| 2 | `soporte@kurporc.com` sigue existiendo para quien escribe por fuera de la app. Esos correos **no** entran al buzón (se responden desde la casilla) | Firme |
| 3 | Botón «Ver ERP» en un clic con motivo predeterminado «Mejora del producto» y selector para cambiarlo. Se mantienen el registro de cada página vista y el aviso a la organización | Por defecto, cambiable |
| 4 | Hoja de ruta visible para los clientes, **solo** con las funciones que el Super Administrador publique, con texto reescrito por él. Nunca se muestra el mensaje original, el autor ni la organización | Por defecto, cambiable |
| 5 | Tiempo de uso real con un latido cada 60 s mientras la persona está usando la pestaña | Por defecto, cambiable |
| 6 | El Super Administrador **no es una granja**: si no tiene organización, entra directo a `/admin` | Firme |

## 2. Situación de partida

| Tema | Hoy |
|---|---|
| Botón de ayuda | `src/components/layout/ayuda-soporte.tsx`: pastilla fija (`position: fixed`, derecha 16, abajo 16, `zIndex: 60`), siempre visible. Tapa los botones «Guardar». Se monta en `(dashboard)/layout.tsx`, `vendedor/layout.tsx`, `cuenta/layout.tsx` y `components/mercado/marco.tsx`. En modo plataforma también aparece y enviar falla (el middleware corta todo POST fuera de `/admin` y `/auth/`) |
| Mensajes | `enviarSugerencia` (`src/app/acciones/sugerencias.ts`) guarda en `sugerencia` con tipo `CONSULTA`, `SUGERENCIA` o `PROBLEMA`. Límite: 20 por día y persona |
| Lectura | Solo `/admin/sugerencias`, niveles `TOTAL` y `SOPORTE`. La respuesta la ve el cliente en el mismo botón |
| Carencias | No hay tipo «función nueva», módulo, prioridad, votos, hoja de ruta ni conteo en el Resumen. La app **no envía correos** desde código (el SMTP de Resend solo lo usa Supabase Auth) |
| Uso | `actividad_diaria` guarda un `accesos` que sube como mucho cada 10 min **por instancia del servidor** (el control está en un `Map` en memoria). No son minutos reales y no dice qué módulo se usó |
| Panel | 16 pestañas en `src/app/admin/navegacion.tsx`. Hay Resumen, Cuentas, Organizaciones, Producción, Facturación y «Ver todo» (modo plataforma en solo lectura, 2 h, cada request queda en `acceso_plataforma`) |
| Entrar al ERP de un cliente | 3 pasos: Organizaciones → entrar → elegir motivo → «Ver todo» |
| Ingreso del Super Administrador | `/login` lleva a `/dashboard`. Sin organización cae en `/cuenta/sin-organizacion` |

---

## 3. Fase 15.1 — Botón de Ayuda plegable (urgente, sin migración)

**Archivo principal:** `src/components/layout/ayuda-soporte.tsx`. También: `src/app/(dashboard)/layout.tsx`, `src/app/vendedor/layout.tsx`, `src/app/cuenta/layout.tsx`, `src/components/mercado/marco.tsx`.

Requisitos:
1. **Pestaña en el borde derecho, a media altura** (arranca en ~45 % del alto), de 24 × 48 px, con un ícono de flecha (`IconChevronLeft` plegada). Nada en el borde inferior de la pantalla.
2. Un toque abre el panel (ancho `min(380px, calc(100vw - 32px))`). La flecha del panel (`IconChevronRight`) lo vuelve a plegar. Escape también cierra.
3. **Se puede arrastrar solo en vertical** (eventos de puntero; límites para que nunca salga de la pantalla). Guardar la altura.
4. Recordar `plegada` y la altura en `localStorage` dentro de `try/catch` (puede lanzar o venir vacío).
5. **En pantallas menores a 768 px arranca plegada**. Sin preferencia guardada, en escritorio también arranca plegada.
6. No debe tapar ningún botón fijo: respetar `env(safe-area-inset-right)` y `env(safe-area-inset-top)`. Con el teclado del celular abierto (un `input` o `textarea` fuera del panel con foco) la pestaña se oculta.
7. **No se muestra en modo plataforma.** `(dashboard)/layout.tsx` ya conoce `session.modoPlataforma`: pasar `<AyudaSoporte oculto />` cuando exista.
8. Accesible: `button` con `aria-label="Abrir ayuda y sugerencias"`, `aria-expanded`, `aria-controls="panel-ayuda"`, foco al panel al abrir y de vuelta a la pestaña al cerrar.
9. Si la URL trae `?ayuda=1`, el panel abre solo (lo usan las notificaciones de 15.2).

Aceptación: en un celular de 360 px la pantalla de un formulario con «Guardar» abajo a la derecha no tiene nada encima; la pestaña se arrastra y recuerda su lugar; en modo plataforma no aparece.

---

## 4. Fase 15.2 — Buzón categorizado y «Función nueva»

### 4.1 Migración `20261114000100_fase15_buzon`

Ver `prisma/migrations/20261114000100_fase15_buzon/migration.sql`: amplía los `check` de tipo y estado; agrega `modulo`, `titulo`, `problema`, `como_funcionaria`, `prioridad`, `publica`, `titulo_publico`, `descripcion_publica` y `agrupada_en`; los `check` de prioridad, de función nueva completa y de publicación con texto público; los índices `(tipo, estado)` y `(modulo)`; y la tabla `sugerencia_voto` (clave `(sugerencia_id, usuario_id)`, RLS activado, sin acceso para `anon` ni `authenticated`). Modelos `Sugerencia` (campos nuevos) y `SugerenciaVoto` en `prisma/schema.prisma`.

### 4.2 Módulos y categoría automática

`src/lib/modulos.ts` (puro, sin dependencias de servidor) con `MODULOS` y `moduloDeRuta(pathname): ModuloClave`. Es la **única** tabla ruta → módulo: la usan el buzón, el latido de uso y el panel.

| Clave | Etiqueta | Prefijos de ruta |
|---|---|---|
| `TABLERO` | Tablero | `/dashboard` |
| `PLANTEL` | Plantel reproductivo | `/plantel` |
| `GESTACION` | Gestación | `/gestacion` |
| `MATERNIDAD` | Maternidad | `/maternidad` |
| `INICIACION` | Iniciación | `/recria` |
| `ENGORDE` | Engorde | `/engorde` |
| `SANIDAD` | Sanidad | `/sanidad` |
| `TAREAS` | Tareas | `/tareas` |
| `ALIMENTACION` | Alimentación | `/alimentacion` |
| `LOGISTICA` | Logística | `/logistica` |
| `RRHH` | RRHH | `/rrhh` |
| `FINANZAS` | Finanzas | `/finanzas`, `/financiero` |
| `WHATSAPP` | WhatsApp | `/whatsapp` |
| `COMPRAS` | Compras | `/compras` |
| `MERCADO` | Mercado | `/mercado`, `/marketplace`, `/tienda` |
| `EQUIPO` | Equipo | `/equipo` |
| `CONFIGURACION` | Configuración | `/configuracion` |
| `VENDEDOR` | Panel de tienda | `/vendedor` |
| `CUENTA` | Mi cuenta | `/cuenta` |
| `OTRO` | Otro | todo lo demás |

### 4.3 Formulario del cliente (dentro del panel de Ayuda)

- Cuatro tipos como botones: **Algo no funciona** (`PROBLEMA`), **Tengo una duda** (`CONSULTA`), **Una idea para mejorar** (`SUGERENCIA`), **Quiero una función nueva** (`FUNCION_NUEVA`).
- Un selector «Sobre qué módulo» ya completado con `moduloDeRuta(pathname)`; la persona puede cambiarlo.
- `FUNCION_NUEVA` pide tres campos: **título** (5 a 80 caracteres), **¿qué problema te resuelve?** y **¿cómo querés que funcione?** (cada uno de 10 a 1.500). El servidor arma `mensaje` = `titulo + "\n\nProblema: …\n\nCómo debería funcionar: …"`.
- `enviarSugerencia` valida con zod: tipo, módulo (si no está en `MODULOS`, lo deriva de `pagina`), campos según el tipo. El límite de 20 por día no cambia.
- Estados que ve el cliente: `NUEVA` «Recibida», `EN_REVISION` «La estamos viendo», `EN_DESARROLLO` «La estamos haciendo», `HECHA` «Hecha», `DESCARTADA` «No la vamos a hacer por ahora».
- Enlace «Ver lo que piden otros» → `/cuenta/hoja-de-ruta`.

### 4.4 Bandeja del Super Administrador: `/admin/buzon`

- `/admin/sugerencias` redirige a `/admin/buzon`. Niveles `TOTAL` y `SOPORTE`.
- Filtros: tipo (con conteos), módulo, estado, prioridad, «con votos». Orden: más recientes, o más pedidas.
- Cada fila: tipo, módulo, persona, organización, pantalla de origen, fecha, mensaje, pedidos (organizaciones distintas).
- Acciones: cambiar tipo y módulo, prioridad, estado, respuesta, **publicar en la hoja de ruta** (con `titulo_publico` y `descripcion_publica` reescritos) y **agrupar con otro mensaje**.
- Al responder o cambiar de estado se crea una `notificacion` (`tipo: "BUZON"`, `titulo: "Respondimos tu mensaje"`, `enlace: "?ayuda=1"`).
- Cada gestión deja una fila de auditoría `BUZON_GESTIONADO`.
- Pestaña «Hoja de ruta» con las publicadas agrupadas por estado.

### 4.5 Hoja de ruta para clientes: `/cuenta/hoja-de-ruta`

- Filas con `publica = true` y estado distinto de `DESCARTADA`, en **Pedida / Evaluando / En desarrollo / Hecha**.
- Solo `titulo_publico`, `descripcion_publica`, estado y pedidos. **Nunca** `mensaje`, autor ni organización.
- Botón **«Yo también la quiero»** (`votarFuncion(id)`, alterna el voto). Se cuenta una vez por organización. No se puede votar en modo plataforma.

### 4.6 Aviso por correo (opcional)

- `src/lib/correo/enviar.ts`: Resend con `RESEND_API_KEY`; remitente `no-responder@kurporc.com`; destino `CORREO_SOPORTE`. **Sin la variable no hace nada y no falla.**
- Se llama dentro de `after()` desde `enviarSugerencia`. **Inmediato** solo para `PROBLEMA`. El resto, en el resumen diario `/api/cron/buzon-resumen` (`0 11 * * *`, 08:00 en Asunción), protegido con `CRON_SECRET`. Sin novedades no manda nada.
- El correo **no incluye el texto del cliente**: solo tipo, módulo, organización y el enlace al panel.

---

## 5. Fase 15.3 — Uso real: tiempo y módulos

### 5.1 Migración `20261114000200_fase15_uso`

`actividad_diaria` suma `segundos` y `ultimo_latido`; tabla `uso_diario (user_id, fecha, organizacion_id, modulo, segundos, latidos)` con clave `(user_id, fecha, modulo)`; función `registrar_latido(p_user, p_org, p_modulo)`: el primer latido del día suma 30 s; un latido a menos de 45 s del anterior no suma; si no, suma lo transcurrido con un tope de 60 s. RLS activado y sin acceso ni ejecución para `anon`, `authenticated` ni `public`. El control de repetidos vive en la base, así que funciona igual con varias instancias.

### 5.2 Cliente y servidor

- `src/components/layout/latido-uso.tsx`: cada 60 s, solo con la pestaña visible y actividad (toque, tecla o scroll) en los últimos 120 s, `POST /api/uso/latido` con `keepalive`. Ignora los errores.
- Montado en `(dashboard)/layout.tsx` solo fuera del modo plataforma, y en `vendedor/layout.tsx`.
- `src/app/api/uso/latido/route.ts`: sin sesión 401; en modo plataforma 204 sin registrar; valida `ruta` (hasta 300 caracteres) y llama a `registrar_latido` con `moduloDeRuta(ruta)`.

### 5.3 Consultas del panel (`src/lib/admin/uso.ts`)

- `usoOrganizacion(orgId, dias)`: segundos por módulo y por persona.
- `usoPlataforma(dias)`: ranking de módulos, mediana de horas por usuario y semana, retención a 4 semanas.
- «Horas» = `segundos / 3600` con una cifra decimal, rotulado «tiempo de uso estimado».

### 5.4 Privacidad

- No se editan los textos legales versionados. El texto propuesto está en `docs/legal/CAMBIOS_PENDIENTES.md` para el asesor legal (Política 5(e) y Registro, actividad 12).
- La baja de cuenta tiene que incluir `uso_diario` junto con `actividad_diaria`.

---

## 6. Fase 15.4 — Panel: Inicio, salud del cliente, ficha y menú

### 6.1 Menú en 5 grupos

| Grupo | Contiene |
|---|---|
| **Inicio** | Inicio (antes «Resumen») |
| **Clientes** | Cuentas, Organizaciones |
| **Negocio** | Producción, Facturación, Mercado, Vendedores |
| **Buzón** | Buzón, Hoja de ruta |
| **Control** | Moderación, Actividad, Seguridad, Privacidad, Legal, Datos, Configuración, Administradores |

Segunda fila con las pestañas del grupo (scroll horizontal). En un celular los 5 grupos entran en una fila. Se conserva el filtro por nivel. «Volver a mi granja» solo si la persona tiene al menos una organización.

### 6.2 Inicio (`/admin`, datos en `src/lib/admin/inicio.ts`)

- **Cuatro números:** Organizaciones (granjas y productores; tiendas aparte; nuevas en 7 días) · Activos en 7 días sobre el total · Cerdas en la plataforma (madres activas y granjas con madres) · Plata que se mueve (ingresos + gastos del mes, sin anulados ni internos).
- **Necesita tu atención:** buzón nuevo · funciones pedidas por 3 o más organizaciones sin hacer · clientes en rojo · privacidad e incidentes abiertos. Cada ítem enlaza con el filtro aplicado.
- **Del registro al uso real** (barras horizontales, valor fuera de la barra).
- **Las 3 funciones más pedidas** y los 3 módulos más usados de la semana.
- Se conservan privacidad, incidentes, fallidos y altas por día, más abajo.

### 6.3 Salud del cliente (semáforo)

`calcularSalud(entrada)` en `src/lib/admin/salud-calculo.ts` (pura, con prueba); datos y caché de 10 minutos (`unstable_cache`, etiqueta `admin-salud`) en `src/lib/admin/salud.ts`. Solo organizaciones que no son tienda. «Carga de datos» = una fila **creada** en los últimos 7 días en servicios, partos, destetes, aplicaciones sanitarias, movimientos o ventas.

| Estado | Regla (en este orden) |
|---|---|
| Nuevo (gris) | Alta de hace menos de 7 días |
| Rojo | Sin uso hace 14 días o más, **o** más de 7 días desde el alta sin haber cargado datos nunca |
| Verde | Usó en los últimos 7 días **y** cargó datos en los últimos 7 días (con los primeros pasos completos) |
| Amarillo | Todo lo demás |

### 6.4 Lista de organizaciones

Columnas **Salud**, **Plata del mes** (ingresos + gastos) y **Tiempo esta semana**; filtros por tipo y salud; orden por cualquier columna. La fila entera lleva a la ficha; «Ver ERP» en la última columna.

### 6.5 Ficha de la organización (`/admin/organizaciones/[id]`)

Arriba: nombre, tipo, departamento, alta, semáforo y **Ver ERP en solo lectura**. Debajo: cuatro tarjetas (Cerdas · Plata del mes · Personas · Tiempo de la semana) · **Estado de las cerdas** en una barra (servidas `#FAC775`, gestantes `#C0DD97`, lactancia `#B5D4F4`, vacías `#F7C1C1`, otras `#D3D1C7`) · **En qué módulos pasan el tiempo** · Miembros con último acceso y horas de la semana · Mensajes al buzón · Auditoría. Sin motivo registrado no se muestra nada de la organización.

### 6.6 Cuentas

Columna **Tiempo (7 días)** y **Ver ERP** por persona (su organización principal; si tiene varias, un selector).

### 6.7 «Ver ERP» en un clic

`abrirERPEnLectura(organizacionId, motivo?, detalle?)` en `src/app/acciones/admin.ts`, solo `TOTAL` y `SOPORTE`. Sin motivo vigente usa el recibido o `MEJORA_DEL_PRODUCTO`; un motivo elegido explícitamente se registra siempre. Todo lo demás igual: banner, `acceso_plataforma`, auditoría `SUPERADMIN_LECTURA` y la organización lo ve. Botón partido: el clic principal usa el motivo predeterminado; la flecha despliega Soporte, Seguridad, Estadística y Otro. El banner del modo plataforma suma «Volver a la ficha».

### 6.8 El Super Administrador no es una granja

`(dashboard)/layout.tsx`: sin organización y con rol de plataforma → `/admin`. Como el login lleva a `/dashboard`, el destino de una cuenta así queda en `/admin`.

---

## 7. Fase 15.5 — Pruebas y documentación

- `supabase/tests/fase15_buzon.sql` (en la CI): función nueva incompleta, publicación sin texto público, prioridad y estado inválidos, voto duplicado, borrado en cascada de votos, permisos de `anon` y `authenticated`, y las reglas de `registrar_latido`.
- `npm run prueba:modulos` y `npm run prueba:salud` (en la CI).
- Actualizados `docs/SOPORTE_Y_PRODUCCION.md` y `docs/CORREO_Y_CAPTCHA.md`; `RESEND_API_KEY` en `.env.example`.

## 8. Variables de entorno nuevas

| Variable | Para qué | Si falta |
|---|---|---|
| `RESEND_API_KEY` | Aviso por correo del buzón | No se envían avisos; el buzón funciona igual |
| `CRON_SECRET` | Ya existe (Fase 14); lo usa también `/api/cron/buzon-resumen` | El cron responde 401 |

## 9. Criterios de aceptación

- [ ] En un celular, ningún botón de la app queda tapado por la ayuda; la pestaña se arrastra, se pliega y recuerda su lugar.
- [ ] Un cliente puede mandar los cuatro tipos; «Función nueva» pide título, problema y cómo funcionaría; el módulo viene completo desde la pantalla de origen.
- [ ] El Super Administrador ve todo categorizado, puede recategorizar, priorizar, responder, agrupar y publicar; el cliente recibe una notificación y ve la respuesta.
- [ ] La hoja de ruta nunca muestra mensajes originales, autores ni organizaciones.
- [ ] El aviso por correo no incluye el texto del cliente y, sin `RESEND_API_KEY`, no rompe nada.
- [ ] El panel muestra tiempo de uso por organización y por módulo; en modo plataforma no se cuenta uso.
- [ ] Desde Cuentas u Organizaciones se abre el ERP de un cliente en solo lectura con un solo clic; queda registrado y la organización lo ve.
- [ ] El menú del panel cabe en un celular de 360 px.
- [ ] Una cuenta de plataforma sin organización entra directo a `/admin`.
- [ ] Todas las pruebas nuevas pasan en la CI y las anteriores siguen pasando.

## 10. Fuera de alcance por ahora

Correo entrante que se cargue solo en el buzón · avisos por WhatsApp · «ver como» un rol determinado · comparativos anónimos entre granjas · resumen semanal por correo.
