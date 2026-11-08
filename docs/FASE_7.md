# Fase 7 — Equipo y permisos

Estado: **partes 1 y 2 en producción desde el 08/11/2026**. Sin cambios en la base de datos.

## Parte 1 (hecha)

| Punto | Implementación |
|---|---|
| Motor de permisos | [src/lib/permisos/servidor.ts](../src/lib/permisos/servidor.ts): `getPermisos()`, `puede()`, `requirePermiso()` (acciones) y `permisoApi()` (APIs). Misma lógica que `tiene_permiso()` en la base: propietario → todo; rol + ajustes PERMITIR − DENEGAR; los permisos "solo propietario" nunca se delegan; alcance por granja y unidad; suspendido = nada |
| APIs | Las **68** funciones que cargan o modifican datos exigen el permiso de su acción y responden 403 sin él. Antes, 46 solo pedían sesión iniciada |
| Menú | Cada ítem declara su permiso `ver`; nuevo ítem **Equipo** |
| Puente | [src/lib/permisos/legado.ts](../src/lib/permisos/legado.ts) deriva los roles viejos (1–14) de los permisos, para las pantallas que todavía los consultan. La seguridad no depende de esto |
| UI | `usePermisos()` y `<Can permiso="…">` en [sesion-cliente.tsx](../src/lib/auth/sesion-cliente.tsx) |
| `/equipo` | Miembros (rol, ajustes, alcance, límite de compra, último acceso, estado) · Invitaciones · Pedidos para unirse · código de empresa |
| Agregar persona | Con correo: invitación de 7 días; se guarda solo el hash del token; el enlace se copia o se manda por WhatsApp. Sin correo: cuenta de operario con contraseña temporal que se muestra una vez y obliga a cambiarla |
| Matriz | Todo el catálogo agrupado por área, buscador, atajos por fila, ⚠ sensibles, 🔒 solo propietario, borde rojo para lo distinto del rol, resumen en lenguaje simple |
| Reglas | Siempre un propietario; nadie da permisos que no tiene; solo el propietario da "sin límite" de compra y edita a quien edita permisos; nadie se edita a sí mismo; cada cambio queda auditado (`PERMISOS_CAMBIADOS` con agregados y quitados) |
| `/invitacion/[token]` | La persona entra con Google o correo, **acepta el contrato ella misma** y se suma; quien invitó recibe una notificación |
| Pruebas | `npm run prueba:permisos` (14 controles) en la CI |

## Criterios de aceptación
- [x] La matriz muestra todos los permisos del catálogo, agrupados, con buscador.
- [x] Invitar por correo y que el ayudante entre con Google con los permisos elegidos, después de aceptar él mismo el contrato.
- [x] Una cuenta de operario entra con usuario + código de empresa + contraseña, y se le exige cambiarla.
- [x] Un operario sin `gestacion.servicios.editar` recibe 403 aunque fuerce el request (`permisoApi` en todas las APIs de escritura).
- [x] Un miembro limitado a una granja no tiene permisos en otra (prueba del motor).
- [x] Sin `finanzas.costos.ver`, el valor del stock aparece como "—" (la API ni siquiera lo manda).
- [x] Test de aislamiento con `dbOrg` (`npm run prueba:dborg`, 14 controles, en la CI).

## Parte 2 (hecha)

| Punto | Implementación |
|---|---|
| Lectura por permiso | Las **62** APIs GET de datos productivos exigen el `ver` de su módulo (`puede` / `puedeAlguno`). Las que alimentan varias pantallas aceptan cualquiera de los módulos que las usan (p. ej. la lista de cerdas: plantel, gestación, maternidad, sanidad o destete). Quedan abiertas a cualquier miembro: `/api/dashboard/*` y `/api/config/*` (lectura de parámetros) |
| Montos | [src/lib/permisos/montos.ts](../src/lib/permisos/montos.ts): `jsonConMontos()` pone en `null` precios, costos y valores en 12 APIs si falta `finanzas.costos.ver`. Las pantallas muestran "—" |
| Roles viejos | Ninguna pantalla ni API consulta ya `session.user.roles`; se borró el puente `legado.ts`. `usePermisos()` suma `alguno([...])` |
| `dbOrg` | [src/lib/db/org.ts](../src/lib/db/org.ts): extensión de Prisma que agrega `tenantId`/`organizacionId` a toda consulta, completa la organización en las altas, rechaza escribir o mover datos a otra organización y fija el actor del historial. Para código nuevo: `dbDeSesion()` |
| Pestaña Roles | Crear, editar y eliminar roles de la organización con la misma matriz. Nadie arma un rol con permisos que no tiene; Administrador General es fijo; no se elimina un rol en uso |
| Pestaña Actividad | Últimos 300 eventos de la auditoría, filtrables por acción y persona (con `equipo.auditoria.ver`) |
| Transferir propiedad | Solo el propietario, con segundo factor verificado en la sesión y escribiendo el nombre de la organización. El anterior queda como Administrador General. Auditado (`PROPIEDAD_TRANSFERIDA`) y notificado |
| Segundo factor | Finanzas, sueldos, datos personales, permisos/roles del equipo y exportación quedan **en pausa** para un miembro sin segundo factor en esa sesión, con aviso arriba de todo. Al propietario solo se le avisa (nunca se lo deja afuera) |

## Pendiente (para más adelante)
- Pasar las APIs existentes de `prisma` a `dbOrg` de a poco (hoy filtran a mano por `tenantId`, verificado) y entonces activar la regla de ESLint que prohíbe el cliente directo en `src/app/api`. No se hizo de una vez porque son ~130 archivos y varios usan transacciones interactivas.
- Alcance por granja en las consultas (hoy el motor lo calcula y las acciones lo respetan, pero los listados todavía muestran todas las granjas de la organización).
- Que la función SQL `tiene_permiso()` también pida segundo factor para los permisos sensibles (hoy solo se usa si en el futuro se abren las APIs de Supabase).
