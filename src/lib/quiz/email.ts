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

const INSTAGRAM_URL = "https://www.instagram.com/hub.polia/";

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
  // Título e abertura fixos (revisão de copy de 16/09/2026, segunda passada):
  // o título deixou de variar por faixa -- uma frase calma serve pras 24
  // combinações sem precisar de um título chamativo pra cada uma. `faixa`
  // segue recebido (é o que decide o território fraco lá em quiz.functions.ts)
  // mas não entra mais na copy do e-mail.
  const TITULO = "Seu diagnóstico está quase pronto";
  const aberturaL1 = "Você já resolveu boa parte das decisões importantes do negócio com números.";
  const aberturaL2 =
    "Mas tem uma coisa que ainda precisa ficar mais clara: o que sua marca faz e por que alguém deveria escolher você.";
  const ondeLabel = "No seu caso, esse é o ponto que apareceu no diagnóstico:";
  const contaLabel = "O que fazer agora";

  const text = [
    TITULO,
    "",
    aberturaL1,
    aberturaL2,
    "",
    `${ondeLabel} ${territorio.nome}`,
    territorio.explicacao,
    "",
    contaLabel,
    territorio.conta,
    "",
    `Seguir @hub.polia: ${INSTAGRAM_URL}`,
    "",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPolia({
    preheader: `Uma coisa já ficou clara. Agora falta fechar ${territorio.nome}.`,
    headline: escapeHtml(TITULO),
    paragrafos: [
      escapeHtml(aberturaL1),
      escapeHtml(aberturaL2),
      `<strong>${escapeHtml(ondeLabel)}</strong> ${escapeHtml(territorio.nome)}`,
      escapeHtml(territorio.explicacao),
    ],
    // Mesma caixa pêssego da tela de resultado: quem abre o e-mail reconhece
    // o que acabou de ver.
    destaque: { rotulo: escapeHtml(contaLabel), texto: escapeHtml(territorio.conta) },
    ctaLabel: "Seguir @hub.polia",
    ctaUrl: INSTAGRAM_URL,
    descadastroUrl,
  });

  return { subject: TITULO, text, html };
}
