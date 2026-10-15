// Nicho de cada anúncio da campanha "Nichos · Cadastro" (15/10/2026), pro
// e-mail do dia seguinte de quem não calculou o primeiro preço
// (lembretes-conta, tipo preco_d1). Chave = utm_content do anúncio, que fica
// gravado na conta em raw_user_meta_data.origem_campanha.utm_content.
//
// Cópia de `pessoa` e `tipo` de src/lib/nichosLanding.ts: a edge function não
// enxerga src/ no deploy (ver o cabeçalho de email-polia.ts). O teste
// src/lib/nichosAnuncio.test.ts falha se os dois mapas divergirem: mexeu num,
// mexe no outro.
//
// Puro: sem import, sem Deno, sem process.env.

export type TipoNicho = "servico" | "produto";

export type NichoAnuncio = {
  /** Como o anúncio chama quem ele procura ("Trancista", "Papelaria personalizada"). */
  pessoa: string;
  /** Serviço (preço da hora) ou produto (preço da unidade). */
  tipo: TipoNicho;
};

export const NICHOS_ANUNCIO: Readonly<Record<string, NichoAnuncio>> = {
  "N01-nail": { pessoa: "Nail designer", tipo: "servico" },
  "N02-trancista": { pessoa: "Trancista", tipo: "servico" },
  "N03-lash": { pessoa: "Lash designer", tipo: "servico" },
  "N04-cabeleireira": { pessoa: "Cabeleireira", tipo: "servico" },
  "N05-esteticista": { pessoa: "Esteticista", tipo: "servico" },
  "N06-maquiadora": { pessoa: "Maquiadora", tipo: "servico" },
  "N07-confeiteira": { pessoa: "Confeiteira", tipo: "produto" },
  "N08-doceira": { pessoa: "Doceira", tipo: "produto" },
  "N09-marmita": { pessoa: "Marmiteira", tipo: "produto" },
  "N10-salgadeira": { pessoa: "Salgadeira", tipo: "produto" },
  "N11-loja-roupa": { pessoa: "Lojista", tipo: "produto" },
  "N12-cosmeticos": { pessoa: "Revendedora", tipo: "produto" },
  "N14-social-media": { pessoa: "Social media", tipo: "servico" },
  "N15-psicologa": { pessoa: "Psicóloga", tipo: "servico" },
  "N16-nutricionista": { pessoa: "Nutricionista", tipo: "servico" },
  "N17-designer": { pessoa: "Designer", tipo: "servico" },
  "N18-papelaria": { pessoa: "Papelaria personalizada", tipo: "produto" },
  "N19-croche": { pessoa: "Crocheteira", tipo: "produto" },
  "N20-saboaria": { pessoa: "Saboaria artesanal", tipo: "produto" },
  "N21-fotografa": { pessoa: "Fotógrafa", tipo: "servico" },
};

/** O nicho do anúncio, ou null quando o utm_content não é de nicho. */
export function nichoDoAnuncio(utmContent: string | null | undefined): NichoAnuncio | null {
  if (!utmContent) return null;
  const chave = utmContent.trim();
  return Object.prototype.hasOwnProperty.call(NICHOS_ANUNCIO, chave) ? NICHOS_ANUNCIO[chave] : null;
}
