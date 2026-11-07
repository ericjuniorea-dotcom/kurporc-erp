// Roles plantilla — Anexo A.11. Son globales (organizacion_id = null) y se
// COPIAN a cada organización para que su Administrador General los edite.
// Sin ENCARGADO_BALANCEADO: KurPorc no fabrica balanceado.
// Ningún rol recibe permisos "solo propietario" (no se delegan).

import { CATALOGO_PERMISOS, conVer, type PermisoDef } from "./catalogo";

export interface RolPlantilla {
  codigo: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
}

const PRODUCCION = new Set(["plantel", "gestacion", "maternidad", "destete", "engorde", "sanidad", "alimentacion", "stock", "tareas", "reportes"]);
const BASICAS = new Set(["ver", "crear", "editar"]);

type Pred = (p: PermisoDef) => boolean;
const enModulo = (...m: string[]): Pred => p => m.includes(p.modulo);
const clave = (...c: string[]): Pred => p => c.includes(p.clave);
const recurso = (base: string): Pred => p => `${p.modulo}.${p.recurso}` === base;
const accion = (...a: string[]): Pred => p => a.includes(p.accion);
const y = (...ps: Pred[]): Pred => p => ps.every(f => f(p));
const o = (...ps: Pred[]): Pred => p => ps.some(f => f(p));
const no = (f: Pred): Pred => p => !f(p);
const produccion: Pred = p => PRODUCCION.has(p.modulo);

function armar(...incluir: Pred[]): string[] {
  const elegidos = CATALOGO_PERMISOS
    .filter(p => !p.soloPropietario && incluir.some(f => f(p)))
    .map(p => p.clave);
  return Array.from(conVer(elegidos)).sort();
}

function encargado(modulo: string): string[] {
  return armar(
    y(enModulo(modulo), accion("ver", "crear", "editar")),
    clave("plantel.animales.ver", "sanidad.aplicaciones.crear", "tareas.tareas.ver", "tareas.tareas.completar"),
  );
}

