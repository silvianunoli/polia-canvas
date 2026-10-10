import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FOTOS_NICHOS, nichoDaCampanha } from "./nichosLanding";

describe("nichoDaCampanha", () => {
  it("devolve o topo do nicho pelo utm_content do anúncio", () => {
    const n = nichoDaCampanha("N07-confeiteira");
    expect(n?.titulo).toBe("Confeiteira, você sabe quanto cobrar pelo bolo de pote?");
    expect(n?.foto).toBe("nicho-confeiteira");
  });

  it("tolera espaço em volta", () => {
    expect(nichoDaCampanha(" N19-croche ")?.rotulo).toBe("Crochê");
  });

  it("sem utm_content ou com valor desconhecido mostra o topo padrão (null)", () => {
    expect(nichoDaCampanha(undefined)).toBeNull();
    expect(nichoDaCampanha("")).toBeNull();
    expect(nichoDaCampanha("N13-costureira")).toBeNull();
    expect(nichoDaCampanha("120212345678")).toBeNull();
  });

  it("cobre os 20 anúncios da campanha, cada um com foto própria", () => {
    expect(FOTOS_NICHOS).toHaveLength(20);
    expect(new Set(FOTOS_NICHOS).size).toBe(20);
  });

  it("toda foto de nicho existe em public/marketing/landing nos 3 tamanhos", () => {
    const pasta = resolve(__dirname, "../../public/marketing/landing");
    for (const foto of FOTOS_NICHOS) {
      for (const sufixo of [".jpg", "-640.webp", "-1080.webp"]) {
        expect(existsSync(resolve(pasta, `${foto}${sufixo}`)), `${foto}${sufixo}`).toBe(true);
      }
    }
  });

  it("copy sem travessão, sem exclamação e sem emoji", () => {
    const todos = [
      "N01-nail", "N02-trancista", "N03-lash", "N04-cabeleireira", "N05-esteticista",
      "N06-maquiadora", "N07-confeiteira", "N08-doceira", "N09-marmita", "N10-salgadeira",
      "N11-loja-roupa", "N12-cosmeticos", "N14-social-media", "N15-psicologa",
      "N16-nutricionista", "N17-designer", "N18-papelaria", "N19-croche", "N20-saboaria",
      "N21-fotografa",
    ];
    for (const id of todos) {
      const n = nichoDaCampanha(id);
      expect(n, id).not.toBeNull();
      const texto = `${n!.rotulo} ${n!.titulo} ${n!.subtitulo}`;
      expect(texto, id).not.toMatch(/[—–!]|\p{Extended_Pictographic}/u);
    }
  });
});
