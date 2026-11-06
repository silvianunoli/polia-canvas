// Preço honrado (decisão da Sil em 06/11/2026: "Honrar todas as contas").
//
// Os e-mails do fim do teste prometeram R$ 29,90 no Premium e R$ 47,90 no Pro pra
// quem assinasse até 30/11, e a virada de preços veio antes disso. Quem recebeu
// a promessa está em `precos_honrados` e, logada, vê e paga o preço antigo até o
// prazo. Nenhuma tela explica o porquê nem cita a data (decisão de 03/11).
//
// Desconto não entra aqui de propósito: é o Price antigo do Stripe, que continua
// ativo. Assinatura existente segue no Price em que nasceu.

import {
  tiersPagos,
  tiersPagosDeFundadora,
  type InfoTierPago,
  type TierPago,
} from "@/lib/planos";

/** Fim do prazo, horário de Brasília. */
export const PRAZO_FUNDADORA = "2026-11-30T23:59:59-03:00";

const PRAZO_MS = Date.parse(PRAZO_FUNDADORA);

export function dentroDoPrazoFundadora(agora: number = Date.now()): boolean {
  return agora <= PRAZO_MS;
}

/**
 * Preço e lista que a conta vê: a lista é sempre a de hoje, e só o preço volta
 * ao antigo. Os quatro recursos que desceram pro Premium valem pra ela também.
 */
export function tiersPagosDaConta(
  temPrecoHonrado: boolean,
  agora: number = Date.now(),
): Record<TierPago, InfoTierPago> {
  const hoje = tiersPagos(agora);
  if (!temPrecoHonrado || !dentroDoPrazoFundadora(agora)) return hoje;
  const antigo = tiersPagosDeFundadora();
  return {
    controle: {
      ...hoje.controle,
      precoMensal: antigo.controle.precoMensal,
      precoAnual: antigo.controle.precoAnual,
    },
    projete: {
      ...hoje.projete,
      precoMensal: antigo.projete.precoMensal,
      precoAnual: antigo.projete.precoAnual,
    },
  };
}
