import { describe, expect, it } from "vitest";
import {
  lembreteDeConfirmacao,
  lembreteDePreco,
  montarEmailConfirmacao,
  montarEmailPreco,
  type TipoLembrete,
} from "../../supabase/functions/_shared/lembretesConta.ts";
import { nichoDoAnuncio } from "../../supabase/functions/_shared/nichosAnuncio.ts";

const HORA = 60 * 60 * 1000;
const agora = new Date("2026-10-14T12:00:00Z");
const ha = (horas: number) => new Date(agora.getTime() - horas * HORA);
const nada = new Set<TipoLembrete>();

describe("lembreteDeConfirmacao", () => {
  it("nada antes de 1 hora", () => {
    expect(lembreteDeConfirmacao(ha(0.5), agora, nada)).toBeNull();
  });
  it("1h entre 1 e 24 horas, uma vez só", () => {
    expect(lembreteDeConfirmacao(ha(2), agora, nada)).toBe("confirmacao_1h");
    expect(lembreteDeConfirmacao(ha(2), agora, new Set(["confirmacao_1h"]))).toBeNull();
  });
  it("24h entre 24 horas e 7 dias, mesmo sem ter recebido o de 1h", () => {
    expect(lembreteDeConfirmacao(ha(30), agora, nada)).toBe("confirmacao_24h");
    expect(lembreteDeConfirmacao(ha(30), agora, new Set(["confirmacao_1h"]))).toBe(
      "confirmacao_24h",
    );
    expect(lembreteDeConfirmacao(ha(30), agora, new Set(["confirmacao_24h"]))).toBeNull();
  });
  it("nada depois de 7 dias", () => {
    expect(lembreteDeConfirmacao(ha(24 * 8), agora, nada)).toBeNull();
  });
});

describe("montarEmailConfirmacao", () => {
  it("leva o link no botão e no texto puro, sem travessão nem exclamação", () => {
    for (const tipo of ["confirmacao_1h", "confirmacao_24h"] as const) {
      const e = montarEmailConfirmacao(tipo, "https://exemplo.com/link?x=1");
      expect(e.texto).toContain("https://exemplo.com/link?x=1");
      expect(e.html).toContain("Confirmar e entrar");
      expect(`${e.assunto} ${e.texto}`).not.toMatch(/[—–!]/);
    }
  });
  it("assuntos diferentes pros dois lembretes", () => {
    expect(montarEmailConfirmacao("confirmacao_1h", "x").assunto).not.toBe(
      montarEmailConfirmacao("confirmacao_24h", "x").assunto,
    );
  });
});

describe("lembreteDePreco", () => {
  it("nada antes de 20 horas", () => {
    expect(lembreteDePreco(ha(19.9), agora, false)).toBeNull();
  });
  it("entre 20 e 72 horas, uma vez só", () => {
    expect(lembreteDePreco(ha(20), agora, false)).toBe("preco_d1");
    expect(lembreteDePreco(ha(50), agora, false)).toBe("preco_d1");
    expect(lembreteDePreco(ha(50), agora, true)).toBeNull();
  });
  it("nada a partir de 72 horas", () => {
    expect(lembreteDePreco(ha(72), agora, false)).toBeNull();
  });
});

