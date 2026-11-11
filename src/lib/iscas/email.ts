// E-mail de entrega das iscas de /materiais/<slug>. Mesmo papel do e-mail do
// manual (src/lib/manual/email.ts): é a cópia que fica guardada, já que o
// download automático da tela depende do navegador do celular cooperar (e o
// navegador interno do Instagram nem sempre coopera).
//
// Puro de propósito: monta o texto a partir do catálogo e devolve. Quem envia
// é src/lib/iscas.functions.ts.

import { escapeHtml, emailPoliaEditorial } from "@/lib/email-template";
import type { Isca } from "./catalogo";

export interface EmailIscaMontado {
  subject: string;
  text: string;
  html: string;
}

export const TAGLINE_ISCA = "Pequenas marcas. Grandes sonhos.";

export function montarEmailIsca({
  isca,
  downloadUrl,
  descadastroUrl,
}: {
  isca: Isca;
  downloadUrl: string;
  /** O consentimento promete "você sai quando quiser": o link não é opcional. */
  descadastroUrl: string;
}): EmailIscaMontado {
  const { email } = isca;

  const text = [
    email.headline,
    "",
    ...email.paragrafos.flatMap((t) => [t, ""]),
    `${email.cta}: ${downloadUrl}`,
    "",
    email.fechamento,
    "Pólia One",
    "",
    TAGLINE_ISCA,
    "Alguma dúvida? A Ajuda da Pólia responde: https://one.usepolia.com.br/ajuda",
    `Não quero mais receber: ${descadastroUrl}`,
  ].join("\n");

  const html = emailPoliaEditorial({
    preheader: escapeHtml(email.preheader),
    rotulo: "Pólia One · Material gratuito",
    headline: escapeHtml(email.headline),
    paragrafos: email.paragrafos.map(escapeHtml),
    ctaLabel: email.cta,
    ctaUrl: downloadUrl,
    fechamento: [escapeHtml(email.fechamento)],
    assinatura: { nome: "Pólia One" },
    descadastroUrl,
  });

  return { subject: email.assunto, text, html };
}
