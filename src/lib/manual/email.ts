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
// fora. A copy também é dela, com quatro ajustes de forma que a régua da marca
// não deixa passar (sem travessão, sem exclamação, sem símbolo no assunto, e
// "você" nunca como sujeito de promessa). Registro tipográfico em "para", não
// "pra": ela pediu o tom mais editorial aqui, diferente do site.
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
  const preheader = "Seu primeiro passo para começar a construir uma marca maior.";
  const paragrafos = [
    "Olá. Preparamos este material para ajudar você a olhar para o seu negócio de uma maneira diferente: não apenas como algo que você vende, mas como uma marca que está construindo.",
    "Dentro dele, você vai encontrar 17 seções práticas, exercícios para preencher e um plano de 7 dias para colocar suas ideias em movimento.",
    "Porque uma marca grande não precisa esperar a empresa crescer para começar.",
  ];
  const citacao = ["Grandes marcas não começam grandes.", "Começam com intenção."];
  const fechamento = "Boa leitura, e boa construção.";

  const text = [
    headline,
    "",
    ...paragrafos.flatMap((t) => [t, ""]),
    citacao.join("\n"),
    "",
    `${CTA_EMAIL_MANUAL}: ${downloadUrl}`,
    "",
    fechamento,
    "",
    "Pólia",
    TAGLINE_MANUAL,
    "",
    "Pólia · usepolia.com.br",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPoliaEditorial({
    preheader: escapeHtml(preheader),
    rotulo: "Pólia · Material gratuito",
    headline: escapeHtml(headline),
    paragrafos: paragrafos.map(escapeHtml),
    citacao: citacao.map(escapeHtml),
    ctaLabel: CTA_EMAIL_MANUAL,
    ctaUrl: downloadUrl,
    fechamento: [escapeHtml(fechamento)],
    assinatura: { nome: "Pólia", tagline: TAGLINE_MANUAL },
    descadastroUrl,
  });

  return { subject: `Seu ${NOME_MANUAL_CURTO} chegou`, text, html };
}
