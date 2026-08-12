// Escapa HTML antes de interpolar qualquer texto de origem não confiável
// (formulário público, input de usuária) num e-mail — sem isso, dá pra
// injetar HTML/script no corpo do e-mail que o destinatário abre.
export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

// Casca HTML compartilhada pros e-mails transacionais da Pólia (Resend).
//
// Layout em tabela + estilo inline: é o padrão robusto pra e-mail. Outlook
// desktop não lê <style>, flexbox nem grid, e nenhum cliente lê variável CSS,
// então os tokens de src/styles.css entram aqui como valor literal. Os hexes
// abaixo NÃO são cor solta: cada um é um token do escopo .polia-v3, e mexer
// neles sem mexer no styles.css quebra a correspondência com o site.
//
//   #F2F0ED  --bg            fundo da página
//   #FFFFFF  cartão          (o site usa branco em cima de --bg)
//   #E6E6E6  --line          borda do cartão
//   #0A0A0A  --ink           título e texto do botão
//   #2C2C2C  --ink-soft      corpo
//   #767676  --muted         rodapé. NÃO usar #9E9E9E: reprova em AA e por
//                            isso saiu do sistema.
//   #7CCBCD  --secondary     fundo do botão
//   #F6DAD4  --surface-pink  caixa de destaque, a mesma da tela de resultado
//
// Fonte: nenhum cliente de e-mail carrega fonte web de forma confiável, então
// Cabinet Grotesk e Inter aparecem na pilha pra funcionar onde der, e o
// fallback é a sans do sistema. Serifada seria erro: os títulos do site são
// Cabinet Grotesk, uma grotesca. Fraunces no site é só itálico de acento.
const FONTE_TITULO =
  "'Cabinet Grotesk','Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const FONTE_CORPO = "'Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export function emailPolia({
  preheader,
  headline,
  paragrafos,
  destaque,
  ctaLabel,
  ctaUrl,
  descadastroUrl,
}: {
  preheader: string;
  headline: string;
  paragrafos: string[];
  /** Caixa pêssego, igual à da tela de resultado do quiz. Passe já escapado. */
  destaque?: { rotulo: string; texto: string };
  ctaLabel?: string;
  ctaUrl?: string;
  /** Link de saída de um clique. Só pros e-mails de lista: os transacionais
   *  (conta criada, recibo, senha) não levam descadastro, porque ninguém pode
   *  optar por não receber o recibo da própria compra. */
  descadastroUrl?: string;
}): string {
  const corpoParagrafos = paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONTE_CORPO};font-size:15px;line-height:1.6;color:#2C2C2C;">${p}</p>`,
    )
    .join("\n");

  const caixaDestaque = destaque
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background-color:#F6DAD4;border-radius:12px;padding:24px;">
                      <p style="margin:0 0 8px;font-family:${FONTE_CORPO};font-size:13px;font-weight:600;line-height:1.4;color:#2C2C2C;">
                        ${destaque.rotulo}
                      </p>
                      <p style="margin:0;font-family:${FONTE_CORPO};font-size:15px;line-height:1.6;color:#0A0A0A;">
                        ${destaque.texto}
                      </p>
                    </td>
                  </tr>
                </table>`
    : "";

  const botao =
    ctaLabel && ctaUrl
      ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
                  <tr>
                    <td style="border-radius:8px;background-color:#7CCBCD;">
                      <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;font-family:${FONTE_CORPO};font-size:15px;font-weight:600;color:#0A0A0A;text-decoration:none;border-radius:8px;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>`
      : "";

  const linhaDescadastro = descadastroUrl
    ? `
                <p style="margin:8px 0 0;font-family:${FONTE_CORPO};font-size:12px;line-height:1.5;color:#767676;">
                  <a href="${descadastroUrl}" style="color:#767676;text-decoration:underline;">Não quero mais receber</a>
                </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${headline}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F2F0ED;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F0ED;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;text-align:left;">
                <span style="font-family:${FONTE_TITULO};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0A0A0A;">Pólia</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid #E6E6E6;border-radius:12px;padding:32px;">
                <h1 style="margin:0 0 16px;font-family:${FONTE_TITULO};font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#0A0A0A;">
                  ${headline}
                </h1>
                ${corpoParagrafos}
                ${caixaDestaque}
                ${botao}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;text-align:left;">
                <p style="margin:0;font-family:${FONTE_CORPO};font-size:12px;line-height:1.5;color:#767676;">
                  Pólia · usepolia.com.br
                </p>
                ${linhaDescadastro}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
