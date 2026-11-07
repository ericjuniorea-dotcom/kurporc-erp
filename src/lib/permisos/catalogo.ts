// Catálogo de permisos de organización — Anexo A del documento maestro v2.0.
// Formato de clave: modulo.recurso.accion. Fuente única: lo usan el seed
// (tabla "permiso"), la matriz de Equipo (Fase 7) y los chequeos del servidor.
//
// Sin módulo Balanceado: KurPorc no fabrica balanceado (decisión del 07/11/2026).
// Toda acción que no sea "ver" implica "ver" del mismo recurso (ver `conVer`).

export type PermisoClave = `${string}.${string}.${string}`;

export type GrupoPermiso =
  | "Producción" | "Finanzas" | "Comercial" | "Compras" | "RRHH"
  | "Equipo" | "Configuración" | "Tienda";

export interface PermisoDef {
  clave: PermisoClave;
  modulo: string;
  recurso: string;
  accion: string;
  grupo: GrupoPermiso;
  descripcion: string;
  sensible: boolean;
  soloPropietario: boolean;
  orden: number;
}

const GRUPO_POR_MODULO: Record<string, GrupoPermiso> = {
  plantel: "Producción", gestacion: "Producción", maternidad: "Producción",
  destete: "Producción", engorde: "Producción", sanidad: "Producción",
  alimentacion: "Producción", stock: "Producción", tareas: "Producción",
  reportes: "Producción", whatsapp: "Producción",
  finanzas: "Finanzas",
  ventas: "Comercial",
  compras: "Compras",
  rrhh: "RRHH",
  equipo: "Equipo",
  configuracion: "Configuración",
  tienda: "Tienda",
};

// [recurso base "modulo.recurso", acciones, descripción, flags]
// flags: "S" = sensible en todas las acciones · "S:accion" = sensible solo en esa · "P" = solo propietario
type Fila = [string, string[], string, string?];

