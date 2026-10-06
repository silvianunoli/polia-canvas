/** "R$ 29,90" para mensalidade e "R$ 299" para valor inteiro, como na copy. */
export function precoBR(valor: number): string {
  const inteiro = Number.isInteger(valor);
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
