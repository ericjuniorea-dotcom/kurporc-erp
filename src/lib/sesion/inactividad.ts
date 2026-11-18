// Cierre de sesión por inactividad. Puro: lo usan el middleware (edge) y el aviso del navegador.
export const MINUTOS_INACTIVIDAD = 30;
export const LIMITE_INACTIVIDAD_MS = MINUTOS_INACTIVIDAD * 60_000;
/** Cookie con la hora (ms) del último uso; la renueva el middleware en cada pedido real (no en precargas). */
export const COOKIE_ACTIVIDAD = "kp_act";
