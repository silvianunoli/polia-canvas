// Transporte dos e-mails da Pólia: chave da API, envio pro Resend e registro de
// falha. A casca HTML (`emailPolia`, `escapeHtml`) NÃO mora aqui — mora em
// `supabase/functions/_shared/email-polia.ts`, porque as edge functions do
// Supabase precisam do mesmo HTML e só conseguem importar de `_shared`. O
// arquivo de lá é puro (sem import, sem env) justamente pra rodar nos dois
// runtimes; este aqui depende de Node/Worker e por isso ficou separado.
//
// Continua valendo importar tudo de `@/lib/email-template`: os reexports abaixo
// mantêm o ponto de entrada único pro app.
export { emailPolia, escapeHtml } from "../../supabase/functions/_shared/email-polia.ts";

export function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[Resend] Missing RESEND_API_KEY environment variable.");
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }
  return key;
}

// Falha de e-mail é engolida de propósito (ver enviarEmailResend), e por isso
// mesmo ela precisa aparecer em algum lugar: só o console.error deixava o erro
// no log do Worker, que ninguém lê. Aqui ela vira linha em erros_app, que já
// tem tela no admin. Sem o endereço do destinatário: a mensagem de erro não é
// lugar de guardar e-mail de ninguém.
async function registrarFalhaDeEmail(contexto: string, detalhe: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("erros_app").insert({
      origem: "server",
      mensagem: `${contexto} Falha ao enviar e-mail: ${detalhe}`.slice(0, 2000),
    });
  } catch {
    // O log do erro nunca pode virar um erro.
  }
}

// Envio best-effort: quem chama decide se uma falha de e-mail deve derrubar
// a operação principal (normalmente não deve — o dado já foi salvo/o estado
// já mudou, o e-mail é só a notificação).
export async function enviarEmailResend(params: {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Cabeçalhos extras. Usado pro List-Unsubscribe, que é o que faz o Gmail
   *  mostrar "Cancelar inscrição" ao lado do remetente. */
  headers?: Record<string, string>;
  contexto: string;
}): Promise<boolean> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      }),
    });
    if (!resp.ok) {
      const corpo = await resp.text();
      console.error(`${params.contexto} Falha ao enviar e-mail:`, corpo);
      await registrarFalhaDeEmail(params.contexto, `HTTP ${resp.status} ${corpo}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${params.contexto} Erro ao enviar e-mail:`, err);
    await registrarFalhaDeEmail(params.contexto, err instanceof Error ? err.message : String(err));
    return false;
  }
}
