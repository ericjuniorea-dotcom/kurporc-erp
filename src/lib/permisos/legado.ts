// Puente transitorio (Fase 7): varias pantallas todavía preguntan por los 14 roles
// legados (session.user.roles). Para que una persona invitada con permisos nuevos
// vea lo mismo que vería con el rol equivalente, se derivan esos roles de sus permisos.
// La seguridad NO depende de esto: las APIs verifican el permiso real (permisoApi).
// Se elimina cuando no quede ningún chequeo de roles en las pantallas.

export function rolesLegadosDesdePermisos(claves: Set<string> | string[], esPropietario: boolean): number[] {
  const p = claves instanceof Set ? claves : new Set(claves);
  const tiene = (c: string) => p.has(c);
  const roles = new Set<number>();
  if (esPropietario || tiene("equipo.permisos.editar")) roles.add(2);                         // Admin de granja
  if (tiene("sanidad.carencias.liberar") || tiene("sanidad.protocolos.editar")) roles.add(4);  // Veterinario
  if (tiene("gestacion.servicios.editar") && tiene("maternidad.partos.editar")) roles.add(5);  // Jefe de producción
  if (tiene("stock.items.editar")) roles.add(7);                                              // Logística
  if (tiene("rrhh.funcionarios.editar")) roles.add(8);                                        // RRHH
  if (tiene("finanzas.tablero.ver")) roles.add(9);                                            // Contador / Finanzas
  if (tiene("maternidad.partos.crear")) roles.add(10);                                        // Maternidad
  if (tiene("gestacion.servicios.crear")) roles.add(11);                                      // Gestación
  if (tiene("destete.lotes.crear")) roles.add(12);                                            // Recría
  if (roles.size === 0 && Array.from(p).some(c => c.endsWith(".crear"))) roles.add(13);       // Operario
  return Array.from(roles);
}