describe("montarEmailPreco", () => {
  const ULTIMO = "Este é o único lembrete sobre isso.";
  const PRIMEIRO =
    "A conta na Pólia One está pronta, mas o primeiro preço ainda não foi calculado.";

  it("nicho de serviço fala da hora e abre a calculadora de serviço", () => {
    const e = montarEmailPreco(nichoDoAnuncio("N02-trancista"));
    expect(e.assunto).toBe("Trancista, ficou faltando a conta da sua hora");
    expect(e.html).toContain("A conta da sua hora ainda está em branco");
    expect(e.texto).toContain(
      "A calculadora junta o material e o seu tempo e mostra quanto a hora precisa valer pra fechar o mês. Leva uns 3 minutos.",
    );
    expect(e.texto).toContain("https://one.usepolia.com.br/calculadora?tipo=servico");
    expect(e.html).toContain("https://one.usepolia.com.br/calculadora?tipo=servico");
  });

  it("nicho de produto fala do produto e abre a calculadora de produto", () => {
    const e = montarEmailPreco(nichoDoAnuncio("N07-confeiteira"));
    expect(e.assunto).toBe("Confeiteira, ficou faltando a conta do seu produto");
    expect(e.html).toContain("A conta do seu produto ainda está em branco");
    expect(e.texto).toContain(
      "A calculadora junta material, embalagem e o seu tempo e mostra o preço que dá lucro de verdade. Leva uns 3 minutos.",
    );
    expect(e.texto).toContain("https://one.usepolia.com.br/calculadora?tipo=produto");
  });

  it("sem nicho, versão geral que leva pro Painel", () => {
    const e = montarEmailPreco(null);
    expect(e.assunto).toBe("Falta o primeiro preço na sua Pólia One");
    expect(e.html).toContain("O primeiro preço ainda está em branco");
    expect(e.texto).toContain(
      "A calculadora junta o custo real e o seu tempo e mostra o preço que dá lucro de verdade. Leva uns 3 minutos.",
    );
    expect(e.texto).toContain("https://one.usepolia.com.br/painel");
    expect(e.texto).not.toContain("calculadora?tipo");
  });

  it("todas as versões: mesmo primeiro e último parágrafo, botão, link normal e sem travessão nem exclamação", () => {
    for (const nicho of [nichoDoAnuncio("N17-designer"), nichoDoAnuncio("N18-papelaria"), null]) {
      const e = montarEmailPreco(nicho);
      expect(e.texto.startsWith(PRIMEIRO)).toBe(true);
      expect(e.texto).toContain(ULTIMO);
      expect(e.html).toContain("Quero calcular meu preço");
      expect(e.texto).not.toMatch(/token|magiclink|verify/i);
      expect(`${e.assunto} ${e.texto}`).not.toMatch(/[—–!]/);
    }
  });
});

describe("régua de ativação e do teste do Pro (GRW-66)", async () => {
  const { montarEmailRegua, TIPOS_REGUA, ehTipoRegua } =
    await import("../../supabase/functions/_shared/lembretesConta.ts");
  const antes = new Date("2026-10-20T12:00:00-03:00");
  const depois = new Date("2026-12-02T12:00:00-03:00");
  const fim = "2026-10-27T15:00:00Z";

  it("todos os tipos montam, sem travessão, exclamação nem promessa com você", () => {
    for (const tipo of TIPOS_REGUA) {
      const e = montarEmailRegua(tipo, { nome: "Ana", testeFim: fim, agora: antes });
      expect(e.assunto.length).toBeGreaterThan(5);
      expect(e.html).toContain("one.usepolia.com.br");
      expect(`${e.assunto} ${e.texto}`).not.toMatch(
        /[—–!]|você consegue|você merece|você vai|sobra/,
      );
    }
  });

  it("teste mostra a data do fim em dd/mm", () => {
    expect(
      montarEmailRegua("teste_fim_2d", { nome: null, testeFim: fim, agora: antes }).texto,
    ).toContain("27/10");
  });

  it("preço de fundadora só antes do prazo", () => {
    expect(
      montarEmailRegua("teste_acabou", { nome: null, testeFim: fim, agora: antes }).texto,
    ).toContain("fundadora");
    expect(
      montarEmailRegua("teste_acabou", { nome: null, testeFim: fim, agora: depois }).texto,
    ).not.toContain("fundadora");
  });

  it("dica leva o jeito de desligar; aviso de conta não", () => {
    expect(
      montarEmailRegua("guardar_d2", { nome: null, testeFim: null, agora: antes }).texto,
    ).toContain("desligar em Configurações");
    expect(
      montarEmailRegua("teste_fim_2d", { nome: null, testeFim: fim, agora: antes }).texto,
    ).not.toContain("desligar");
  });

  it("assunto com nome quando há nome", () => {
    expect(
      montarEmailRegua("guardar_d2", { nome: "Ana", testeFim: null, agora: antes }).assunto,
    ).toMatch(/^Ana, /);
  });

  it("tipo desconhecido não passa", () => {
    expect(ehTipoRegua("preco_d1")).toBe(false);
    expect(ehTipoRegua("teste_acabou")).toBe(true);
  });
});
