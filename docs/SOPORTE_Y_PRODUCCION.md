# Soporte y carga de Producción/Sanidad

## Soporte (soporte@kurporc.com)
- **soporte@kurporc.com**: consultas, problemas y sugerencias de quienes usan KurPorc. Siempre a la vista.
- **info@kurporc.com**: lo institucional (prensa, alianzas, temas legales y de privacidad).
- Botón fijo «Ayuda y sugerencias» en el panel, la cuenta y el panel de tiendas: se elige idea, problema o duda y se escribe.
  Lo que llega se ve en **Panel de plataforma → Sugerencias** (tabla `sugerencia`), con estado y respuesta;
  la persona ve la respuesta en el mismo botón. Límite: 20 por persona por día.
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
