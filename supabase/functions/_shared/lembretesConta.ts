import { emailPolia } from "./email-polia.ts";
import type { NichoAnuncio } from "./nichosAnuncio.ts";

// Lembretes pra conta nova (GRW-33, 14/10/2026). Puro: monta o e-mail e decide
// qual lembrete cabe, sem rede nem banco, pra ficar testável.
//
// Confirmação de e-mail: 4 de 16 cadastros da campanha de nichos nunca
// confirmaram (o e-mail foi entregue e ficou parado). Um lembrete 1 hora depois
// e outro 24 horas depois, cada um com link novo que confirma e já entra.
//
// Primeiro preço (preco_d1, 15/10/2026): conta confirmada que no dia seguinte
// ainda não calculou nenhum preço recebe um e-mail só, com a copy do nicho do
// anúncio (serviço ou produto) quando ele é conhecido. O link é URL normal, não
// magiclink: o magiclink vence em pouco tempo e este e-mail é aberto horas
// depois. Sem sessão, o app manda pro login e volta pro destino.

export type TipoConfirmacao = "confirmacao_1h" | "confirmacao_24h";
export type TipoLembrete = TipoConfirmacao | "preco_d1";

const HORA = 60 * 60 * 1000;

/**
 * Qual lembrete de confirmação cabe pra uma conta não confirmada, ou null.
 * 1h: entre 1 e 24 horas de vida. 24h: entre 24 horas e 7 dias (pega também
 * quem se cadastrou antes de o lembrete existir). Cada um sai uma vez só.
 */
export function lembreteDeConfirmacao(
  criadaEm: Date,
  agora: Date,
  jaEnviados: ReadonlySet<TipoLembrete>,
): TipoConfirmacao | null {
  const idade = agora.getTime() - criadaEm.getTime();
  if (idade >= 24 * HORA && idade < 7 * 24 * HORA) {
    return jaEnviados.has("confirmacao_24h") ? null : "confirmacao_24h";
  }
  if (idade >= HORA && idade < 24 * HORA) {
    return jaEnviados.has("confirmacao_1h") ? null : "confirmacao_1h";
  }
  return null;
}

export function montarEmailConfirmacao(
  tipo: TipoConfirmacao,
  link: string,
): { assunto: string; texto: string; html: string } {
  if (tipo === "confirmacao_1h") {
    const paragrafos = [
      "A conta na Pólia One foi criada, mas o e-mail ainda não foi confirmado.",
      "O botão abaixo confirma e já abre a conta.",
      "Se não foi você quem criou a conta, é só ignorar este e-mail.",
    ];
    return {
      assunto: "Falta um clique pra entrar na Pólia One",
      texto: `${paragrafos.join("\n\n")}\n\n${link}`,
      html: emailPolia({
        preheader: "Confirme o e-mail e a conta abre na hora.",
        headline: "Falta confirmar o seu e-mail",
        paragrafos,
        ctaLabel: "Confirmar e entrar",
        ctaUrl: link,
      }),
    };
  }
  const paragrafos = [
    "A conta na Pólia One começou a ser criada, e o e-mail de confirmação ficou pra trás. Às vezes ele cai em Promoções ou no spam.",
    "Este link é novo: confirma o e-mail e já abre a conta.",
    "Se não foi você quem criou a conta, é só ignorar este e-mail.",
  ];
  return {
    assunto: "Sua conta na Pólia One ainda está esperando",
    texto: `${paragrafos.join("\n\n")}\n\n${link}`,
    html: emailPolia({
      preheader: "Um link novo pra confirmar o e-mail e entrar.",
      headline: "A sua conta ainda está esperando",
      paragrafos,
      ctaLabel: "Confirmar e entrar",
      ctaUrl: link,
    }),
  };
}

/**
 * O lembrete do primeiro preço cabe? Conta confirmada entre 20 e 72 horas de
 * vida (o dia seguinte, com folga pra quem se cadastrou antes de ele existir),
 * sem preço calculado (o banco já filtra) e que ainda não recebeu. Uma vez só.
 */
export function lembreteDePreco(
  criadaEm: Date,
  agora: Date,
  jaRecebeu: boolean,
): "preco_d1" | null {
  if (jaRecebeu) return null;
  const idade = agora.getTime() - criadaEm.getTime();
  return idade >= 20 * HORA && idade < 72 * HORA ? "preco_d1" : null;
}

const SITE = "https://one.usepolia.com.br";

const PRIMEIRO_PARAGRAFO =
  "A conta na Pólia One está pronta, mas o primeiro preço ainda não foi calculado.";
const ULTIMO_PARAGRAFO = "Este é o único lembrete sobre isso.";

