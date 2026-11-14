/**
 * Fase 15 · Ruta → módulo (src/lib/modulos.ts): la única tabla que usan el buzón, el latido y el panel.
 *   npm run prueba:modulos
 */
import { moduloDeRuta } from "@/lib/modulos";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const es = (ruta: string, modulo: string) => check(moduloDeRuta(ruta) === modulo, `${ruta} → ${modulo} (dio ${moduloDeRuta(ruta)})`);

// Cada ruta del menú lateral
es("/dashboard", "TABLERO");
es("/plantel", "PLANTEL");
es("/gestacion", "GESTACION");
es("/maternidad", "MATERNIDAD");
es("/recria", "INICIACION");
es("/engorde", "ENGORDE");
es("/sanidad", "SANIDAD");
es("/tareas", "TAREAS");
es("/alimentacion", "ALIMENTACION");
es("/logistica", "LOGISTICA");
es("/rrhh", "RRHH");
es("/finanzas", "FINANZAS");
es("/financiero/flujo", "FINANZAS");
es("/whatsapp", "WHATSAPP");
es("/compras", "COMPRAS");
es("/mercado", "MERCADO");
es("/tienda/mi-tienda", "MERCADO");
es("/equipo", "EQUIPO");
es("/configuracion", "CONFIGURACION");
es("/vendedor", "VENDEDOR");
es("/cuenta", "CUENTA");
es("/cuenta/hoja-de-ruta", "CUENTA");
// Rutas con parámetros, consulta o mayúsculas
es("/recria/lotes/cmw8abc123", "INICIACION");
es("/plantel?cerda=abc", "PLANTEL");
es("/finanzas/ventas/123#detalle", "FINANZAS");
es("/Maternidad", "MATERNIDAD");
// Desconocidas y prefijos parecidos
es("/", "OTRO");
es("/admin/buzon", "OTRO");
es("/plantelx", "OTRO");
check(moduloDeRuta(null) === "OTRO" && moduloDeRuta(undefined) === "OTRO" && moduloDeRuta("") === "OTRO", "sin ruta → OTRO");
console.log("Todo bien.");