const FILAS: Fila[] = [
  // ── A.1 Producción ─────────────────────────────────────────────
  ["plantel.animales", ["ver", "crear", "editar"], "Ficha de los reproductores: ver, dar de alta ingresos y corregir datos"],
  ["plantel.animales", ["dar_baja"], "Registrar descarte, venta o muerte de un reproductor", "S"],
  ["plantel.animales", ["exportar"], "Descargar el listado del plantel"],
  ["plantel.reposicion", ["ver", "crear"], "Nulíparas, cuarentena e ingreso a producción"],
  ["gestacion.servicios", ["ver", "crear", "editar", "anular"], "Servicios e inseminaciones", "S:anular"],
  ["gestacion.diagnosticos", ["ver", "crear", "editar"], "Diagnóstico de preñez, repeticiones y abortos"],
  ["gestacion.lotes_reproductivos", ["ver", "crear", "editar"], "Lotes reproductivos"],
  ["gestacion.bandas", ["ver", "configurar"], "Calendario de bandas y su configuración"],
  ["gestacion.cerdas_paradas", ["ver"], "Cerdas paradas: días y acciones, sin guaraníes"],
  ["maternidad.partos", ["ver", "crear", "editar"], "Partos"],
  ["maternidad.lechones", ["ver", "crear", "editar"], "Adopciones, nodrizas, muertes y pesadas en maternidad"],
  ["maternidad.destetes", ["ver", "crear", "editar"], "Destetes"],
  ["destete.lotes", ["ver", "crear", "editar"], "Lotes de destete y recría"],
  ["destete.eventos", ["crear"], "Mortandad, pesajes y traslados en recría"],
  ["engorde.lotes", ["ver", "crear", "editar"], "Lotes de engorde"],
  ["engorde.lotes", ["cerrar"], "Cerrar un lote de engorde", "S"],
  ["engorde.eventos", ["crear", "editar"], "Ingresos, pesajes, mortandad y traslados en engorde"],
  ["engorde.salidas", ["crear"], "Salidas al frigorífico (también requiere crear ventas)", "S"],
  ["engorde.curvas", ["configurar"], "Curvas de crecimiento y consumo"],
  ["sanidad.aplicaciones", ["ver", "crear", "editar", "anular"], "Vacunaciones y aplicaciones", "S:anular"],
  ["sanidad.protocolos", ["ver", "editar"], "Protocolo sanitario"],
  ["sanidad.tratamientos", ["ver", "crear"], "Tratamientos"],
  ["sanidad.necropsias", ["ver", "crear"], "Necropsias"],
  ["sanidad.carencias", ["liberar"], "Liberar un animal antes de terminar la carencia (con motivo)", "S"],
  ["sanidad.botiquin", ["ver", "contar"], "Stock sanitario y conteos físicos"],
  ["alimentacion.consumos", ["ver", "crear", "editar"], "Registro de balanceado entregado a cada sector y lote"],
  ["alimentacion.etapas", ["configurar"], "Etapas de alimentación y el producto de stock de cada una"],
  ["stock.items", ["ver", "crear", "editar"], "Productos de stock"],
  ["stock.entradas", ["crear"], "Entradas de stock (compras)"],
  ["stock.salidas", ["crear"], "Salidas de stock"],
  ["stock.ajustes", ["crear"], "Ajustes de inventario", "S"],
  ["stock.inventario_fisico", ["crear"], "Conteos físicos mensuales"],
  ["stock.transferencias", ["crear"], "Transferencias de stock entre granjas"],
  ["tareas.tareas", ["ver", "crear", "asignar", "completar"], "Sistema de tareas"],
  ["reportes.produccion", ["ver", "exportar"], "Reportes productivos"],
  ["whatsapp.bot", ["usar"], "Registrar eventos por el bot de WhatsApp (siempre con confirmación SI/NO)"],

  // ── A.2 Finanzas ───────────────────────────────────────────────
  ["finanzas.tablero", ["ver"], "Tablero financiero", "S"],
  ["finanzas.movimientos", ["ver", "crear", "editar"], "Libro de movimientos", "S"],
  ["finanzas.movimientos", ["anular"], "Anular un movimiento con motivo", "S"],
  ["finanzas.pagar", ["ver", "registrar_pago"], "Cuentas por pagar y registro de pagos", "S"],
  ["finanzas.pagar", ["aprobar"], "Aprobar pagos por encima del monto configurado", "S"],
  ["finanzas.cobrar", ["ver", "registrar_cobro"], "Cuentas por cobrar y cobros", "S"],
  ["finanzas.caja_bancos", ["ver", "editar_cuentas", "declarar_saldo"], "Cuentas de caja y bancos, saldos", "S"],
  ["finanzas.caja_bancos", ["ver_numero"], "Ver el número completo de una cuenta bancaria", "S"],
  ["finanzas.balanceado", ["ver", "editar", "marcar_pagado"], "Compras de balanceado a proveedores", "S"],
  ["finanzas.sanidad_valorizada", ["ver"], "Sanidad valorizada", "S"],
  ["finanzas.costos", ["ver"], "Costos de producción y cualquier monto en guaraníes en pantallas productivas", "S"],
  ["finanzas.fijos_variables", ["ver"], "Gastos fijos y variables", "S"],
  ["finanzas.presupuesto", ["ver", "editar", "aprobar"], "Presupuesto", "S"],
  ["finanzas.presupuesto_real", ["ver", "escribir_causa"], "Presupuesto contra real y causas de desvío", "S"],
  ["finanzas.proyeccion", ["ver", "editar_supuestos"], "Proyección de caja", "S"],
  ["finanzas.flujo_caja", ["ver"], "Flujo de caja", "S"],
  ["finanzas.inversiones", ["ver", "crear", "evaluar"], "Inversiones y evaluación de nuevas", "S"],
  ["finanzas.deudas", ["ver", "crear", "editar"], "Préstamos y calendario de cuotas", "S"],
  ["finanzas.capital", ["ver", "registrar"], "Aportes de capital y retiros del titular", "S"],
  ["finanzas.estado", ["ver"], "Estado financiero actual y conciliación", "S"],
  ["finanzas.indicadores", ["ver"], "Indicadores, incluido el retorno de la inversión", "S"],
  ["finanzas.cerdas_paradas", ["ver"], "Cerdas paradas con la plata perdida", "S"],
  ["finanzas.recomendaciones", ["ver", "gestionar"], "Recomendaciones automáticas"],
  ["finanzas.cierre", ["cerrar"], "Cerrar el mes", "S"],
  ["finanzas.cierre", ["reabrir"], "Reabrir un mes cerrado", "S"],
  ["finanzas.parametros", ["ver", "editar"], "Parámetros financieros y metas", "S"],
  ["finanzas.categorias", ["editar"], "Catálogo de categorías", "S"],
  ["finanzas.reportes", ["exportar"], "Exportar cualquier tabla financiera", "S"],
  ["finanzas.importar", ["ejecutar"], "Importar la planilla de Administración y Finanzas", "S"],

  // ── A.3 Comercial ──────────────────────────────────────────────
  ["ventas.ventas", ["ver", "crear", "editar"], "Ventas de lechones, madres, reproductores y cerdos terminados", "S"],
  ["ventas.ventas", ["anular"], "Anular una venta", "S"],
  ["ventas.clientes", ["ver", "crear", "editar"], "Clientes"],
  ["ventas.contratos", ["ver", "editar"], "Contratos de provisión de lechones", "S"],
  ["ventas.precios", ["ver", "editar"], "Precios de referencia y listas", "S"],

  // ── A.4 Compras ────────────────────────────────────────────────
  ["compras.necesidades", ["ver", "configurar"], "\"Lo que te va a faltar\" y sus parámetros"],
  ["compras.cotizaciones", ["ver", "crear"], "Pedir y comparar cotizaciones"],
  ["compras.pedidos", ["ver", "crear", "cancelar"], "Pedidos (con el límite de compra del miembro)"],
  ["compras.pedidos", ["aprobar"], "Aprobar pedidos que superan el límite de otro miembro", "S"],
  ["compras.pedidos", ["recibir"], "Recibir pedidos (entra a Stock y Finanzas)"],
  ["compras.proveedores", ["ver", "editar"], "Proveedores"],

  // ── A.5 RRHH ───────────────────────────────────────────────────
  ["rrhh.funcionarios", ["ver", "crear", "editar"], "Legajo básico: nombre, puesto y fecha de ingreso"],
  ["rrhh.funcionarios", ["dar_baja"], "Dar de baja a un funcionario", "S"],
  ["rrhh.datos_personales", ["ver"], "Cédula, domicilio, cuenta bancaria e IPS", "S"],
  ["rrhh.sueldos", ["ver", "registrar_pago"], "Sueldos y su pago", "S"],
  ["rrhh.asistencia", ["ver", "registrar"], "Asistencia y jornales"],
  ["rrhh.ips", ["ver", "editar"], "Aportes al IPS", "S"],

  // ── A.6 Equipo ─────────────────────────────────────────────────
  ["equipo.miembros", ["ver"], "Ver el equipo"],
  ["equipo.miembros", ["invitar", "crear_gestionada"], "Invitar personas y crear cuentas de operario", "S"],
  ["equipo.miembros", ["suspender", "quitar"], "Suspender o quitar miembros", "S"],
  ["equipo.permisos", ["editar"], "Editar permisos de los miembros", "S"],
  ["equipo.roles", ["editar"], "Editar roles", "S"],
  ["equipo.solicitudes", ["aprobar"], "Aprobar pedidos para unirse", "S"],
  ["equipo.auditoria", ["ver"], "Ver la actividad del equipo", "S"],
  ["equipo.propiedad", ["transferir"], "Transferir la propiedad de la organización", "P"],

  // ── A.7 Configuración ──────────────────────────────────────────
  ["configuracion.organizacion", ["ver", "editar"], "Datos de la organización"],
  ["configuracion.granjas", ["crear", "editar"], "Granjas"],
  ["configuracion.granjas", ["archivar"], "Archivar una granja", "S"],
  ["configuracion.instalaciones", ["editar"], "Galpones, salas y corrales"],
  ["configuracion.unidades", ["editar"], "Unidades de negocio", "S"],
  ["configuracion.parametros_productivos", ["editar"], "Metas productivas, intervalos y curvas"],
  ["configuracion.integraciones", ["editar"], "Bot de WhatsApp y otras integraciones", "S"],
  ["configuracion.accesos_plataforma", ["ver"], "Ver los accesos de la plataforma a la cuenta"],
  ["configuracion.datos", ["exportar"], "Exportar todos los datos de la organización", "S"],
  ["configuracion.seguridad", ["editar"], "Exigir segundo factor y otras reglas de seguridad", "P"],
  ["configuracion.plan", ["gestionar"], "Plan de KurPorc", "P"],
  ["configuracion.organizacion", ["cerrar"], "Cerrar la organización", "P"],

  // ── A.8 Tienda ─────────────────────────────────────────────────
  ["tienda.perfil", ["editar"], "Perfil de la tienda"],
  ["tienda.publicaciones", ["ver", "crear", "editar", "pausar"], "Publicaciones"],
  ["tienda.precios", ["editar"], "Precios", "S"],
  ["tienda.pedidos", ["ver", "confirmar", "rechazar", "despachar"], "Pedidos recibidos"],
  ["tienda.cotizaciones", ["responder"], "Responder cotizaciones", "S"],
  ["tienda.resenas", ["responder"], "Responder reseñas"],
  ["tienda.estadisticas", ["ver"], "Estadísticas de la tienda", "S"],
];

