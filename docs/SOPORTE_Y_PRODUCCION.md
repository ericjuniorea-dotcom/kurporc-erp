# Soporte y carga de Producción/Sanidad

## Soporte (soporte@kurporc.com)
- **soporte@kurporc.com**: consultas, problemas y sugerencias de quienes usan KurPorc. Siempre a la vista.
- **info@kurporc.com**: lo institucional (prensa, alianzas, temas legales y de privacidad).
- Pestaña «Ayuda y sugerencias» en el borde derecho (se pliega y se arrastra; no aparece en modo plataforma) en el panel, la cuenta y el panel de tiendas.
  Cuatro tipos: algo no funciona, duda, idea y **función nueva** (título, qué problema resuelve y cómo debería funcionar). El módulo viene de la pantalla de origen.
- **El buzón vive en la base** (tabla `sugerencia`, votos en `sugerencia_voto`). El correo solo avisa: un problema avisa al momento a soporte@ y el resto va en un resumen diario
  (`/api/cron/buzon-resumen`, 08:00 de Asunción). El aviso nunca lleva el texto del cliente: solo tipo, módulo, organización y el enlace al panel.
- Se gestiona en **Panel de plataforma → Buzón** (`/admin/buzon`; `/admin/sugerencias` redirige): recategorizar, prioridad, estado, respuesta,
  agrupar mensajes repetidos y publicar en la hoja de ruta con texto reescrito. La persona ve la respuesta en el mismo botón y recibe un aviso (punto en la pestaña).
- Hoja de ruta para clientes en `/cuenta/hoja-de-ruta`: solo título y descripción públicos, estado y cuántas granjas la piden. Nunca el mensaje, el autor ni la organización.
- Límite: 20 mensajes por persona por día.
- El correo de soporte también aparece en las pantallas de acceso, el pie de la página pública, el panel de tiendas y el menú del bot de WhatsApp.
- Los correos que lleguen directo a la casilla no entran a la bandeja: se responden desde la casilla.

## Carga de los registros de la granja
`scripts/importar_produccion.ts` (`npm run db:importar-produccion`) carga en una transacción plantel, reproductores, servicios,
diagnósticos, repeticiones, partos, adopciones, mortandad, destetes, lotes de recría, salidas (enlazadas a las ventas que ya
estaban en Finanzas, sin duplicar ingresos), el calendario sanitario y las aplicaciones registradas. El archivo de datos
queda fuera del repositorio. Al final compara 13 cifras contra la planilla (todas deben dar ✓).

Datos que la planilla ya marcaba como pendientes de revisar (quedan igual, con nota):
- E-0001: los 1.534,3 kg son estimados (67 × 22,9 kg), no de balanza.
- P-0013 (69: 5 vivos, 10 destetados), P-0015 (71: 7 y 8), P-0017 (75: 18 y 14 sin bajas): falta una adopción o una baja.
- Gestaciones fuera de rango: S-0033 (96 d), S-0032 (102 d), S-0022 (140 d), S-0024 (138 d).
- Destetes sin peso de camada; cinco bajas sin causa.
- Sanidad llega al 30/09: lo que vence después figura como pendiente o atrasado hasta que se cargue.
