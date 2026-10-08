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
// Mesmo destino do botão da tela de resultado (src/routes/quiz.index.tsx), com
// a origem marcada pra o cadastro saber que veio do quiz.
export const CADASTRO_QUIZ_URL = "https://one.usepolia.com.br/auth/cadastro?origem=quiz";
export const CTA_CADASTRO_QUIZ = "Quero começar grátis";

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
  // Título fixo, abertura por faixa (08/10/2026). A abertura fixa de 16/09
  // elogiava ("você já resolveu boa parte das decisões...") até quem caiu em
  // "No chute total", e o assunto dizia "quase pronto" com o diagnóstico já no
  // corpo. Agora a abertura é a mesma da tela de resultado: o nome da faixa e o
  // resumo dela, que constatam sem humilhar (PRD §5).
  const TITULO = "Seu diagnóstico";
  const resultadoLabel = "Seu resultado:";
  const ondeLabel = "No seu caso, esse é o ponto que apareceu no diagnóstico:";
  const contaLabel = "O que fazer agora";
  const ponte =
    "A Pólia One organiza a marca, o preço e a meta do mês num lugar só, a partir do Planejamento. O plano Grátis abre sem cartão.";
  const instagramTexto = "Mais conta de preço e de marca no Instagram:";

  const text = [
    TITULO,
    "",
    `${resultadoLabel} ${faixa.nome}`,
    faixa.resumo,
    "",
    `${ondeLabel} ${territorio.nome}`,
    territorio.explicacao,
    "",
    contaLabel,
    territorio.conta,
    "",
    ponte,
    `${CTA_CADASTRO_QUIZ}: ${CADASTRO_QUIZ_URL}`,
    "",
    `${instagramTexto} Seguir @hub.polia: ${INSTAGRAM_URL}`,
    "",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPolia({
    preheader: escapeHtml(`${faixa.nome}. O ponto pra olhar primeiro: ${territorio.nome}.`),
    headline: escapeHtml(TITULO),
    paragrafos: [
      `<strong>${escapeHtml(resultadoLabel)}</strong> ${escapeHtml(faixa.nome)}`,
      escapeHtml(faixa.resumo),
      `<strong>${escapeHtml(ondeLabel)}</strong> ${escapeHtml(territorio.nome)}`,
      escapeHtml(territorio.explicacao),
      // A casca só tem um botão e ele vem depois da caixa pêssego, então o
      // Instagram entra como link de texto antes dela.
      `${escapeHtml(instagramTexto)} <a href="${INSTAGRAM_URL}" style="color:#0A0A0A;text-decoration:underline;">Seguir @hub.polia</a>`,
      escapeHtml(ponte),
    ],
    // Mesma caixa pêssego da tela de resultado: quem abre o e-mail reconhece
    // o que acabou de ver.
    destaque: { rotulo: escapeHtml(contaLabel), texto: escapeHtml(territorio.conta) },
    ctaLabel: CTA_CADASTRO_QUIZ,
    ctaUrl: CADASTRO_QUIZ_URL,
    descadastroUrl,
  });

  return { subject: TITULO, text, html };
}
