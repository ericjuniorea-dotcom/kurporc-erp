# Fase 2 — Seguridad base y auditoría

Estado: **probada contra una copia local de producción y en una base vacía (simulación de CI)**. Falta aplicarla en producción.

## Qué se hizo

| Punto | Implementación |
|---|---|
| 2.1 Auditoría | Tabla `auditoria` + `registrarAuditoria()` en [src/lib/seguridad/auditoria.ts](../src/lib/seguridad/auditoria.ts). Se registran: `LOGIN`, `LOGIN_FALLIDO`, `LOGIN_BLOQUEADO`, `DATO_PERSONAL_VISTO` (con IP y navegador) |
| 2.1 Historial de cambios | Tabla `historial_cambio` + trigger `registrar_cambio()` (antes y después de cada INSERT/UPDATE/DELETE) en 22 tablas: organización, granjas, unidades, miembros, permisos, roles, invitaciones, configuración, protocolos sanitarios, funcionarios y sueldos. Las financieras se suman en la Fase 8 |
| 2.1 Actor con Prisma | `conActor(actorId, fn)` en [src/lib/db/actor.ts](../src/lib/db/actor.ts) fija `app.actor_id` en la transacción; el trigger lo toma. Ya se usa en RRHH |
| 2.1 Solo agregar | Triggers que rechazan UPDATE, DELETE y TRUNCATE en `auditoria` e `historial_cambio`, incluso para el dueño de las tablas; `revoke` para los roles de la API |
| 2.2 Encabezados | HSTS (2 años, preload), `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, sin `X-Powered-By` ([next.config.mjs](../next.config.mjs)) |
| 2.2 CSP | Con nonce por request en [src/middleware.ts](../src/middleware.ts), modo **Report-Only**; los informes van a `/api/csp-report` (logs de Vercel, buscar `[csp]`). Verificado: todos los `<script>` llevan el nonce |
| 2.3 Límite de intentos | Tabla `limite_intento` + funciones `consumir_intento`, `bloqueado_hasta`, `limpiar_intentos`. Ingreso: 5 fallos cada 15 min por cuenta + IP; cada bloqueo seguido duplica la espera (hasta 64×). El mensaje no revela si el correo existe y el tiempo de respuesta es el mismo |
| 2.4 Cifrado | AES-256-GCM con versión de clave (`k1:`) y HMAC para buscar, en [src/lib/seguridad/cifrado.ts](../src/lib/seguridad/cifrado.ts). Aplicado a la **cédula de funcionarios** (`employees.cedula` + `cedulaHash`); se muestra enmascarada (`•••••456`) a quien no es Admin ni Jefe de RRHH, y cada vista completa queda auditada |
| 2.5 Validación | Zod `.strict()` en el alta de funcionarios. Cerrado el riesgo R5: las rutas `PATCH` de genética y vacunas ya no aceptan `id`, `tenantId` ni fechas de sistema. ESLint prohíbe `dangerouslySetInnerHTML` |
| 2.7 Secretos | Historial de Git revisado (8 commits): **sin claves filtradas**, solo ejemplos de `.env.example`. `.env*` en `.gitignore` |
| 2.7 Dependencias | `npm audit fix`: de 24 a 13 avisos (de 4 críticos a 1). Dependabot semanal ([.github/dependabot.yml](../.github/dependabot.yml)) |
| 2.12 Incidentes | Tabla `incidente_seguridad` y [docs/PLAN_INCIDENTES.md](PLAN_INCIDENTES.md) (72 h, Ley 7593/2025) |
| 2.9 Restauración | [docs/RESTAURACION.md](RESTAURACION.md), con la primera prueba de restauración registrada |
| CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml): validate, tipos, lint, migraciones desde cero, pruebas de aislamiento y seguridad, comparación migraciones ↔ esquema, build y audit |
| Lint | ESLint (`next lint`) configurado; `npm run lint` sin errores |

Además:
- **Sin nombres personales**: la carga inicial de funcionarios y los responsables de Tareas usaban nombres de personas reales; ahora son puestos (Veterinario, Encargado de Gestación, Jefatura de Producción…). La migración actualiza las 24 tareas guardadas.
- `npm run db:migrate` y `db:setup` usaban `prisma migrate dev`, que con `.env` apuntando a producción podía intentar resetear la base. Ahora usan `migrate deploy`.

## Criterios de aceptación
- [x] `UPDATE` o `DELETE` sobre `auditoria` desde SQL falla — prueba 1 de `fase2_seguridad.sql`.
- [x] Un cambio hecho con Prisma deja una fila en `historial_cambio` con el actor correcto — prueba 2 (sobre `miembro`; los movimientos financieros llegan en la Fase 8 y se agregan al trigger).
- [ ] `curl -I https://kurporc.com` muestra todos los encabezados → verificado en local; verificar en producción después del despliegue.
- [x] El sexto intento de ingreso fallido en 15 minutos queda bloqueado — prueba 3 y prueba de punta a punta (el 6.º intento quedó bloqueado aunque la contraseña era correcta; desde otra IP se pudo entrar).
- [x] Un dato sensible se guarda cifrado y se ve en claro solo con permiso — aplicado a la cédula (todavía no hay cuentas bancarias en el sistema).
- [x] Historial de Git sin claves filtradas (revisión con patrones; `gitleaks` no está instalado, lo corre la CI cuando se agregue).
- [x] Existen `docs/PLAN_INCIDENTES.md` y `docs/RESTAURACION.md`.
- [x] `prisma validate`, `tsc`, `npm run lint` y `npm run build` sin errores.

## Pendiente (requiere una decisión o un paso manual)
1. **Claves de cifrado en Vercel:** `CAMPOS_CIFRADOS_KEY` y `CAMPOS_HMAC_KEY` ya están en `.env.local` (y en el respaldo). Hay que copiarlas a Vercel → Settings → Environment Variables. Sin ellas, cargar un funcionario **con cédula** da un error claro; todo lo demás funciona.
2. **Copia externa semanal cifrada (2.9):** quedó sin hacer. Sacar un volcado de la base de producción a otro proveedor (por ejemplo, artefactos de GitHub) implica que datos personales salgan de Supabase: lo decide el dueño. Alternativas: plan Pro de Supabase (respaldo diario + PITR, US$25/mes) o seguir con el respaldo manual antes de cada cambio.
3. **CAPTCHA (2.3)** en registro, recuperación e ingreso: se configura en Supabase Auth → Fase 3.
4. **Sesiones (2.10):** cierre por inactividad, "cerrar sesión en todos los dispositivos" y corte inmediato al suspender un miembro → Fase 3 (se hace sobre Supabase Auth, no sobre NextAuth).
5. **Monitoreo y alertas por correo (2.11):** requiere Sentry y un servicio de correo (`RESEND_API_KEY`).
6. **Archivos (2.6):** buckets de Supabase Storage → cuando se suban archivos (Fase 4 contratos, Fase 6 verificación de vendedores).
7. **CSP en modo bloqueo:** después de una semana sin informes legítimos en `/api/csp-report`, poner `CSP_MODO=enforce` en Vercel.
8. **Next.js 14 → 16:** los avisos que quedan (1 crítico y 2 altos en Next/PostCSS; Zod 4 y OpenAI 7) solo se resuelven con versiones mayores. Se hace como paso propio antes de la Fase 3; ahí la CI pasa a `--audit-level=high`.
9. **Modo sin conexión (2.13):** el ERP no guarda datos en el dispositivo hoy; se revisa cuando se amplíe.
10. **Antes de abrir el registro al público (2.14):** revisión OWASP ASVS nivel 2 y prueba de penetración externa (Anexo F).
