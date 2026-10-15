import { describe, expect, it } from "vitest";
import { CHAVES_NICHOS, nichoDaCampanha } from "./nichosLanding";
import { NICHOS_ANUNCIO, nichoDoAnuncio } from "../../supabase/functions/_shared/nichosAnuncio.ts";

// O e-mail do dia seguinte (edge function) lê uma cópia do nicho de cada
// anúncio. Este teste segura as duas cópias juntas.
describe("nichosAnuncio bate com nichosLanding", () => {
  it("mesmas chaves", () => {
    expect(Object.keys(NICHOS_ANUNCIO).sort()).toEqual([...CHAVES_NICHOS].sort());
  });

  it("mesma pessoa e mesmo tipo em cada anúncio", () => {
    for (const chave of CHAVES_NICHOS) {
      const landing = nichoDaCampanha(chave);
      expect(landing, chave).not.toBeNull();
      expect(NICHOS_ANUNCIO[chave], chave).toEqual({
        pessoa: landing!.pessoa,
        tipo: landing!.tipo,
      });
    }
  });

  it("são os 20 anúncios da campanha", () => {
    expect(CHAVES_NICHOS).toHaveLength(20);
  });
});

describe("nichoDoAnuncio", () => {
  it("acha pelo utm_content, com espaço em volta", () => {
    expect(nichoDoAnuncio(" N02-trancista ")).toEqual({ pessoa: "Trancista", tipo: "servico" });
  });
  it("null sem utm_content ou com um que não é de nicho", () => {
    expect(nichoDoAnuncio(null)).toBeNull();
    expect(nichoDoAnuncio(undefined)).toBeNull();
    expect(nichoDoAnuncio("")).toBeNull();
    expect(nichoDoAnuncio("abertura-orcamento")).toBeNull();
    expect(nichoDoAnuncio("toString")).toBeNull();
  });
});
