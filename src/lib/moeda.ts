/**
 * Formatação de dinheiro em pt-BR para o texto que vai para a IA.
 *
 * Existe porque `montarPromptRaioX` e `montarPromptAimer` interpolavam
 * `valor.toFixed(2)`, que produz "8780.00" — formato americano. O modelo copia
 * o que recebe, e o Raio-x saía na tela dizendo "R$ 8780.00 de entrada".
 * O número errado não vinha de um componente: vinha do prompt.
 *
 * Separado do formatador de UI de propósito: aqui não pode entrar o espaço não
 * separável (U+00A0) que `toLocaleString(..., { style: "currency" })` insere
 * depois do "R$" — o modelo reproduz esse caractere e ele vaza para a tela.
 */
export function moedaParaPrompt(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
