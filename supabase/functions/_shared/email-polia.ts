// Casca HTML dos e-mails transacionais da Pólia. Cópia única, usada pelos dois
// runtimes: as edge functions (Deno) importam daqui por caminho relativo, e o
// app (Worker) importa via `@/lib/email-template`, que só reexporta este arquivo.
//
// Por que mora em `supabase/functions/_shared/` e não em `src/lib/`, que seria o
// lugar natural: `_shared` é a única pasta que o `supabase functions deploy`
// garante empacotar junto com a função. Um arquivo em `src/` pode não entrar no
// bundle, e um deploy quebrado aqui derruba o webhook do Stripe — que é o que
// cria a conta de quem acabou de pagar. O build do app, ao contrário, resolve
// caminho relativo pra fora de `src/` sem problema. Então a direção da
// dependência é essa, e não o inverso.
//
// Este arquivo é PURO de propósito: sem import, sem `process.env`, sem `Deno.`.
// É o que permite os dois runtimes lerem o mesmo código. O transporte (chave da
// API, fetch pro Resend, registro de falha) fica em `src/lib/email-template.ts`.
//
// Antes desta extração o `stripe-webhook` tinha uma cópia própria que não
// acompanhou a virada v3: Georgia serifada no título e rodapé em #9E9E9E. Os
// quatro e-mails de dinheiro (compra, pagamento recusado, cancelamento,
// renovação) saíam fora da marca. Se precisar de uma variação, ela entra como
// parâmetro aqui — nunca como segunda cópia do HTML.

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
//   #6B6B6B  --muted         rodapé (fica sobre o --bg, fora do cartão).
//                            NÃO usar #9E9E9E nem o antigo #767676: os dois
//                            reprovam AA sobre #F2F0ED e saíram do sistema.
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

// Logo do cabeçalho. É PNG hospedado de propósito, e a tentação de trocar por
// SVG inline (que é o que o site e o polia-office usam) precisa ser resistida:
// Gmail, Outlook e Yahoo removem a tag <svg> do HTML do e-mail. Inline o SVG
// aqui e a marca some pra maior parte de quem recebe, sem nem deixar texto no
// lugar — fica um buraco. O PNG é rasterizado do MESMO arquivo oficial
// (public/marketing/logo.svg, o wordmark com a trilha de 3 pontos), então não
// há segunda versão do logo pra sair de sincronia. Pra regerar depois de mexer
// no logo (3x do tamanho de exibição, achatado sobre o --bg do cabeçalho):
//
//   node -e "const s=require('sharp'),f=require('fs');s(f.readFileSync('public/marketing/logo.svg'),{density:600}).resize({width:384,height:148,fit:'fill'}).flatten({background:'#F2F0ED'}).png({compressionLevel:9,palette:true}).toFile('public/marketing/logo-email.png')"
//
// O `alt` não é detalhe de acessibilidade só: imagem remota vem bloqueada por
// padrão em boa parte dos clientes, e o alt estilizado faz o cabeçalho cair
// exatamente no wordmark de texto que existia aqui antes. Nenhum cenário fica
// pior do que estava.
//
// A URL é absoluta porque e-mail não tem origem. Ela só existe depois que o
// APP for deployado (o Worker é quem serve /marketing/*): deployar as edge
// functions antes do app deixa a imagem em 404 até o app subir.
const LOGO_URL = "https://usepolia.com.br/marketing/logo-email.png";
const LOGO_LARGURA = 128;
const LOGO_ALTURA = 49;

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
                <p style="margin:8px 0 0;font-family:${FONTE_CORPO};font-size:12px;line-height:1.5;color:#6B6B6B;">
                  <a href="${descadastroUrl}" style="color:#6B6B6B;text-decoration:underline;">Não quero mais receber</a>
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
                <img src="${LOGO_URL}" width="${LOGO_LARGURA}" height="${LOGO_ALTURA}" alt="Pólia" style="display:block;border:0;outline:none;text-decoration:none;width:${LOGO_LARGURA}px;height:${LOGO_ALTURA}px;font-family:${FONTE_TITULO};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0A0A0A;" />
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
                <p style="margin:0;font-family:${FONTE_CORPO};font-size:12px;line-height:1.5;color:#6B6B6B;">
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
