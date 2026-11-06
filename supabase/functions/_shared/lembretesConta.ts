import { emailPolia } from "./email-polia.ts";

// Lembretes pra conta nova (GRW-33, 14/10/2026). Puro: monta o e-mail e decide
// qual lembrete cabe, sem rede nem banco, pra ficar testável.
//
// Confirmação de e-mail: 4 de 16 cadastros da campanha de nichos nunca
// confirmaram (o e-mail foi entregue e ficou parado). Um lembrete 1 hora depois
// e outro 24 horas depois, cada um com link novo que confirma e já entra.
//
// O "preco_d1" (Falta o primeiro preço) saiu em 05/11/2026 (ONE-175, decisão da
// Sil): era o primeiro e-mail da conta e abria a conversa pelo preço. As linhas
// antigas de lembretes_conta com esse tipo continuam como registro de envio.

export type TipoConfirmacao = "confirmacao_1h" | "confirmacao_24h";
export type TipoLembrete = TipoConfirmacao;

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

const SITE = "https://one.usepolia.com.br";

// ── Régua de ativação e do teste do Pro (GRW-66, 20/10/2026) ──
// Quem cabe em cada e-mail o banco decide (RPC contas_regua_ativacao); aqui é
// só o texto. Regra de voz: sem travessão, sem exclamação, sem emoji, a Pólia
// como sujeito da promessa, e nada de piada em e-mail de dinheiro ou de plano.
//
// O "modulo_d7" (O Planejamento ficou no meio) saiu em 31/10/2026, junto com o
// Planejamento da Pólia One. Fora desta lista, o tipo não passa no ehTipoRegua
// e não sai, mesmo que o banco ainda devolva a conta (a migration
// 20261031200200 tira o critério da contas_regua_ativacao).

export type TipoRegua =
  | "teste_reativacao"
  | "teste_fim_2d"
  | "teste_acabou"
  | "checkout_1h"
  | "guardar_d2"
  | "segundo_passo_d4";

export const TIPOS_REGUA: readonly TipoRegua[] = [
  "teste_reativacao",
  "teste_fim_2d",
  "teste_acabou",
  "checkout_1h",
  "guardar_d2",
  "segundo_passo_d4",
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
          "No Pro entram a Encomenda na Calculadora, a Projeção, que mostra quantas vendas faltam pra meta do mês, o Raio-x do mês e o catálogo online ligado aos Pedidos.",
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
          "O que a marca guardou continua guardado. Raio-x, Projeção, Encomenda e o catálogo online ficam fechados até uma assinatura.",
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
          "O teste do Pro terminou e a conta voltou pro plano Grátis. Nada foi apagado: produtos, pedidos e o que a Projeção e o Raio-x mostraram continuam lá.",
          "O Grátis segue com a Calculadora, até 5 produtos no catálogo e o quadro de Pedidos com até 15 pedidos abertos.",
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
    // Desde ONE-175 (05/11/2026) os dois falam da encomenda, não de preço e meta,
    // pra Pólia One não parecer ferramenta de precificação. A chave interna fica:
    // quem já recebeu a versão antiga não recebe de novo (migration 20261105230100).
    // Dois dias de conta, sem pedido lançado. Texto aprovado pela Sil em
    // Polia Lab/clientes/polia-one/05-vendas/TA-CARO-E-CAMINHO.md, Parte 3.
    case "guardar_d2":
      c = {
        assunto: "A próxima encomenda já pode entrar no quadro",
        headline: "A próxima encomenda já pode entrar no quadro",
        preheader: "Cadastre o produto e lance o pedido com o dia da entrega.",
        paragrafos: [
          "O quadro de Pedidos está pronto na sua conta. Cadastre o produto da próxima encomenda e lance o pedido com o dia da entrega.",
          "A partir daí, a Pólia One mostra o que tem pra hoje e pra amanhã, quem já pagou e quanto cada encomenda lucra.",
          RODAPE_DICAS,
        ],
        ctaLabel: "Quero lançar a encomenda",
        url: `${SITE}/pedidos`,
      };
      break;
    // Quatro dias de conta, com pedido em aberto e nenhum entregue.
    case "segundo_passo_d4":
      c = {
        assunto: "Agora que a encomenda está no quadro",
        headline: "O passo seguinte é a entrega",
        preheader: "Entregue, o cartão mostra quanto a encomenda lucrou.",
        paragrafos: [
          "A encomenda já está no quadro. Quando ela sair, é só passar o cartão até Entregue.",
          "Entregue, ela entra no mês, e o cartão mostra quanto lucrou.",
          RODAPE_DICAS,
        ],
        ctaLabel: "Quero abrir o quadro de Pedidos",
        url: `${SITE}/pedidos`,
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
