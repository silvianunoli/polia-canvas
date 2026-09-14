import { describe, expect, it } from "vitest";
import { montarEmailManual } from "./email";
import { NOME_MANUAL_CURTO } from "./conteudo";

const DOWNLOAD = "https://usepolia.com.br/manual/baixar?t=3f2504e0-4f89-4d3a-9a0c-0305e82c3301";
const DESCADASTRO = "https://usepolia.com.br/descadastrar?t=11111111-2222-3333-4444-555555555555";

function montar() {
  return montarEmailManual({ downloadUrl: DOWNLOAD, descadastroUrl: DESCADASTRO });
}

describe("e-mail de entrega do manual", () => {
  it("leva o nome do manual no assunto", () => {
    expect(montar().subject).toBe(`Seu ${NOME_MANUAL_CURTO} chegou`);
  });

  // A tela promete que o PDF chega por e-mail. O link de download nas duas
  // versões é o cumprimento dessa frase.
  it("leva o link de download nas duas versões", () => {
    const { text, html } = montar();
    expect(text).toContain(DOWNLOAD);
    expect(html).toContain(`href="${DOWNLOAD}"`);
    expect(html).toContain("Baixar o manual");
  });

  // O consentimento diz "você sai quando quiser". Sem o link do rodapé, o
  // CONSENT_TEXTO_MANUAL vira promessa sem lastro.
  it("leva o link de descadastro nas duas versões", () => {
    const { text, html } = montar();
    expect(text).toContain(DESCADASTRO);
    expect(html).toContain(`href="${DESCADASTRO}"`);
    expect(html).toContain("Não quero mais receber");
  });

  it("assina só Pólia", () => {
    const { text, html } = montar();
    expect(text).toMatch(/\nPólia\n/);
    expect(html).not.toContain("Equipe Pólia");
  });

  // Forma da marca: sem travessão, sem exclamação, sem emoji, sem hype.
  it("respeita a forma da marca no assunto e no texto", () => {
    const { subject, text } = montar();
    for (const parte of [subject, text]) {
      expect(parte).not.toMatch(/[—–]/);
      expect(parte).not.toContain("!");
      expect(parte).not.toMatch(/[☀-➿\u{1F300}-\u{1FAFF}]/u);
      expect(parte.toLowerCase()).not.toMatch(/transform|revolucion/);
    }
  });

  it("usa a tipografia e o cinza do design system", () => {
    const { html } = montar();
    expect(html).toContain("Cabinet Grotesk");
    expect(html).not.toContain("Georgia");
    expect(html).toContain("#6B6B6B");
    expect(html).not.toContain("#767676");
  });
});
