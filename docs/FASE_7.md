# Fase 7 — Equipo y permisos

Estado: **parte 1 en producción desde el 08/11/2026**. Sin cambios en la base de datos.

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
- [ ] Sin `finanzas.costos.ver`, el valor del stock aparece como "—" → parte 2.
- [ ] Test de aislamiento con `dbOrg` → parte 2.

## Parte 2 (pendiente)
1. `dbOrg(orgId, actorId)`: extensión de Prisma que filtra por organización y por granjas/unidades permitidas en todas las consultas, y fija el actor del historial. Regla de ESLint que prohíbe el cliente Prisma directo en las rutas.
2. Chequeos de **lectura** por permiso en las APIs GET (hoy filtran por organización, pero no por permiso `ver` del módulo).
3. Montos en pantallas productivas solo con `finanzas.costos.ver`.
4. Reemplazar los chequeos de roles que quedan en las pantallas y quitar el puente de roles legados.
5. Editar las plantillas de roles de la organización (pestaña Roles) y la actividad del equipo (auditoría filtrable).
6. Transferir la propiedad (con segundo factor) y exigir segundo factor a quien tenga permisos de finanzas, sueldos o equipo.
