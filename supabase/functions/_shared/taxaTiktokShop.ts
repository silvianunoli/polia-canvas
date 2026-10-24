// Tarifa do TikTok Shop Brasil (VND-05). Puro e sem import: roda no Worker (via
// caminho relativo) e nas edge functions (Deno).
//
// O TikTok cobra por item, e a faixa depende do preço do item depois do desconto
// da vendedora (desconto bancado pela plataforma não conta). Tabela vigente desde
// 15/07/2026, lida na guia oficial do vendedor ("Guia 2026: comissões e taxas do
// TikTok Shop explicadas"). Quando o TikTok mudar, muda aqui e vale para todo mundo.
//
// Programa de Frete Grátis: quem participa paga mais 6% do preço do item, com
// teto de R$ 50 por item. A vendedora diz se participa no modal de taxas.

export const TABELA_TIKTOK_BR = {
  vigenteDesde: "2026-07-15",
  /** Preço do item, em reais, a partir do qual vale a faixa de cima. */
  limiteFaixa: 50,
  abaixo: { percentual: 10, fixoPorItem: 4 },
  acima: { percentual: 6, fixoPorItem: 6 },
  freteGratis: { percentual: 6, tetoPorItem: 50 },
} as const;

const emCentavos = (reais: number) => Math.round(reais * 100);

/** Taxa de UMA unidade a esse preço, em centavos, nunca maior que o preço. */
function taxaDaUnidadeEmCentavos(preco: number, freteGratis: boolean): number {
  const precoCents = emCentavos(preco);
  if (!(precoCents > 0)) return 0;
  const t = TABELA_TIKTOK_BR;
  const faixa = precoCents < emCentavos(t.limiteFaixa) ? t.abaixo : t.acima;
  let taxa =
    Math.round((precoCents * Math.round(faixa.percentual * 100)) / 10_000) +
    emCentavos(faixa.fixoPorItem);
  if (freteGratis)
    taxa += Math.min(
      Math.round((precoCents * Math.round(t.freteGratis.percentual * 100)) / 10_000),
      emCentavos(t.freteGratis.tetoPorItem),
    );
  return Math.min(taxa, precoCents);
}

/** Taxa de uma unidade vendida a esse preço, em reais. */
export function taxaTiktokDoItem(preco: number, opcoes: { freteGratis?: boolean } = {}): number {
  return taxaDaUnidadeEmCentavos(preco, !!opcoes.freteGratis) / 100;
}

/**
 * Taxa estimada de um pedido: soma por unidade, cada uma na faixa do próprio
 * preço. Item sem preço ou sem quantidade não cobra nada.
 */
export function taxaTiktokDaVenda(
  itens: ReadonlyArray<{ preco_unitario: number; quantidade: number }>,
  opcoes: { freteGratis?: boolean } = {},
): number {
  let total = 0;
  for (const i of itens) {
    const qtd = Math.max(0, Math.floor(i.quantidade));
    total += qtd * taxaDaUnidadeEmCentavos(i.preco_unitario, !!opcoes.freteGratis);
  }
  return total / 100;
}

/** "10% + R$ 4 por item abaixo de R$ 50; 6% + R$ 6 a partir de R$ 50" (+ Frete Grátis). */
export function descreverTabelaTiktok(freteGratis = false): string {
  const t = TABELA_TIKTOK_BR;
  const base = `${t.abaixo.percentual}% + R$ ${t.abaixo.fixoPorItem} por item abaixo de R$ ${t.limiteFaixa}; ${t.acima.percentual}% + R$ ${t.acima.fixoPorItem} a partir de R$ ${t.limiteFaixa}`;
  return freteGratis ? `${base}; mais ${t.freteGratis.percentual}% do Frete Grátis` : base;
}
