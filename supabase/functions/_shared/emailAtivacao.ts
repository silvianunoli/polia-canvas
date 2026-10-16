import { emailPolia } from "./email-polia.ts";

// Cortesia (cupom de 100%, campanha UGC, 16/10/2026): a criadora não comprou
// nada, então o e-mail não fala em compra. plano é o nome visível (Premium ou
// Pro) e ate é o fim do acesso já formatado (cancel_at da assinatura). Os dois
// podem faltar: cupom sem data de fim não agenda cancel_at.
export interface Cortesia {
  plano: string | null;
  ate: string | null;
}

// Chave interna do plano (PRICE_TO_PLANO do stripe-webhook) pro nome visível.
export function nomeDoPlanoCortesia(chave: string | null | undefined): string | null {
  if (chave === "projete") return "Pro";
  if (chave === "controle") return "Premium";
  return null;
}

export function assuntoDaCortesia(c: Cortesia): string {
  return c.plano ? `Seu acesso ao ${c.plano} foi liberado` : "Seu acesso foi liberado";
}

function liberouNaConta(c: Cortesia): string {
  return c.plano
    ? `A Pólia liberou o plano ${c.plano} na sua conta da Pólia One, por cortesia.`
    : "A Pólia liberou o acesso à Pólia One na sua conta, por cortesia.";
}

// Sem data, não promete o "sem cobrança": cupom sem fim não cancela sozinho.
function ateQuando(c: Cortesia): string[] {
  return c.ate
    ? [`O acesso vai até ${c.ate}. Depois disso a conta volta pro plano Grátis, sem nenhuma cobrança.`]
    : [];
}

// O contexto vai pra fila de reenvio (emails_pendentes.contexto). Quando o link
// expira, o reenviar-emails monta o e-mail de novo com link novo e precisa
// saber se era cortesia, senão a criadora recebia "Sua compra foi confirmada"
// na segunda tentativa. Por isso o contexto carrega plano e data, e
// cortesiaDoContexto lê de volta.
const CONTEXTO_ATIVACAO = "e-mail de ativação";

export function contextoDaAtivacao(c?: Cortesia | null): string {
  if (!c) return CONTEXTO_ATIVACAO;
  const plano = c.plano ? ` ${c.plano}` : "";
  const ate = c.ate ? ` até ${c.ate}` : "";
  return `${CONTEXTO_ATIVACAO} (cortesia${plano}${ate})`;
}

export function cortesiaDoContexto(contexto: string): Cortesia | null {
  const m = /^e-mail de ativação \(cortesia(?: (Premium|Pro))?(?: até (\d{2}\/\d{2}\/\d{4}))?\)$/.exec(
    contexto,
  );
  return m ? { plano: m[1] ?? null, ate: m[2] ?? null } : null;
}

// E-mail de "acesso liberado, falta criar a senha". Mora aqui porque dois
// lugares montam o mesmo e-mail: o stripe-webhook (primeiro envio) e o
// reenviar-emails (PAY-27), que gera um link novo, já que o do convite expira.
export function montarEmailAtivacao(
  linkAtivacao: string,
  cortesia?: Cortesia | null,
): {
  assunto: string;
  texto: string;
  html: string;
} {
  if (cortesia) {
    const assunto = assuntoDaCortesia(cortesia);
    const paragrafos = [
      `${liberouNaConta(cortesia)} Agora falta criar sua senha para entrar pela primeira vez.`,
      ...ateQuando(cortesia),
      "Esse link vale por pouco tempo. Se não esperava este e-mail, ignore.",
    ];
    return {
      assunto,
      texto: `${paragrafos[0]}\n\n${linkAtivacao}\n\n${paragrafos.slice(1).join("\n\n")}`,
      html: emailPolia({
        preheader: liberouNaConta(cortesia),
        headline: assunto,
        paragrafos,
        ctaLabel: "Criar minha senha",
        ctaUrl: linkAtivacao,
      }),
    };
  }
  return {
    assunto: "Sua compra foi confirmada",
    texto: `Agora falta criar sua senha para entrar na Pólia One pela primeira vez.\n\n${linkAtivacao}\n\nEsse link vale por pouco tempo. Se não foi você quem comprou, ignore este e-mail.`,
    html: emailPolia({
      preheader: "Agora falta criar sua senha para entrar na Pólia One.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "Agora falta criar sua senha para entrar na Pólia One pela primeira vez.",
        "Esse link vale por pouco tempo. Se não foi você quem comprou, ignore este e-mail.",
      ],
      ctaLabel: "Criar minha senha",
      ctaUrl: linkAtivacao,
    }),
  };
}

// Cortesia pra quem já tinha conta: não há senha pra criar, então só avisa e
// leva pro login (par do enviarEmailCompraContaExistente do stripe-webhook).
export function montarEmailCortesiaContaExistente(
  siteUrl: string,
  cortesia: Cortesia,
): { assunto: string; texto: string; html: string } {
  const assunto = assuntoDaCortesia(cortesia);
  const paragrafos = [
    `${liberouNaConta(cortesia)} É só entrar com este e-mail.`,
    ...ateQuando(cortesia),
    'Se não lembra a senha, use "Recuperar acesso" na tela de entrada.',
  ];
  const login = `${siteUrl}/auth/login`;
  return {
    assunto,
    texto: `${paragrafos[0]}\n\n${login}\n\n${paragrafos.slice(1).join("\n\n")}\n\nAlguma dúvida? Escreva pra oi@usepolia.com.br.`,
    html: emailPolia({
      preheader: liberouNaConta(cortesia),
      headline: assunto,
      paragrafos: [...paragrafos, "Alguma dúvida? Escreva pra oi@usepolia.com.br."],
      ctaLabel: "Entrar na Pólia",
      ctaUrl: login,
    }),
  };
}
