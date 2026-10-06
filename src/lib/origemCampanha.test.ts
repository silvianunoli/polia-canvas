import { describe, expect, it } from "vitest";
import {
  campoDeBusca,
  consumirOrigemDoOAuth,
  guardarOrigemParaOAuth,
  lerOrigemCampanha,
  lerUtms,
  lerUtmsDaQuery,
  temOrigemCampanha,
} from "./origemCampanha";

describe("lerOrigemCampanha", () => {
  it("lê origem e as cinco UTMs válidas", () => {
    expect(
      lerOrigemCampanha({
        origem: "landing-a",
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "abertura-out26",
        utm_content: "criativo.07",
        utm_term: "orcamento",
      }),
    ).toEqual({
      origem: "landing-a",
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "abertura-out26",
      utm_content: "criativo.07",
      utm_term: "orcamento",
    });
  });

  it("descarta valor com caractere fora da allowlist em vez de sanear", () => {
    expect(
      lerOrigemCampanha({
        origem: "<script>",
        utm_source: 'meta"ads',
        utm_campaign: "a".repeat(101),
        utm_content: "linha\nquebrada",
        utm_medium: "cpc",
      }),
    ).toEqual({ utm_medium: "cpc" });
  });

  it("aceita nome de campanha do Meta com espaço, acento e barra vertical", () => {
    expect(lerOrigemCampanha({ utm_campaign: "Abertura | Orçamento 09/10" })).toEqual({
      utm_campaign: "Abertura | Orçamento 09/10",
    });
  });

  it("transforma número e booleano (JSON.parse do router) em texto", () => {
    expect(lerOrigemCampanha({ utm_content: 120212345678, utm_term: true })).toEqual({
      utm_content: "120212345678",
      utm_term: "true",
    });
  });

  it("ignora chave que não é de campanha e valor que não é texto", () => {
    expect(
      lerOrigemCampanha({ email: "x@y.com", utm_source: { a: 1 }, utm_term: null, plano: "pro" }),
    ).toEqual({});
  });

  it("apara espaço nas pontas", () => {
    expect(lerOrigemCampanha({ origem: "  landing-b " })).toEqual({ origem: "landing-b" });
  });
});

describe("lerUtms", () => {
  it("não devolve a origem, só UTMs", () => {
    expect(lerUtms({ origem: "landing-a", utm_source: "meta" })).toEqual({ utm_source: "meta" });
  });
});

describe("lerUtmsDaQuery", () => {
  it("preserva ID de anúncio longo sem perder dígito", () => {
    expect(lerUtmsDaQuery("?utm_content=120212345678901234&utm_source=meta&x=1")).toEqual({
      utm_content: "120212345678901234",
      utm_source: "meta",
    });
  });
});

describe("campoDeBusca", () => {
  it("nunca lança: número vira texto, objeto vira undefined", () => {
    expect(campoDeBusca.parse(123)).toBe("123");
    expect(campoDeBusca.parse({ a: 1 })).toBeUndefined();
    expect(campoDeBusca.parse(undefined)).toBeUndefined();
  });
});

describe("guardarOrigemParaOAuth / consumirOrigemDoOAuth", () => {
  it("guarda, devolve uma vez e apaga", () => {
    guardarOrigemParaOAuth({ origem: "landing-a", utm_source: "meta" });
    expect(consumirOrigemDoOAuth()).toEqual({ origem: "landing-a", utm_source: "meta" });
    expect(consumirOrigemDoOAuth()).toBeNull();
  });

  it("não guarda nada quando não há origem", () => {
    guardarOrigemParaOAuth({});
    expect(consumirOrigemDoOAuth()).toBeNull();
  });
});

describe("temOrigemCampanha", () => {
  it("é falso para objeto vazio e verdadeiro com qualquer chave", () => {
    expect(temOrigemCampanha({})).toBe(false);
    expect(temOrigemCampanha({ utm_source: "meta" })).toBe(true);
  });
});
