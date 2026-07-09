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

// Casca HTML compartilhada pros e-mails transacionais da Pólia (Resend).
// Layout em tabela + estilo inline: é o padrão robusto pra e-mail — Outlook
// desktop não lê <style>/flexbox/grid, então nada de CSS moderno aqui.
// Fontes web (DM Serif Display, Inter) quase nunca carregam em cliente de
// e-mail — os fallbacks (Georgia/system sans) já imitam a serifa e o peso
// certos, então a falha é silenciosa e ainda assim fica com a cara da marca.
export function emailPolia({
  preheader,
  headline,
  paragrafos,
  ctaLabel,
  ctaUrl,
}: {
  preheader: string;
  headline: string;
  paragrafos: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const corpoParagrafos = paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:rgba(26,26,46,0.72);">${p}</p>`,
    )
    .join("\n");

  const botao = ctaLabel && ctaUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
        <tr>
          <td style="border-radius:8px;background-color:#C96B3E;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FDF8F5;text-decoration:none;border-radius:8px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${headline}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FDF8F5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF8F5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;text-align:left;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#C96B3E;">Pólia</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid rgba(26,26,46,0.08);border-radius:12px;padding:32px;">
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#1A1A2E;">
                  ${headline}
                </h1>
                ${corpoParagrafos}
                ${botao}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;text-align:left;">
                <p style="margin:0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(26,26,46,0.4);">
                  Pólia · usepolia.com.br
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
