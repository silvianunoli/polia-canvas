import { emailPolia } from "./email-polia.ts";

// Lembretes pra conta nova (GRW-33, 14/10/2026). Puro: monta o e-mail e decide
// qual lembrete cabe, sem rede nem banco, pra ficar testável.
//
// Confirmação de e-mail: 4 de 16 cadastros da campanha de nichos nunca
// confirmaram (o e-mail foi entregue e ficou parado). Um lembrete 1 hora depois
// e outro 24 horas depois, cada um com link novo que confirma e já entra.

export type TipoLembrete = "confirmacao_1h" | "confirmacao_24h";

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
): TipoLembrete | null {
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
  tipo: TipoLembrete,
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
