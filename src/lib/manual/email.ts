// E-mail de entrega do manual (/manual).
//
// Existe por dois motivos. O primeiro é a promessa da tela: o gate diz que o
// PDF chega no e-mail, então ele precisa chegar. O segundo é prático: o
// download automático da landing depende do navegador do celular cooperar, e
// nem todo webview coopera. O e-mail é a cópia que fica guardada.
//
// Layout: a variante EDITORIAL da casca (emailPoliaEditorial), não a
// transacional. Decisão da fundadora em 14/09/2026: esta peça tem que parecer
// uma página do próprio manual, com o amarelo como único destaque e o turquesa
// fora. Copy final revisada em 16/09/2026 (revisão dos 12 transacionais):
// "pra" em vez de "para" -- alinhado ao resto da marca, não é mais um
// registro editorial à parte -- citação/tagline de campanha ("Grandes marcas
// não começam grandes...") saiu, o e-mail entrega o material e cria ponte
// pra Pólia sem soar a peça de propaganda.
//
// Puro de propósito: monta o texto e devolve. Quem envia é
// src/lib/manual.functions.ts, do lado do servidor. Assim dá pra testar o corpo
// sem rede e sem Resend.

import { escapeHtml, emailPoliaEditorial } from "@/lib/email-template";
import { NOME_MANUAL_CURTO } from "./conteudo";

export interface EmailManual {
  subject: string;
  text: string;
  html: string;
}

export const CTA_EMAIL_MANUAL = "Baixar meu manual";
export const TAGLINE_MANUAL = "Pequenas marcas. Grandes sonhos.";

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
  const headline = `Seu ${NOME_MANUAL_CURTO} chegou.`;
  const preheader = "17 seções práticas pra colocar sua marca no lugar.";
  const paragrafos = [
    "O manual chegou.",
    "São 17 seções práticas, exercícios pra preencher e um plano de 7 dias pra tirar as ideias da cabeça e colocar no negócio.",
    "Começa pela marca, mas não fica só nela.",
    "A ideia é deixar mais claro o que você vende, pra quem, por que vale e o que precisa acontecer depois.",
  ];
  const fechamento = "Boa leitura, e boa construção.";

  const text = [
    headline,
    "",
    ...paragrafos.flatMap((t) => [t, ""]),
    `${CTA_EMAIL_MANUAL}: ${downloadUrl}`,
    "",
    fechamento,
    "Pólia One",
    "",
    "Pólia One",
    TAGLINE_MANUAL,
    "Alguma dúvida? Fale com a gente: https://usepolia.com.br/ajuda",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPoliaEditorial({
    preheader: escapeHtml(preheader),
    rotulo: "Pólia One · Material gratuito",
    headline: escapeHtml(headline),
    paragrafos: paragrafos.map(escapeHtml),
    ctaLabel: CTA_EMAIL_MANUAL,
    ctaUrl: downloadUrl,
    fechamento: [escapeHtml(fechamento)],
    assinatura: { nome: "Pólia One" },
    descadastroUrl,
  });

  return { subject: `Seu ${NOME_MANUAL_CURTO} chegou`, text, html };
}
