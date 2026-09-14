// E-mail de entrega do manual (/manual).
//
// Existe por dois motivos. O primeiro é a promessa da tela: o gate diz que o
// PDF chega no e-mail, então ele precisa chegar. O segundo é prático: o
// download automático da landing depende do navegador do celular cooperar, e
// nem todo webview coopera. O e-mail é a cópia que fica guardada.
//
// Puro de propósito: monta o texto e devolve. Quem envia é
// src/lib/manual.functions.ts, do lado do servidor. Assim dá pra testar o corpo
// sem rede e sem Resend.

import { escapeHtml, emailPolia } from "@/lib/email-template";
import { NOME_MANUAL, NOME_MANUAL_CURTO } from "./conteudo";

export interface EmailManual {
  subject: string;
  text: string;
  html: string;
}

export function montarEmailManual({
  downloadUrl,
  descadastroUrl,
}: {
  /** Link com o token de download (ver src/lib/manual/download.ts). */
  downloadUrl: string;
  /** Saída de um clique. O consentimento promete "você sai quando quiser",
   *  então o link não é opcional: sem ele a promessa fica sem cumprimento. */
  descadastroUrl: string;
}): EmailManual {
  const abertura = `Oi. ${NOME_MANUAL} está no botão abaixo, em PDF: 17 seções com exercícios pra preencher e um plano de 7 dias pra colocar em prática.`;
  const ideia =
    "Marca grande não espera a empresa crescer. Ela nasce de decisões pequenas, repetidas com intenção. É disso que o manual trata.";
  const despedida = "Boa leitura, e boa construção.";

  const text = [
    abertura,
    "",
    ideia,
    "",
    `Baixar o manual: ${downloadUrl}`,
    "",
    despedida,
    "Pólia",
    "",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPolia({
    preheader: "17 seções, exercícios e um plano de 7 dias. O PDF está no botão.",
    headline: "O manual chegou",
    paragrafos: [escapeHtml(abertura), escapeHtml(ideia), `${escapeHtml(despedida)}<br />Pólia`],
    ctaLabel: "Baixar o manual",
    ctaUrl: downloadUrl,
    descadastroUrl,
  });

  return { subject: `Seu ${NOME_MANUAL_CURTO} chegou`, text, html };
}
