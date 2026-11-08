# Fase 3 — Autenticación: Google, correo, usuario de operario y segundo factor

Estado: **aplicada en producción el 07/11/2026**.

## Qué se hizo

| Punto | Implementación |
|---|---|
| Next.js | 14.2 → **15.5.29** y React 19. Cierra las vulnerabilidades críticas de Next (RCE en el optimizador de imágenes, DoS de Server Components, etc.). APIs asíncronas (`params`, `headers()`, `cookies()`) adaptadas con el codemod oficial. Sin optimizador de imágenes (no se usaba) |
| Supabase Auth | Reemplaza a NextAuth. Clientes en [src/lib/supabase/](../src/lib/supabase/) (`server`, `client`, `admin` solo servidor) |
| Sesión | [src/lib/auth/config.ts](../src/lib/auth/config.ts): `getUsuario()` (persona) y `getSession()` (persona + organización activa). La forma de `session.user` es la misma de antes, así que las ~120 pantallas y APIs no cambiaron de lógica |
| Organización activa | Cookie `kp_org` (`httpOnly`, `secure`, `sameSite=lax`), **validada contra `miembro` en cada request**. Selector en el menú cuando la persona pertenece a más de una |
| Ingreso | [/login](../src/app/(auth)/login/formulario-ingreso.tsx): "Continuar con Google", correo y contraseña, y pestaña **Usuario de operario** (usuario + código de empresa). Las contraseñas pasan por el servidor para aplicar el límite de intentos y la auditoría de la Fase 2 |
| Callback | [/auth/callback](../src/app/auth/callback/route.ts) canjea el código; `?next=` solo acepta rutas internas (sin redirección abierta) |
| Contraseñas | `/recuperar` (no revela qué correos existen; 3 por hora), `/cuenta/cambiar-clave` (mínimo 10 caracteres). Contraseña temporal (`debeCambiarClave`) obliga a cambiarla antes de entrar |
| Segundo factor | `/cuenta/seguridad`: activar TOTP con QR, desactivar, cerrar sesión en todos los dispositivos. Con el factor activo, el ingreso pide el código (`/auth/segundo-factor`) y **ni las pantallas ni las APIs responden** hasta verificarlo |
| Perfil automático | Trigger `handle_new_user` en `auth.users`: crea el perfil con nombre y foto de Google. Si ya existía un perfil con ese correo, lo **vincula solo si el correo está confirmado** (un registro sin confirmar no puede apropiarse de una cuenta) |
| Usuarios existentes | `npm run db:migrar-auth`: los 3 usuarios pasaron a Supabase Auth **con su mismo hash bcrypt** (siguen entrando con su contraseña de siempre) |
| Base | `users.tenantId` y `users.passwordHash` opcionales (legado); se borraron las tablas de NextAuth (`accounts`, `sessions`, `verification_tokens`, vacías) |
| Dependencias | Fuera: `next-auth`, `@auth/prisma-adapter`, `firebase-admin`, `bull`, `@aws-sdk/*` (sin uso). `openai` actualizado |

## Criterios de aceptación
- [x] Registro e ingreso con Google funcionan en `kurporc.com` (app de Google publicada el 07/11/2026, después de la Fase 4).
- [x] Al primer ingreso con Google se crea el perfil con nombre y foto — prueba 1 de `supabase/tests/fase3_auth.sql`.
- [x] `?next=https://otro-sitio.com` no redirige afuera — validado en `/auth/callback` y en las acciones de ingreso.
- [x] Un usuario con dos membresías cambia de perfil sin volver a ingresar y no puede forzar una `kp_org` ajena: la cookie se valida contra `miembro` en `getSession()` y en `cambiarOrganizacion()`.
- [ ] `/admin` sin segundo factor responde 404 → `/admin` se construye en la Fase 11; la verificación `aal2` ya está disponible en la sesión.
- [x] Un operario con cuenta gestionada entra con usuario + código de empresa y se le exige cambiar la contraseña (las cuentas se crean desde Equipo, Fase 7).
- [x] Usuarios existentes migrados conservan su contraseña (verificado contra Supabase Auth en producción).
- [x] Pruebas de las Fases 1 y 2 en verde contra producción después de migrar.

## Pendiente
1. ~~Publicar la app de Google~~ — hecho en la Fase 4.
2. **CAPTCHA** (Turnstile) en registro, recuperación e ingreso: se activa en Supabase Auth junto con el registro público (Fase 6).
3. **Correo propio (SMTP):** el plan gratuito de Supabase manda ~2 correos por hora. Antes de abrir el registro: Resend u otro SMTP (Fase 6).
4. **Aviso de ingreso desde un dispositivo nuevo** por correo: requiere el SMTP del punto 3.
5. **Exigir segundo factor** a quien tenga permisos de finanzas, sueldos o equipo: se aplica con los permisos de la Fase 7.
6. Quedan 3 avisos de dependencias (Zod 4 y PostCSS dentro de Next): ninguno crítico.
