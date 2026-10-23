import { describe, expect, it } from "vitest";
import { NICHOS } from "./bancoIdeias";
import { CHAVES_NICHOS, nichoDaCampanha } from "./nichosLanding";
import {
  ESCOLHAS_NICHO,
  businessTypeDoNicho,
  nichoDoBanco,
  nichoNegocioDoAnuncio,
} from "./nichoNegocio";

describe("ESCOLHAS_NICHO", () => {
  it("são os nichos do banco de ideias, na mesma ordem, mais o outro no fim", () => {
    const semOutro = ESCOLHAS_NICHO.slice(0, -1);
    expect(semOutro.map((n) => [n.valor, n.rotulo, n.exemplos])).toEqual(
      NICHOS.map((n) => [n.chave, n.nome, n.exemplos]),
    );
    expect(ESCOLHAS_NICHO.at(-1)?.valor).toBe("outro");
  });
});

describe("nichoDoBanco", () => {
  it("aceita só as chaves conhecidas", () => {
    expect(nichoDoBanco("comida")).toBe("comida");
    expect(nichoDoBanco("outro")).toBe("outro");
    expect(nichoDoBanco("pet")).toBeNull();
    expect(nichoDoBanco(null)).toBeNull();
  });
});

describe("businessTypeDoNicho", () => {
  it("o nicho já diz o tipo, menos o outro", () => {
    expect(businessTypeDoNicho("bemestar")).toBe("servico");
    expect(businessTypeDoNicho("servicos")).toBe("servico");
    expect(businessTypeDoNicho("digital")).toBe("produto_digital");
    expect(businessTypeDoNicho("comida")).toBe("produto_fisico");
    expect(businessTypeDoNicho("outro")).toBeNull();
  });
});

describe("nichoNegocioDoAnuncio", () => {
  it("mapeia só anúncios que existem", () => {
    for (const chave of ["N01-nail", "N07-confeiteira", "N18-papelaria", "N21-fotografa"]) {
      expect(CHAVES_NICHOS).toContain(chave);
      expect(nichoNegocioDoAnuncio(chave)).not.toBeNull();
    }
  });
  it("null pro que fica em dúvida, pro desconhecido e pro nome de método", () => {
    expect(nichoNegocioDoAnuncio("N15-psicologa")).toBeNull();
    expect(nichoNegocioDoAnuncio("abc")).toBeNull();
    expect(nichoNegocioDoAnuncio("toString")).toBeNull();
    expect(nichoNegocioDoAnuncio(undefined)).toBeNull();
  });
  it("o tipo do nicho bate com o tipo do anúncio", () => {
    for (const chave of CHAVES_NICHOS) {
      const n = nichoNegocioDoAnuncio(chave);
      if (!n) continue;
      const t = businessTypeDoNicho(n);
      expect(t === "servico" ? "servico" : "produto", chave).toBe(nichoDaCampanha(chave)!.tipo);
    }
  });
});
