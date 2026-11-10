# Activar el correo propio (SMTP) y el CAPTCHA

Los dos son requisitos antes de abrir el registro al público (Anexo F). El código ya está listo: solo faltan cuentas y claves que se cargan en paneles externos.

## 1. CAPTCHA (Cloudflare Turnstile, gratis, sin tarjeta)
1. Entrar a dash.cloudflare.com (crear cuenta si no hay) → **Turnstile** → **Add widget**.
2. Nombre: KurPorc · Dominios: `kurporc.com` y `www.kurporc.com` · Modo: **Managed**.
3. Copiar las dos claves: **Site key** (pública) y **Secret key** (secreta, no compartirla).
4. **Vercel** → proyecto → Settings → Environment Variables → agregar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = la Site key → **Redeploy**.
5. Esperar a que termine el deploy y comprobar que en /login aparece la verificación (o pasa sola).
6. Recién entonces: **Supabase** → Authentication → **Attack Protection** → Enable CAPTCHA protection → proveedor **Turnstile** → pegar la **Secret key** → Save.
   - El orden importa: si se activa en Supabase antes del paso 4, nadie puede ingresar con contraseña.
   - Si algo falla, desactivarlo en Supabase vuelve todo como estaba.
7. Probar: ingresar, registrar una cuenta de prueba y pedir recuperación de contraseña.

## 2. Correo propio (SMTP)
El correo incluido en Supabase manda muy pocos correos por hora: no alcanza para el registro público.

Opción sugerida: **Resend** (plan gratuito con 3.000 correos por mes; confirmar al crear la cuenta que no pida tarjeta).
1. resend.com → crear cuenta → **Domains** → Add domain → `kurporc.com`.
2. Resend muestra registros DNS (SPF, DKIM y MX de retorno). Cargarlos en **Hostinger** → Dominios → kurporc.com → DNS, tal cual. Esperar a que Resend diga **Verified** (minutos a unas horas).
3. Resend → **API Keys** → crear una con permiso de envío.
4. **Supabase** → Authentication → **Emails** → SMTP Settings → Enable custom SMTP:
   - Host `smtp.resend.com` · Puerto `465` · Usuario `resend` · Contraseña: la API key.
   - Remitente: `no-responder@kurporc.com` · Nombre: `KurPorc`.
5. Supabase → Authentication → Rate Limits → subir "emails por hora" (por ejemplo, a 100).
6. Probar: registrar una cuenta con un correo propio y pedir recuperación de contraseña. Revisar que no llegue a Spam.

Al elegir el proveedor, avisar al asesor legal para agregarlo a la Política de Privacidad (ver docs/REGISTRO_TRATAMIENTOS.md).

## 3. Política de seguridad del navegador en modo bloqueo
1. Vercel → proyecto → **Logs** → buscar `[csp]` en los últimos días. Si no aparece nada (o solo extensiones del navegador), seguir.
2. Settings → Environment Variables → `CSP_MODO` = `enforce` → Redeploy.
3. Recorrer el sitio (inicio, login, Mercado, tablero, Finanzas). Si algo deja de cargar, borrar la variable y Redeploy vuelve al modo de prueba.
Verificado en local el 10/11/2026: con el modo bloqueo, los 152 scripts de las páginas públicas llevan el nonce correcto.
