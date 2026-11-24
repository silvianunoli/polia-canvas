// Preço promocional (24/11/2026, ONE-239, pedido da Sil: "o preço de venda deve
// ser o DE" e o promocional, o POR, vale "em todo o sistema"). Quando preenchido
// e menor que o preço de venda, ele é o preço que vale: a Vitrine online e a Loja
// da marca cobram ele, o Novo pedido e a Nova venda já vêm com ele, e o lucro
// de Produtos é calculado com ele. Igual ou maior que o preço de venda, ou
// vazio, não vale e tudo segue no preço de venda.
//
// O banco repete a regra em public.preco_que_vale(produtos) (migration
// 20261124080000): quem cobra o pedido é o banco, nunca o navegador.

type Numero = number | string | null | undefined;

const valor = (v: Numero): number => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** O promocional, quando vale (maior que zero e menor que o preço de venda); senão null. */
export function promocionalQueVale(precoVenda: Numero, precoPromocional: Numero): number | null {
  const venda = valor(precoVenda);
  const promo = valor(precoPromocional);
  if (!(promo > 0) || !(venda > 0) || !(promo < venda)) return null;
  return Math.round(promo * 100) / 100;
}

/** O preço que a cliente paga: o promocional quando vale, senão o preço de venda. */
export function precoQueVale(precoVenda: Numero, precoPromocional: Numero): number {
  const promo = promocionalQueVale(precoVenda, precoPromocional);
  if (promo != null) return promo;
  const venda = valor(precoVenda);
  return Number.isFinite(venda) ? venda : 0;
}
