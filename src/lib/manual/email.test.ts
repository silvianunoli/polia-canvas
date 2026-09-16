import { describe, expect, it } from "vitest";
import { CTA_EMAIL_MANUAL, TAGLINE_MANUAL, montarEmailManual } from "./email";
import { NOME_MANUAL_CURTO } from "./conteudo";

const DOWNLOAD = "https://usepolia.com.br/manual/baixar?t=3f2504e0-4f89-4d3a-9a0c-0305e82c3301";
const DESCADASTRO = "https://usepolia.com.br/descadastrar?t=11111111-2222-3333-4444-555555555555";

function montar() {
  return montarEmailManual({ downloadUrl: DOWNLOAD, descadastroUrl: DESCADASTRO });
}

describe("e-mail de entrega do manual", () => {
  it("leva o nome do manual no assunto e a chegada como título", () => {
    const { subject, html } = montar();
    expect(subject).toBe(`Seu ${NOME_MANUAL_CURTO} chegou`);
    expect(html).toContain(`Seu ${NOME_MANUAL_CURTO} chegou.`);
  });

  // A tela promete que o PDF chega por e-mail. O link de download nas duas
  // versões é o cumprimento dessa frase, e o rótulo do botão é decisão da
  // fundadora (14/09/2026): "Baixar meu manual", nunca "Baixar o manual".
  it("leva o link de download nas duas versões, no botão pedido", () => {
    const { text, html } = montar();
    expect(text).toContain(DOWNLOAD);
    expect(html).toContain(`href="${DOWNLOAD}"`);
    expect(html).toContain(CTA_EMAIL_MANUAL);
    expect(CTA_EMAIL_MANUAL).toBe("Baixar meu manual");
  });

  // O consentimento diz "você sai quando quiser". Sem o link do rodapé, o
  // CONSENT_TEXTO_MANUAL vira promessa sem lastro.
  it("leva o link de descadastro nas duas versões", () => {
    const { text, html } = montar();
    expect(text).toContain(DESCADASTRO);
    expect(html).toContain(`href="${DESCADASTRO}"`);
    expect(html).toContain("Não quero mais receber");
    expect(html).toContain("usepolia.com.br");
  });

  // Copy final de 16/09/2026, revisada de novo no mesmo dia (auditoria dos 12
  // transacionais): a citação de campanha ("Grandes marcas não começam
  // grandes...") já tinha saído por soar tagline, não entrega do material.
  // A saudação "Bom dia, Ana." saiu na segunda revisão -- Ana é a persona
  // interna do produto, não o nome de quem baixou o manual de verdade, e o
  // e-mail vai pra qualquer lead. Corpo abre direto pelo fato, segue pro
  // botão, fecha com a assinatura.
  it("segue a narrativa pedida: fato do manual antes do botão, assinatura depois", () => {
    const { html } = montar();
    const fato = html.indexOf("O manual chegou.");
    const botao = html.indexOf(`href="${DOWNLOAD}"`);
    const assinatura = html.indexOf(TAGLINE_MANUAL);
    expect(fato).toBeGreaterThan(0);
    expect(botao).toBeGreaterThan(fato);
    expect(assinatura).toBeGreaterThan(botao);
    expect(html).not.toContain("Bom dia, Ana.");
    expect(html).not.toContain("Começam com intenção.");
    expect(html).not.toContain("Equipe Pólia");
  });

  // Forma da marca: sem travessão, sem exclamação, sem símbolo, sem hype, e
  // "você" nunca como sujeito de capacidade ou futuro prometido.
  it("respeita a forma da marca no assunto e no texto", () => {
    const { subject, text } = montar();
    for (const parte of [subject, text]) {
      expect(parte).not.toMatch(/[—–✦]/);
      expect(parte).not.toContain("!");
      expect(parte.toLowerCase()).not.toMatch(/transform|revolucion/);
      expect(parte).not.toMatch(
        /você (não )?(precisa|pode|consegue|merece|vai (longe|conseguir))/i,
      );
    }
  });

  // Decisão visual de 14/09/2026: o amarelo é o único destaque desta peça e o
  // turquesa fica de fora. Cinza do rodapé continua o que passa AA.
  it("usa o layout editorial: amarelo no botão, sem turquesa, tokens só", () => {
    const { html } = montar();
    expect(html).toContain("#FFC629");
    expect(html).not.toContain("#7CCBCD");
    expect(html).toContain("Cabinet Grotesk");
    expect(html).not.toMatch(/Georgia|Times New Roman|Fraunces|(?<!sans-)serif/);
    const hexes = [...new Set((html.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((h) => h.toUpperCase()))];
    expect(hexes.sort()).toEqual(
      ["#0A0A0A", "#2C2C2C", "#6B6B6B", "#E6E6E6", "#F2F0ED", "#FFC629", "#FFFFFF"].sort(),
    );
  });
});
