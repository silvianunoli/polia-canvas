// E-mail de entrega do diagnóstico do quiz (/quiz).
//
// Existe pra que a promessa da tela seja verdade: o gate pede o e-mail dizendo
// que o diagnóstico chega por ali, então ele precisa chegar. É UM e-mail, na
// hora, com o mesmo conteúdo da tela de resultado. Não é a sequência de
// nutrição de 3 e-mails, que continua sem provedor decidido (no-go do v1 em
// PRD-quiz.md §1).
//
// Puro de propósito: monta o texto e devolve. Quem envia é
// src/lib/quiz.functions.ts, do lado do servidor. Assim dá pra testar o corpo
// do e-mail sem rede e sem Resend.

import { escapeHtml, emailPolia } from "@/lib/email-template";
import type { Faixa, Territorio } from "./perguntas";

const INSTAGRAM_URL = "https://www.instagram.com/usepolia/";

export interface EmailDiagnostico {
  subject: string;
  text: string;
  html: string;
}

export function montarEmailDiagnostico({
  faixa,
  territorio,
  descadastroUrl,
}: {
  faixa: Faixa;
  territorio: Territorio;
  /** Link de saída de um clique. O consentimento promete "você sai quando
   *  quiser", então ele não é opcional na prática: sem ele, a promessa fica
   *  sem cumprimento. */
  descadastroUrl: string;
}): EmailDiagnostico {
  const ondeLabel = "Onde você está mais no chute:";
  const contaLabel = "A conta pra fazer hoje:";

  const text = [
    faixa.nome,
    "",
    faixa.resumo,
    "",
    `${ondeLabel} ${territorio.nome}`,
    territorio.explicacao,
    "",
    `${contaLabel} ${territorio.conta}`,
    "",
    `Seguir @usepolia: ${INSTAGRAM_URL}`,
    "",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPolia({
    preheader: `${faixa.nome}. ${territorio.nome} é onde as contas ainda não estão à mão.`,
    headline: escapeHtml(faixa.nome),
    paragrafos: [
      escapeHtml(faixa.resumo),
      `<strong>${escapeHtml(ondeLabel)}</strong> ${escapeHtml(territorio.nome)}`,
      escapeHtml(territorio.explicacao),
    ],
    // Mesma caixa pêssego da tela de resultado: quem abre o e-mail reconhece
    // o que acabou de ver.
    destaque: { rotulo: escapeHtml(contaLabel), texto: escapeHtml(territorio.conta) },
    ctaLabel: "Seguir @usepolia",
    ctaUrl: INSTAGRAM_URL,
    descadastroUrl,
  });

  return { subject: `Seu diagnóstico: ${faixa.nome}`, text, html };
}
