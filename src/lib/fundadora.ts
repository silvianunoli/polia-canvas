// Preço de fundadora (GRW-66, aprovado pela Sil em 20/10/2026).
//
// Quem assina até o prazo, dentro das primeiras VAGAS assinaturas pagas, fica
// com o preço de hoje enquanto a assinatura estiver ativa. No Stripe isso já é
// verdade sozinho: assinatura existente continua no Price em que nasceu quando
// um Price novo é criado. A assinatura sai com metadata.fundadora = "sim" pra
// ninguém precisar adivinhar depois quem tem o preço travado.
//
// Desconto não entra aqui de propósito: o que a oferta dá é o preço de hoje
// travado, sem baratear o plano.

import { VIRADA_PRECOS, tiersPagos, tiersPagosDeFundadora } from "@/lib/planos";

/** Fim do prazo, horário de Brasília. Trocar aqui muda a tela e o checkout juntos. */
export const PRAZO_FUNDADORA = "2026-11-30T23:59:59-03:00";
export const VAGAS_FUNDADORA = 50;

const PRAZO_MS = Date.parse(PRAZO_FUNDADORA);

export function vagasRestantes(assinaturasPagas: number): number {
  return Math.max(0, VAGAS_FUNDADORA - Math.max(0, assinaturasPagas));
}

/** Só o prazo (o checkout marca a assinatura por ele; as vagas a tela controla). */
export function dentroDoPrazoFundadora(agora: number = Date.now()): boolean {
  return agora <= PRAZO_MS;
}

export function ofertaFundadoraAtiva(
  assinaturasPagas: number,
  agora: number = Date.now(),
): boolean {
  return agora <= PRAZO_MS && vagasRestantes(assinaturasPagas) > 0;
}

/** "30/11", no fuso de Brasília. */
export function prazoCurto(): string {
  return new Date(PRAZO_MS).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** "01/12", no fuso de Brasília: o dia em que os preços novos valem. */
function diaDaVirada(): string {
  return new Date(Date.parse(VIRADA_PRECOS)).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface TextoFundadora {
  rotulo: string;
  texto: string;
  vagas: string;
}

export function textoFundadora(
  assinaturasPagas: number,
  agora: number = Date.now(),
): TextoFundadora | null {
  if (!ofertaFundadoraAtiva(assinaturasPagas, agora)) return null;
  const restam = vagasRestantes(assinaturasPagas);
  // O preço travado é sempre o de antes da virada (src/lib/planos.ts).
  const hoje = tiersPagosDeFundadora();
  const depois = tiersPagos(Date.parse(VIRADA_PRECOS));
  return {
    rotulo: "Preço de fundadora",
    texto: `Quem assina até ${prazoCurto()} fica com ${reais(hoje.controle.precoMensal)} no Premium e ${reais(hoje.projete.precoMensal)} no Pro enquanto a assinatura estiver ativa. A partir de ${diaDaVirada()}, o Premium passa a ${reais(depois.controle.precoMensal)} e o Pro a ${reais(depois.projete.precoMensal)}.`,
    vagas: restam === 1 ? "Resta 1 vaga." : `Restam ${restam} das ${VAGAS_FUNDADORA} vagas.`,
  };
}