/** E-mail do primeiro preço. Sem nicho conhecido, a versão geral leva pro Painel. */
export function montarEmailPreco(nicho: NichoAnuncio | null): {
  assunto: string;
  texto: string;
  html: string;
} {
  const copy =
    nicho?.tipo === "servico"
      ? {
          assunto: `${nicho.pessoa}, ficou faltando a conta da sua hora`,
          headline: "A conta da sua hora ainda está em branco",
          segundo:
            "A calculadora junta o material e o seu tempo e mostra quanto a hora precisa valer pra fechar o mês. Leva uns 3 minutos.",
          preheader: "Uns 3 minutos e a Pólia One mostra quanto a hora precisa valer.",
          url: `${SITE}/calculadora?tipo=servico`,
        }
      : nicho?.tipo === "produto"
        ? {
            assunto: `${nicho.pessoa}, ficou faltando a conta do seu produto`,
            headline: "A conta do seu produto ainda está em branco",
            segundo:
              "A calculadora junta material, embalagem e o seu tempo e mostra o preço que dá lucro de verdade. Leva uns 3 minutos.",
            preheader: "Uns 3 minutos e a Pólia One mostra o preço que dá lucro.",
            url: `${SITE}/calculadora?tipo=produto`,
          }
        : {
            assunto: "Falta o primeiro preço na sua Pólia One",
            headline: "O primeiro preço ainda está em branco",
            segundo:
              "A calculadora junta o custo real e o seu tempo e mostra o preço que dá lucro de verdade. Leva uns 3 minutos.",
            preheader: "Uns 3 minutos e a Pólia One mostra o preço que dá lucro.",
            url: `${SITE}/painel`,
          };
  const paragrafos = [PRIMEIRO_PARAGRAFO, copy.segundo, ULTIMO_PARAGRAFO];
  const ctaLabel = "Quero calcular meu preço";
  return {
    assunto: copy.assunto,
    texto: `${paragrafos.join("\n\n")}\n\n${ctaLabel}: ${copy.url}`,
    html: emailPolia({
      preheader: copy.preheader,
      headline: copy.headline,
      paragrafos,
      ctaLabel,
      ctaUrl: copy.url,
    }),
  };
}

// ── Régua de ativação e do teste do Pro (GRW-66, 20/10/2026) ──
// Quem cabe em cada e-mail o banco decide (RPC contas_regua_ativacao); aqui é
// só o texto. Regra de voz: sem travessão, sem exclamação, sem emoji, a Pólia
// como sujeito da promessa, e nada de piada em e-mail de dinheiro ou de plano.

export type TipoRegua =
  | "teste_reativacao"
  | "teste_fim_2d"
  | "teste_acabou"
  | "checkout_1h"
  | "guardar_d2"
  | "segundo_passo_d4"
  | "modulo_d7";

export const TIPOS_REGUA: readonly TipoRegua[] = [
  "teste_reativacao",
  "teste_fim_2d",
  "teste_acabou",
  "checkout_1h",
  "guardar_d2",
  "segundo_passo_d4",
  "modulo_d7",
];

export function ehTipoRegua(v: unknown): v is TipoRegua {
  return typeof v === "string" && (TIPOS_REGUA as readonly string[]).includes(v);
}

/** Igual ao PRAZO_FUNDADORA de src/lib/fundadora.ts (o app e a edge function não dividem código). */
export const PRAZO_FUNDADORA_EMAIL = "2026-11-30T23:59:59-03:00";

