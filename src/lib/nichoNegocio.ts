// Nicho do negócio (23/10/2026, pedido da Sil): obrigatório no bloco "Primeiros
// passos" do Painel, que é o onboarding desde 14/10. Fica em profiles.nicho.
//
// As chaves e os nomes são os mesmos do banco de ideias do Plano de conteúdo
// (lib/bancoIdeias), mais "outro" pra quem não se acha em nenhum. A lista é
// repetida aqui de propósito: importar lib/bancoIdeias levaria as 480 ideias
// pro Painel. O teste trava que as duas listas continuam iguais.

import type { BusinessTypeGravado } from "@/lib/primeirosPassos";

export type NichoNegocio =
  | "papelaria"
  | "moda"
  | "beleza"
  | "comida"
  | "digital"
  | "bemestar"
  | "servicos"
  | "artesanato"
  | "outro";

export const ESCOLHAS_NICHO: readonly { valor: NichoNegocio; rotulo: string; exemplos: string }[] =
  [
    {
      valor: "papelaria",
      rotulo: "Papelaria e presentes",
      exemplos: "cadernos, agendas, cartões, brindes",
    },
    { valor: "moda", rotulo: "Moda e acessórios", exemplos: "roupas, bijuterias, bolsas, brechó" },
    { valor: "beleza", rotulo: "Beleza e cosméticos", exemplos: "skincare, sabonetes, maquiagem" },
    { valor: "comida", rotulo: "Comida e doces", exemplos: "confeitaria, salgados, marmitas" },
    { valor: "digital", rotulo: "Produto digital", exemplos: "cursos, ebooks, templates" },
    {
      valor: "bemestar",
      rotulo: "Serviço de beleza e bem-estar",
      exemplos: "manicure, estética, massagem",
    },
    {
      valor: "servicos",
      rotulo: "Consultoria e serviços",
      exemplos: "design, fotografia, social media",
    },
    { valor: "artesanato", rotulo: "Artesanato", exemplos: "cerâmica, crochê, velas, bordado" },
    { valor: "outro", rotulo: "Outro ramo", exemplos: "nenhum desses descreve a marca" },
  ];

const VALORES = new Set<string>(ESCOLHAS_NICHO.map((n) => n.valor));

export function nichoDoBanco(v: unknown): NichoNegocio | null {
  return typeof v === "string" && VALORES.has(v) ? (v as NichoNegocio) : null;
}

/**
 * O que o nicho já diz sobre o tipo de negócio, pra a conta não responder duas
 * vezes. "Outro" não diz nada: aí vale a pergunta "A sua marca vende o quê?".
 */
export function businessTypeDoNicho(
  n: NichoNegocio,
): BusinessTypeGravado | "produto_digital" | null {
  if (n === "outro") return null;
  if (n === "bemestar" || n === "servicos") return "servico";
  if (n === "digital") return "produto_digital";
  return "produto_fisico";
}

/**
 * Anúncio de nicho (utm_content, ver lib/nichosLanding) que cai sem dúvida num
 * nicho daqui. Os que ficam no meio do caminho (psicóloga, nutricionista,
 * saboaria) não entram: a conta escolhe, em vez de a Pólia chutar.
 */
const NICHO_DO_ANUNCIO: Record<string, NichoNegocio> = {
  "N01-nail": "bemestar",
  "N02-trancista": "bemestar",
  "N03-lash": "bemestar",
  "N04-cabeleireira": "bemestar",
  "N05-esteticista": "bemestar",
  "N06-maquiadora": "bemestar",
  "N07-confeiteira": "comida",
  "N08-doceira": "comida",
  "N09-marmita": "comida",
  "N10-salgadeira": "comida",
  "N11-loja-roupa": "moda",
  "N12-cosmeticos": "beleza",
  "N14-social-media": "servicos",
  "N17-designer": "servicos",
  "N18-papelaria": "papelaria",
  "N19-croche": "artesanato",
  "N21-fotografa": "servicos",
};

export function nichoNegocioDoAnuncio(utmContent: string | undefined): NichoNegocio | null {
  const chave = utmContent?.trim();
  // hasOwn: "toString" no utm_content não pode achar o método do objeto.
  return chave && Object.hasOwn(NICHO_DO_ANUNCIO, chave) ? NICHO_DO_ANUNCIO[chave] : null;
}
