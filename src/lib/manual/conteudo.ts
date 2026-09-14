// Nomes e frases do "Manual da Pequena Marca que Quer Ser Grande" que aparecem
// em mais de um lugar: a landing (/manual), a server function que grava o lead
// e o e-mail de entrega. Mudou aqui, mudou nos três.
//
// Arquivo puro (sem import) pra poder ser carregado no cliente e no servidor.

/** Nome sem artigo, pra frases em que ele já vem antes ("Seu Manual..."). */
export const NOME_MANUAL_CURTO = "Manual da Pequena Marca que Quer Ser Grande";

/** Nome completo, como aparece na capa. */
export const NOME_MANUAL = `O ${NOME_MANUAL_CURTO}`;

/** Frase do consentimento, exatamente como aparece no checkbox. É gravada em
 *  manual_leads.consent_texto pra auditoria LGPD, então mexer nela é mexer no
 *  registro do que a pessoa aceitou. */
export const CONSENT_TEXTO_MANUAL =
  "Quero receber o manual e os e-mails da Pólia. Sem spam, e você sai quando quiser.";

export const INSTAGRAM_URL = "https://www.instagram.com/usepolia/";

/** Nome com que o PDF cai na pasta de downloads da pessoa. */
export const NOME_ARQUIVO_PDF = "manual-da-pequena-marca-que-quer-ser-grande.pdf";
