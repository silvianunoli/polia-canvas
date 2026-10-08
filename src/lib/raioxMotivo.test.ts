import { describe, it, expect } from "vitest";
import {
  LIMITE_RAIOX_MENSAL,
  avisoDoMotivoRaioX,
  nomeDoMesDoPeriodo,
  planoGeraRaioX,
  quandoLiberaRaioX,
  restantesRaioX,
  textoLimiteAtingidoRaioX,
  textoRestantesRaioX,
  textoUltimaGeracaoRaioX,
  type MotivoRaioX,
} from "./raioxMotivo";

describe("limite visível do raio-x", () => {
  it("restantes: limite menos usado, sem passar de 0 nem do limite", () => {
    expect(restantesRaioX(0)).toBe(3);
    expect(restantesRaioX(1)).toBe(2);
    expect(restantesRaioX(2)).toBe(1);
    expect(restantesRaioX(3)).toBe(0);
    expect(restantesRaioX(7)).toBe(0);
    expect(restantesRaioX(-2)).toBe(3);
    expect(restantesRaioX(Number.NaN)).toBe(3);
    expect(restantesRaioX(1, 5)).toBe(4);
  });

  it("quando libera: dia 1º do mês seguinte, dezembro vira janeiro", () => {
    expect(quandoLiberaRaioX("2026-10")).toBe("1º de novembro");
    expect(quandoLiberaRaioX("2026-12")).toBe("1º de janeiro");
    expect(quandoLiberaRaioX("2026-02")).toBe("1º de março");
    expect(quandoLiberaRaioX("lixo")).toBeNull();
    expect(quandoLiberaRaioX("2026-13")).toBeNull();
    expect(nomeDoMesDoPeriodo("2026-03")).toBe("março");
  });

  it("texto de restantes no formato pedido pela Sil", () => {
    expect(textoRestantesRaioX(2, "2026-10")).toBe("Restam 2 de 3 gerações do raio-x em outubro.");
    expect(textoRestantesRaioX(3, "2026-10")).toBe("Restam 3 de 3 gerações do raio-x em outubro.");
    expect(textoRestantesRaioX(1, "2026-10")).toBe("Resta 1 de 3 gerações do raio-x em outubro.");
  });

  it("sem restante, o texto de restantes vira o de limite atingido", () => {
    expect(textoRestantesRaioX(0, "2026-10")).toBe(textoLimiteAtingidoRaioX("2026-10"));
  });

  it("aviso da última geração", () => {
    expect(textoUltimaGeracaoRaioX("2026-10")).toBe(
      "Essa é a última geração do raio-x deste mês. A próxima libera em 1º de novembro.",
    );
  });

  it("limite atingido diz quando libera", () => {
    expect(textoLimiteAtingidoRaioX("2026-10")).toBe(
      "As 3 gerações do raio-x de outubro já foram usadas. A próxima libera em 1º de novembro.",
    );
  });

  it("período estragado não quebra o texto", () => {
    expect(textoRestantesRaioX(2, "")).toBe("Restam 2 de 3 gerações do raio-x neste mês.");
    expect(textoUltimaGeracaoRaioX("")).toContain("dia 1º do mês que vem");
    expect(textoLimiteAtingidoRaioX("")).toContain("deste mês");
  });

  it("nenhum texto do limite tem travessão nem exclamação", () => {
    const textos = [
      textoRestantesRaioX(2, "2026-10"),
      textoRestantesRaioX(1, "2026-12"),
      textoUltimaGeracaoRaioX("2026-12"),
      textoLimiteAtingidoRaioX("2026-12"),
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–!]/);
  });
});

describe("planoGeraRaioX (QA-30)", () => {
  it("Pro e beta geram; Grátis, Premium, cancelada e sem plano não", () => {
    expect(planoGeraRaioX("projete")).toBe(true);
    expect(planoGeraRaioX("beta")).toBe(true);
    expect(planoGeraRaioX("controle")).toBe(false);
    expect(planoGeraRaioX("confere")).toBe(false);
    expect(planoGeraRaioX("cancelada")).toBe(false);
    expect(planoGeraRaioX(null)).toBe(false);
    expect(planoGeraRaioX(undefined)).toBe(false);
  });
});

describe("avisoDoMotivoRaioX (QA-30)", () => {
  const motivos: MotivoRaioX[] = [
    "manutencao",
    "teto_atingido",
    "falha_ia",
    "dado_insuficiente",
    "mes_nao_fechado",
    "plano_insuficiente",
  ];

  it("todo motivo tem texto, sem travessão nem exclamação", () => {
    for (const m of motivos) {
      const t = avisoDoMotivoRaioX(m);
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(/[—–!]/);
    }
  });

  it("o teto escreve o limite", () => {
    expect(avisoDoMotivoRaioX("teto_atingido")).toContain(String(LIMITE_RAIOX_MENSAL));
  });
});