function construir(): PermisoDef[] {
  const out: PermisoDef[] = [];
  let orden = 0;
  for (const [base, acciones, descripcion, flags = ""] of FILAS) {
    const [modulo, recurso] = base.split(".");
    const flagList = flags.split(",").map(f => f.trim()).filter(Boolean);
    for (const accion of acciones) {
      const sensible = flagList.includes("S") || flagList.includes(`S:${accion}`);
      out.push({
        clave: `${modulo}.${recurso}.${accion}`,
        modulo, recurso, accion,
        grupo: GRUPO_POR_MODULO[modulo],
        descripcion: acciones.length > 1 ? `${descripcion} — ${accion.replace(/_/g, " ")}` : descripcion,
        sensible,
        soloPropietario: flagList.includes("P"),
        orden: orden++,
      });
    }
  }
  return out;
}

export const CATALOGO_PERMISOS: readonly PermisoDef[] = construir();

export const CLAVES_PERMISOS = new Set<string>(CATALOGO_PERMISOS.map(p => p.clave));

/** Agrega `modulo.recurso.ver` por cada acción otorgada (si existe en el catálogo). */
export function conVer(claves: Iterable<string>): Set<string> {
  const out = new Set<string>(claves);
  for (const c of Array.from(out)) {
    const [m, r] = c.split(".");
    const ver = `${m}.${r}.ver`;
    if (CLAVES_PERMISOS.has(ver)) out.add(ver);
  }
  return out;
}