export const ROLES_PLANTILLA: RolPlantilla[] = [
  {
    codigo: "ADMIN_GENERAL",
    nombre: "Administrador General",
    descripcion: "Todos los permisos. El propietario de la organización siempre tiene este rol.",
    permisos: armar(() => true),
  },
  {
    codigo: "JEFE_PRODUCCION",
    nombre: "Jefatura de Producción",
    descripcion: "Carga y corrige todo lo productivo; pide cotizaciones y arma pedidos.",
    permisos: armar(
      y(produccion, accion("ver", "crear", "editar"), no(clave("sanidad.carencias.liberar"))),
      clave("gestacion.cerdas_paradas.ver", "compras.necesidades.ver", "compras.pedidos.crear"),
      enModulo("tareas", "reportes"),
      recurso("compras.cotizaciones"),
    ),
  },
  {
    codigo: "VETERINARIO",
    nombre: "Veterinario",
    descripcion: "Jefatura de Sanidad: todo Sanidad, ve todo Producción y carga en plantel, gestación y maternidad.",
    permisos: armar(
      enModulo("sanidad", "tareas"),
      y(produccion, accion("ver")),
      y(enModulo("plantel", "gestacion", "maternidad"), accion("crear")),
    ),
  },
  { codigo: "ENCARGADO_GESTACION", nombre: "Encargado de Gestación", descripcion: "Carga y corrige en Gestación.", permisos: encargado("gestacion") },
  { codigo: "ENCARGADO_MATERNIDAD", nombre: "Encargado de Maternidad", descripcion: "Carga y corrige en Maternidad.", permisos: encargado("maternidad") },
  { codigo: "ENCARGADO_DESTETE_RECRIA", nombre: "Encargado de Destete y Recría", descripcion: "Carga y corrige en Destete y Recría.", permisos: encargado("destete") },
  { codigo: "ENCARGADO_ENGORDE", nombre: "Encargado de Engorde", descripcion: "Carga y corrige en Engorde.", permisos: encargado("engorde") },
  {
    codigo: "LOGISTICA_STOCK",
    nombre: "Logística y Stock",
    descripcion: "Stock, consumo de alimento y compras (sin aprobar pedidos).",
    permisos: armar(
      enModulo("stock"),
      y(enModulo("alimentacion"), accion("ver", "crear", "editar")),
      y(enModulo("compras"), no(clave("compras.pedidos.aprobar"))),
    ),
  },
  {
    codigo: "ADMINISTRACION_FINANZAS",
    nombre: "Administración",
    descripcion: "Finanzas, ventas, RRHH y compras. No reabre meses, no registra capital ni importa la planilla.",
    permisos: armar(
      y(enModulo("finanzas"), no(clave("finanzas.cierre.reabrir", "finanzas.capital.registrar", "finanzas.importar.ejecutar"))),
      enModulo("ventas", "rrhh", "compras"),
      y(produccion, accion("ver")),
    ),
  },
  {
    codigo: "COMERCIAL",
    nombre: "Comercial",
    descripcion: "Ventas y cobros.",
    permisos: armar(
      y(enModulo("ventas"), no(accion("anular"))),
      recurso("finanzas.cobrar"),
      clave("plantel.animales.ver", "destete.lotes.ver", "engorde.lotes.ver"),
    ),
  },
  {
    codigo: "CONTADOR_EXTERNO",
    nombre: "Contador externo",
    descripcion: "Ve Finanzas y RRHH (sin datos personales) y exporta reportes.",
    permisos: armar(
      y(enModulo("finanzas", "rrhh"), accion("ver"), no(clave("rrhh.datos_personales.ver", "finanzas.caja_bancos.ver_numero"))),
      clave("finanzas.reportes.exportar"),
    ),
  },
  {
    codigo: "OPERARIO",
    nombre: "Operario",
    descripcion: "Ve y carga en los módulos de campo; no corrige, no anula y no ve guaraníes.",
    permisos: armar(
      y(enModulo("gestacion", "maternidad", "destete", "engorde", "sanidad", "alimentacion"), accion("ver", "crear"), p => !p.sensible),
      clave("plantel.animales.ver", "tareas.tareas.ver", "tareas.tareas.completar", "whatsapp.bot.usar"),
    ),
  },
  {
    codigo: "SOLO_LECTURA",
    nombre: "Solo lectura",
    descripcion: "Ve Producción y reportes, sin guaraníes.",
    permisos: armar(y(produccion, accion("ver"))),
  },
  {
    codigo: "VENDEDOR_ADMIN",
    nombre: "Administrador de tienda",
    descripcion: "Todo lo de la tienda, su equipo y sus datos.",
    permisos: armar(enModulo("tienda"), y(enModulo("equipo"), no(clave("equipo.propiedad.transferir"))), recurso("configuracion.organizacion")),
  },
  {
    codigo: "VENDEDOR_ATENCION",
    nombre: "Atención de tienda",
    descripcion: "Pedidos, cotizaciones y reseñas.",
    permisos: armar(recurso("tienda.pedidos"), clave("tienda.cotizaciones.responder", "tienda.resenas.responder")),
  },
];

/** Rol legado (IDs 1-14 de la tabla "roles") → código de plantilla. Orden = prioridad. */
export const ROL_LEGADO_A_PLANTILLA: Array<[number, string]> = [
  [2, "ADMIN_GENERAL"],      // Admin de granja (propietario)
  [1, "ADMIN_GENERAL"],      // Super Admin (además pasa a admin_plataforma)
  [3, "ADMIN_GENERAL"],      // Gerente general
  [5, "JEFE_PRODUCCION"],
  [4, "VETERINARIO"],
  [9, "ADMINISTRACION_FINANZAS"],
  [8, "ADMINISTRACION_FINANZAS"],
  [7, "LOGISTICA_STOCK"],
  [6, "LOGISTICA_STOCK"],    // Encargado de balanceado: el módulo ya no existe
  [10, "ENCARGADO_MATERNIDAD"],
  [11, "ENCARGADO_GESTACION"],
  [12, "ENCARGADO_DESTETE_RECRIA"],
  [13, "OPERARIO"],
  [14, "SOLO_LECTURA"],      // Portal del empleado
];
