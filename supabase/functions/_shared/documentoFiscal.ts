// CPF/CNPJ da cliente pra nota fiscal (PAY-32, 12/10/2026). Sem import de
// runtime: roda no navegador (campo do /assinar), na server function que grava
// o documento no Stripe e no stripe-webhook que monta a nota.

export type TipoDocumento = "cpf" | "cnpj";

export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

function todosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || todosIguais(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || todosIguais(d)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/** "cpf", "cnpj" ou null quando o número não fecha os dígitos verificadores. */
export function tipoDocumento(valor: string): TipoDocumento | null {
  const d = soDigitos(valor);
  if (d.length === 11) return cpfValido(d) ? "cpf" : null;
  if (d.length === 14) return cnpjValido(d) ? "cnpj" : null;
  return null;
}

/** Máscara de digitação: 000.000.000-00 até 11 dígitos, 00.000.000/0000-00 acima. */
export function formatarDocumento(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
