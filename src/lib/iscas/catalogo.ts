// Catálogo das iscas em PDF de /materiais/<slug>.
//
// Uma entrada por material. A página, a server function que grava o lead, o
// e-mail de entrega e a rota de download leem daqui, então acrescentar uma
// isca nova é acrescentar uma entrada (e subir o PDF no bucket privado
// `iscas`, ver supabase/migrations/20261111120000_isca_leads.sql). Nenhum
// outro arquivo precisa mudar.
//
// Arquivo puro (sem import) pra carregar no cliente e no servidor.
//
// Próximas previstas: marca-pronta, quanto-lucra, marca-premium, natal.
//
// Regras de copy que valem pra toda entrada (CLAUDE.md da raiz): sem
// travessão, sem "jornada", "etapa", "trilha", "no seu ritmo"; "margem" vira
// "quanto lucra"; CTA começa com "Quero...". Os bullets descrevem o que o PDF
// TEM: se o arquivo mudar, a lista muda junto.

export interface EmailIsca {
  /** Assunto. Sem exclamação: o e-mail de entrega segue a régua contida. */
  assunto: string;
  /** Texto curto que o Gmail mostra ao lado do assunto. */
  preheader: string;
  /** Título grande dentro do e-mail. */
  headline: string;
  paragrafos: string[];
  /** Rótulo do botão de download no e-mail. */
  cta: string;
  fechamento: string;
}

export interface Isca {
  slug: string;
  /** Rótulo em caixa alta acima do título ("Checklist gratuito"). */
  rotulo: string;
  titulo: string;
  /** Trecho do título que ganha o grifo amarelo (um por tela). Precisa
   *  aparecer literalmente dentro de `titulo`; se não aparecer, não grifa. */
  destaque?: string;
  subtitulo: string;
  /** O que tem dentro do PDF, na ordem do arquivo. */
  bullets: string[];
  /** Como a página chama o material na frase ("o checklist", "o guia"). */
  nomeCurto: string;
  /** Texto do botão do formulário. Começa com "Quero...". */
  cta: string;
  /** Descrição pro buscador e pra prévia do link no Direct. */
  descricao: string;
  /** Nome com que o PDF cai na pasta de downloads da pessoa. ASCII, sem espaço. */
  nomeArquivo: string;
  /** Caminho do objeto dentro do bucket privado `iscas`. */
  objeto: string;
  /** Frase do consentimento, exatamente como aparece no checkbox. É gravada
   *  em isca_leads.consent_texto pra auditoria LGPD: mexer nela é mexer no
   *  registro do que a pessoa aceitou. */
  consentTexto: string;
  /** Valor de isca_leads.origem quando o link chega sem ?origem=. */
  origemPadrao: string;
  email: EmailIsca;
}

const CONSENT_PADRAO =
  "Quero receber o material e as mensagens da Pólia por e-mail e WhatsApp. Sem spam, e você sai quando quiser.";

export const ISCAS: Record<string, Isca> = {
  "black-friday": {
    slug: "black-friday",
    rotulo: "Checklist gratuito",
    titulo: "Black Friday sem queimar o lucro",
    destaque: "sem queimar o lucro",
    subtitulo:
      "O checklist pra planejar a Black com antecedência: o desconto que cabe no seu lucro, estoque, prazos e mensagens prontas.",
    bullets: [
      "O cronograma até o dia 27, semana a semana",
      "A conta do desconto que cabe no seu lucro, com espaço pra fazer a do seu produto",
      "O checklist de oferta, estoque, divulgação, atendimento, entrega e pós-Black",
      "Quatro mensagens de WhatsApp prontas pra copiar",
    ],
    nomeCurto: "o checklist",
    cta: "Quero o checklist",
    descricao:
      "Checklist gratuito pra planejar a Black Friday com antecedência: desconto que cabe no lucro, estoque, prazos e mensagens prontas. O PDF baixa na hora.",
    nomeArquivo: "checklist-black-friday-polia.pdf",
    objeto: "checklist-black-friday-polia.pdf",
    consentTexto: CONSENT_PADRAO,
    origemPadrao: "instagram_direct",
    email: {
      assunto: "Seu checklist da Black Friday chegou",
      preheader: "Desconto, estoque, prazos e mensagens prontas, num PDF só.",
      headline: "Seu checklist da Black Friday chegou.",
      paragrafos: [
        "Aqui está o checklist pra planejar a Black Friday com antecedência.",
        "Ele passa pelo desconto que cabe no seu lucro, pelo estoque, pelos prazos de produção e entrega, e traz mensagens prontas pra avisar as clientes.",
        "Vale abrir no celular ou imprimir e ir marcando item por item.",
      ],
      cta: "Baixar o checklist",
      fechamento: "Boa Black Friday.",
    },
  },
};

/** Formato aceito de slug: minúsculas, números e hífen. É o que vai na URL e
 *  em isca_leads.isca_slug. */
export const SLUG_ISCA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buscarIsca(slug: string | null | undefined): Isca | undefined {
  if (typeof slug !== "string" || !SLUG_ISCA.test(slug)) return undefined;
  // hasOwn em vez de ISCAS[slug] direto: "constructor" ou "__proto__" não
  // podem virar isca.
  return Object.prototype.hasOwnProperty.call(ISCAS, slug) ? ISCAS[slug] : undefined;
}
