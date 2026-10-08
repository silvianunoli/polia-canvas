// CNPJ do perfil, que vai pro cabeçalho do Resumo pro contador. Antes qualquer
// texto era salvo ("123" passou no teste de 08/10/2026, ONE-102).

/** Só os dígitos. */
export function digitosCnpj(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** 14 dígitos com os dois dígitos verificadores certos. */
export function cnpjValido(texto: string): boolean {
  const d = digitosCnpj(texto);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, c, i) => acc + Number(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(d.slice(0, 12));
  const d2 = dv(d.slice(0, 12) + d1);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** "11222333000181" vira "11.222.333/0001-81". Texto que não tem 14 dígitos volta igual. */
export function formatarCnpj(texto: string): string {
  const d = digitosCnpj(texto);
  if (d.length !== 14) return texto;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
