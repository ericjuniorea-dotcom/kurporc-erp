// Cuenta de plataforma: Super Administrador con correo @kurporc.com (admin@kurporc.com).
// Solo esas cuentas quedan limitadas al panel (/admin) y ven una granja solo con «Ver ERP».
// Un cliente dueño de granja nunca queda encerrado en el panel, aunque tenga un rol de plataforma por error.
export const DOMINIO_PLATAFORMA = "@kurporc.com";

export function esCuentaDePlataforma(u: { esSuperadmin: boolean; email: string }): boolean {
  return u.esSuperadmin && u.email.trim().toLowerCase().endsWith(DOMINIO_PLATAFORMA);
}
