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
              "A calculadora junta material, embalagem e o seu tempo e mostra o preço que deixa sobra de verdade. Leva uns 3 minutos.",
            preheader: "Uns 3 minutos e a Pólia One mostra o preço que deixa sobra.",
            url: `${SITE}/calculadora?tipo=produto`,
          }
        : {
            assunto: "Falta o primeiro preço na sua Pólia One",
            headline: "O primeiro preço ainda está em branco",
            segundo:
              "A calculadora junta o custo real e o seu tempo e mostra o preço que deixa sobra de verdade. Leva uns 3 minutos.",
            preheader: "Uns 3 minutos e a Pólia One mostra o preço que deixa sobra.",
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