function dataCurta(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "o fim do prazo";
  return new Date(t).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function paragrafoFundadora(agora: Date): string | null {
  if (agora.getTime() > Date.parse(PRAZO_FUNDADORA_EMAIL)) return null;
  return "Preço de fundadora: nas primeiras 50 assinaturas feitas até 30/11, o Premium fica em R$ 29,90 e o Pro em R$ 47,90 enquanto a assinatura estiver ativa. A partir de 01/12, o Premium passa a R$ 39,90 e o Pro a R$ 79,90.";
}

const RODAPE_DICAS =
  "Pra não receber mais dicas por e-mail, é só desligar em Configurações, na Pólia One.";

export interface DadosRegua {
  nome: string | null;
  testeFim: string | null;
  agora: Date;
}

export function montarEmailRegua(
  tipo: TipoRegua,
  d: DadosRegua,
): { assunto: string; texto: string; html: string } {
  const fundadora = paragrafoFundadora(d.agora);
  let c: {
    assunto: string;
    headline: string;
    preheader: string;
    paragrafos: (string | null)[];
    ctaLabel: string;
    url: string;
  };
  switch (tipo) {
    case "teste_reativacao":
      c = {
        assunto: "O Pro ficou aberto na sua conta por 7 dias",
        headline: "Sete dias do Pro, sem cartão",
        preheader: `Até ${dataCurta(d.testeFim)}, sem cartão e sem cobrança.`,
        paragrafos: [
          `A Pólia One abriu o plano Pro na sua conta até ${dataCurta(d.testeFim)}. Não precisa de cartão, e no fim não vira cobrança sozinho.`,
          "No Pro entram a Encomenda na Calculadora, a Projeção, que mostra quantas vendas faltam pra meta do mês, o Raio-x do mês e o Plano de conteúdo com ideias do seu nicho.",
          "Um bom começo: calcular o preço de um produto e guardar. Com ele guardado, a Projeção já mostra quantas vendas o mês pede.",
          "No fim do prazo a conta volta pro Grátis, e o que a marca guardou continua guardado.",
        ],
        ctaLabel: "Quero abrir a Pólia One",
        url: `${SITE}/painel`,
      };
      break;
    case "teste_fim_2d":
      c = {
        assunto: "Faltam 2 dias do Pro na sua conta",
        headline: "O teste do Pro está acabando",
        preheader: `Termina em ${dataCurta(d.testeFim)}, e a conta volta pro Grátis sem cobrança.`,
        paragrafos: [
          `O teste do Pro termina em ${dataCurta(d.testeFim)}. Depois disso a conta volta pro Grátis sozinha, sem cobrança nenhuma.`,
          "O que a marca guardou continua guardado. Raio-x, Projeção, Encomenda e Plano de conteúdo ficam fechados até uma assinatura.",
          fundadora,
        ],
        ctaLabel: "Quero assinar",
        url: `${SITE}/assinar?plano=projete`,
      };
      break;
    case "teste_acabou":
      c = {
        assunto: "O teste do Pro terminou",
        headline: "A conta voltou pro Grátis",
        preheader: "Nada foi apagado. O que a marca guardou continua lá.",
        paragrafos: [
          "O teste do Pro terminou e a conta voltou pro plano Grátis. Nada foi apagado: produtos, Planejamento e o que a Projeção e o Raio-x mostraram continuam lá.",
          "O Grátis segue com a Calculadora, até 5 produtos no catálogo e os 6 módulos do Planejamento.",
          fundadora,
        ],
        ctaLabel: "Quero o Pro de volta",
        url: `${SITE}/assinar?plano=projete`,
      };
      break;
    case "checkout_1h":
      c = {
        assunto: "O pagamento da Pólia One ficou pela metade",
        headline: "O pagamento não chegou ao fim",
        preheader: "Nada foi cobrado. O link abre o pagamento de novo.",
        paragrafos: [
          "O pagamento da assinatura foi aberto e não chegou ao fim. Nada foi cobrado.",
          "Se foi o cartão recusado ou a janela que fechou, o link abaixo abre o pagamento de novo.",
          "Ficou alguma dúvida antes de assinar? É só responder este e-mail.",
        ],
        ctaLabel: "Quero terminar a assinatura",
        url: `${SITE}/assinar`,
      };
      break;
    // Desde GRW-90 (27/10/2026) o primeiro preço é guardado sozinho quando o
    // resultado aparece. Quem cai aqui abriu a Calculadora e não chegou ao
    // preço: o texto antigo ("o preço não ficou guardado") deixou de ser verdade.
    case "guardar_d2":
      c = {
        assunto: d.nome
          ? `${d.nome}, a conta do preço ficou no meio`
          : "A conta do preço ficou no meio",
        headline: "A conta do preço ficou no meio",
        preheader: "Quando o resultado aparece, a Pólia One já guarda o preço no catálogo.",
        paragrafos: [
          "A Calculadora foi aberta, mas a conta parou antes do preço aparecer.",
          "Com os custos e o tempo preenchidos, o preço aparece embaixo, e a Pólia One guarda esse preço no catálogo na hora, com o custo e o lucro. Não precisa de botão.",
          "Com um preço guardado, a Pólia One mostra quantas vendas a Meta do mês pede.",
          RODAPE_DICAS,
        ],
        ctaLabel: "Quero terminar a conta",
        url: `${SITE}/calculadora`,
      };
      break;
    case "segundo_passo_d4":
      c = {
        assunto: "Agora que o preço está guardado",
        headline: "O passo seguinte é a meta do mês",
        preheader: "Com a meta, a Pólia One mostra quantas vendas faltam.",
        paragrafos: [
          "O primeiro preço já está no catálogo. O passo seguinte é dizer quanto o mês precisa trazer.",
          "Com a Meta do mês, a Pólia One cruza o preço com o objetivo e mostra quantas vendas faltam. Leva menos de um minuto.",
          RODAPE_DICAS,
        ],
        ctaLabel: "Quero definir a meta do mês",
        url: `${SITE}/metas`,
      };
      break;
    case "modulo_d7":
      c = {
        assunto: "O Planejamento ficou no meio",
        headline: "As respostas continuam guardadas",
        preheader: "Uma seção por vez já conta.",
        paragrafos: [
          "O Planejamento da sua marca começou e parou no meio. As respostas continuam guardadas, exatamente como ficaram.",
          "É dele que saem os documentos da marca e o que sustenta o preço na frente da cliente. Uma seção por vez já conta.",
          RODAPE_DICAS,
        ],
        ctaLabel: "Quero continuar o Planejamento",
        url: `${SITE}/planejamento`,
      };
      break;
  }
  const paragrafos = c.paragrafos.filter((p): p is string => !!p);
  return {
    assunto: c.assunto,
    texto: `${paragrafos.join("\n\n")}\n\n${c.ctaLabel}: ${c.url}`,
    html: emailPolia({
      preheader: c.preheader,
      headline: c.headline,
      paragrafos,
      ctaLabel: c.ctaLabel,
      ctaUrl: c.url,
    }),
  };
}
