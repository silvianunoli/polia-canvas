/**
 * Posição dos rótulos da régua "Onde o mês está agora" (Financeiro).
 *
 * O ponto X% do rótulo fica sobre o ponto X% do trilho: `left: X%` anda pela
 * largura do trilho e `translateX(-X%)` volta pela largura do próprio rótulo.
 * Assim o rótulo nunca sai do trilho, seja qual for a tela ou o tamanho do
 * valor, e o ponto da régua fica sempre embaixo do texto.
 *
 * Substitui o corte fixo (ONE-16: abaixo de 8% alinha à esquerda, acima de 92%
 * à direita, no meio centraliza), que só valia em tela larga. Em 402 px o selo
 * ocupa mais da metade do trilho, e R$ 990 de R$ 8.000 (12%) centralizado saía
 * do cartão (ONE-171).
 */

export interface MarcaDaRegua {
  chave: string;
  rotulo: string;
  detalhe: string;
  num: number;
}

export function pctDaMeta(entradas: number, metaAlvo: number): number {
  return metaAlvo > 0 ? Math.min((entradas / metaAlvo) * 100, 100) : 0;
}

/** A marca para em 99% pra linha dela não encostar na borda do trilho. */
export function pctDaMarca(num: number, metaAlvo: number): number {
  return Math.min(99, (num / metaAlvo) * 100);
}

export function estiloNaRegua(pct: number): { left: string; transform: string } {
  const p = Math.max(0, Math.min(100, pct));
  return { left: `${p}%`, transform: `translateX(-${p}%)` };
}
