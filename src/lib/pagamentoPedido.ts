// Pagamento no pedido (23/11/2026, pedido da Sil, desenho aprovado). Puro: a
// escrita é das RPCs registrar_pedido e definir_pagamento_pedido (migration
// 20261124020000); a tela é components/pedidos.
//
// Marketplace (Shopee, TikTok Shop, Mercado Livre) paga a dona pelo próprio
// marketplace: a "forma" é o nome dele e a taxa é a dele. Loja da marca chega
// pronta do Mercado Pago. O resto (encomenda, redes, Vitrine online) escolhe a
// forma, e a taxa vem da regra dessa forma nas taxas de recebimento.

import { CANAL_LABEL, type CanalVenda } from "@/lib/vendas";
import {
  FORMAS_RECEBIMENTO,
  ROTULO_TAXA,
  type ChaveTaxa,
  type FormaRecebimento,
} from "@/lib/taxas";

/** Ordem do campo "Onde vendeu": o de sempre primeiro, marketplaces no fim. */
export const CANAIS_DO_PEDIDO: readonly CanalVenda[] = [
  "encomenda",
  "instagram",
  "whatsapp",
  "presencial",
  "catalogo",
  "site",
  "shopee",
  "tiktok_shop",
  "mercado_livre",
  "outro",
];

const MARKETPLACES: readonly CanalVenda[] = ["shopee", "tiktok_shop", "mercado_livre"];

export function ehMarketplace(canal: string): boolean {
  return (MARKETPLACES as readonly string[]).includes(canal);
}

/** Pedido da loja da marca e de marketplace chega com o pagamento pronto do canal. */
export function pagamentoVemDoCanal(canal: string): boolean {
  return canal === "site" || ehMarketplace(canal);
}

/** Qual regra das taxas de recebimento preenche a taxa: a do marketplace ou a da forma. */
export function chaveDaTaxa(canal: string, forma: FormaRecebimento | ""): ChaveTaxa | null {
  if (ehMarketplace(canal)) return canal as ChaveTaxa;
  return forma || null;
}

export function ehFormaDeRecebimento(forma: string | null | undefined): forma is FormaRecebimento {
  return (FORMAS_RECEBIMENTO as readonly string[]).includes(forma ?? "");
}

/** Nome do campo da taxa: "Taxa da Shopee", "Taxa do Mercado Pago", "Taxa". */
export function rotuloDaTaxa(canal: string): string {
  if (canal === "shopee") return "Taxa da Shopee";
  if (canal === "tiktok_shop") return "Taxa do TikTok Shop";
  if (canal === "mercado_livre") return "Taxa do Mercado Livre";
  if (canal === "site") return "Taxa do Mercado Pago";
  return "Taxa";
}

/**
 * Como o pagamento aparece no pedido: o marketplace pelo nome, a loja da
 * marca com "(Mercado Pago)", e "A definir" quando ninguém escolheu ainda.
 */
export function rotuloDoPagamento(canal: string, forma: string | null | undefined): string {
  if (ehMarketplace(canal)) return CANAL_LABEL[canal as CanalVenda];
  const nome = ehFormaDeRecebimento(forma) ? ROTULO_TAXA[forma] : null;
  if (canal === "site") return nome ? `${nome} (Mercado Pago)` : "Mercado Pago";
  return nome ?? "A definir";
}

/** O que sobra do pedido depois da taxa, nunca negativo. */
export function liquidoDoPedido(total: number, taxa: number): number {
  return Math.max(Math.round((total - taxa) * 100) / 100, 0);
}
