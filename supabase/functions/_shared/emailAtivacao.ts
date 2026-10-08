import { emailPolia } from "./email-polia.ts";

// E-mail de "compra confirmada, falta criar a senha". Mora aqui porque dois
// lugares montam o mesmo e-mail: o stripe-webhook (primeiro envio) e o
// reenviar-emails (PAY-27), que gera um link novo, já que o do convite expira.
export function montarEmailAtivacao(linkAtivacao: string): {
  assunto: string;
  texto: string;
  html: string;
} {
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
