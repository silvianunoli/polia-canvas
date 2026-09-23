import { describe, it, expect } from "vitest";
import {
  NOME_MANUAL,
  NOME_MANUAL_CURTO,
  CONSENT_TEXTO_MANUAL,
  INSTAGRAM_URL,
  NOME_ARQUIVO_PDF,
} from "./conteudo";

describe("conteúdo do manual", () => {
  it("o nome completo é o curto com artigo na frente", () => {
    expect(NOME_MANUAL).toBe(`O ${NOME_MANUAL_CURTO}`);
  });

  // O perfil oficial é @hub.polia desde 14/09/2026; @usepolia está morto.
  it("o Instagram aponta pro perfil oficial @hub.polia", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/hub.polia/");
    expect(INSTAGRAM_URL).not.toContain("usepolia");
  });

  // Vai gravado em manual_leads.consent_texto: é o registro do que a pessoa aceitou.
  it("o texto de consentimento promete o manual, avisa dos e-mails e da saída fácil, sem hype", () => {
    expect(CONSENT_TEXTO_MANUAL).toMatch(/manual/i);
    expect(CONSENT_TEXTO_MANUAL).toMatch(/e-mails/i);
    expect(CONSENT_TEXTO_MANUAL).toMatch(/sai quando quiser/i);
    expect(CONSENT_TEXTO_MANUAL).not.toMatch(/[\u2014!]/);
  });

  it("o nome do arquivo é kebab-case sem acento e termina em .pdf", () => {
    expect(NOME_ARQUIVO_PDF).toMatch(/^[a-z0-9-]+\.pdf$/);
  });
});
