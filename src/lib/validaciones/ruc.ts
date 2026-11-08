// RUC de Paraguay: número de 5 a 8 dígitos, guion y dígito verificador (módulo 11 de la SET).

export function digitoVerificadorRuc(numero: string): number {
  let suma = 0;
  let k = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * k;
    k = k === 11 ? 2 : k + 1;
  }
  const resto = suma % 11;
  return resto > 1 ? 11 - resto : 0;
}

/** Devuelve el RUC normalizado ("4799016-3") o null si no es válido. */
export function normalizarRuc(texto: string): string | null {
  const limpio = texto.replace(/[\s.]/g, "");
  const m = /^(\d{5,8})-(\d)$/.exec(limpio);
  if (!m) return null;
  return digitoVerificadorRuc(m[1]) === Number(m[2]) ? `${m[1]}-${m[2]}` : null;
}
