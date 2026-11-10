# Fase 12 — Mercado KurPorc: catálogo, tiendas y publicaciones

## Base de datos (`20261110000100_fase12_mercado`)
- Tablas: `categoria_mercado` (árbol de 6 categorías principales y 21 subcategorías), `producto_catalogo` (catálogo maestro con 46 productos y su categoría de Finanzas), `tienda` (1 a 1 con cada organización VENDEDOR; se crearon las que ya existían), `publicacion`, `favorito`, `denuncia_publicacion`.
- Búsqueda en español: `unaccent` + `pg_trgm` en el esquema `extensions`, función inmutable `public.texto_busqueda()` e índice GIN trigram sobre título, marca y descripción. Cada palabra buscada tiene que estar; "relevancia" ordena por similitud.
- RLS activado y sin acceso para `anon`/`authenticated`: todo se lee desde el servidor.
- Fotos: bucket público `mercado` de Supabase Storage (solo `image/webp`, máximo 300 KB). El navegador convierte y achica la foto; el servidor revisa el contenido real (cabecera RIFF/WEBP) y la sube con la clave de servicio.
- `sugerencia.id` y los ids nuevos usan `gen_random_uuid()` en la base (el esquema de Prisma coincide con las migraciones).

## Pantallas públicas (sin login)
- `/mercado`: buscador, categorías y subcategorías, filtros (departamento de entrega, precio máximo, solo verificadas) y orden (relevancia, precio por unidad base, más nuevos, mejor calificados).
- Tarjeta: foto, título, precio de venta, **precio por unidad base** (`Gs 2.350/kg`), tienda con insignia de verificada, zonas.
- `/mercado/p/[slug]`: galería, precio, mínimo, plazo, zonas, tienda, aviso de receta, declaración SENACSA, **Pedir**, **Solicitar cotización** y **Consultar por WhatsApp**. Sin sesión llevan al registro y vuelven a la misma publicación. Pedir y cotizar se completan en la Fase 13.
- `/tienda/[slug]`, `/mercado/favoritos`, denunciar una publicación (con sesión).
- Todas las tiendas, incluida la del operador, salen en el mismo orden: no hay destacados.

## Panel de vendedor `/vendedor`
- Inicio (publicaciones por estado, favoritos, calificación, primeros pasos), Productos (alta desde el catálogo o "Proponer producto", hasta 6 fotos, activar/pausar), Mi tienda (descripción, zonas, horario, WhatsApp).
- Permisos sobre la organización VENDEDOR: `tienda.publicaciones.crear/editar/pausar`, `tienda.precios.editar` (cambiar un precio), `tienda.perfil.editar`.
- Reglas: sin tienda verificada la publicación queda en BORRADOR; en Genética y animales hace falta además la declaración de documentación sanitaria de traslado (SENACSA); los productos con receta muestran el aviso; una publicación rechazada por Moderación no se reactiva desde la tienda.

## Panel de plataforma
- `/admin/mercado` (todos los niveles, agregados) y `/admin/moderacion` (TOTAL, SOPORTE, MODERACION): denuncias, rechazar/restablecer con aviso a la tienda, aprobar productos propuestos con su código.

## Pruebas
`npm run prueba:mercado` (también en CI): precio por unidad base, "nucleo lactacion" encuentra "Núcleo de lactación" en la base, filtros, orden por precio y relevancia, solo activas de tiendas no rechazadas, reglas de publicación.
