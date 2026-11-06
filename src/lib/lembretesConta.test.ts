import { describe, expect, it } from "vitest";
import {
  lembreteDeConfirmacao,
  montarEmailConfirmacao,
  type TipoLembrete,
} from "../../supabase/functions/_shared/lembretesConta.ts";

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

  it("fim do teste leva o texto aprovado, abre o Premium e não fala de preço (PAY-51)", () => {
    for (const tipo of ["teste_fim_2d", "teste_acabou"] as const) {
      const e = montarEmailRegua(tipo, { nome: null, testeFim: fim, agora: antes });
      expect(e.texto).toContain("Quero assinar o Premium: https://one.usepolia.com.br/assinar?plano=controle");
      expect(e.texto).not.toMatch(/fundadora|R\$|30\/11|01\/12/);
    }
  });

  it("dica leva o jeito de desligar; aviso de conta não", () => {
    expect(
      montarEmailRegua("guardar_d2", { nome: null, testeFim: null, agora: antes }).texto,
    ).toContain("desligar em Configurações");
    expect(
      montarEmailRegua("teste_fim_2d", { nome: null, testeFim: fim, agora: antes }).texto,
    ).not.toContain("desligar");
  });

  it("guardar_d2 leva o texto aprovado e abre o quadro de Pedidos (ONE-175)", () => {
    const e = montarEmailRegua("guardar_d2", { nome: "Ana", testeFim: null, agora: antes });
    expect(e.assunto).toBe("A próxima encomenda já pode entrar no quadro");
    expect(e.texto).toContain(
      "O quadro de Pedidos está pronto na sua conta. Cadastre o produto da próxima encomenda e lance o pedido com o dia da entrega.",
    );
    expect(e.texto).toContain(
      "A partir daí, a Pólia One mostra o que tem pra hoje e pra amanhã, quem já pagou e quanto cada encomenda lucra.",
    );
    expect(e.texto).toContain("Quero lançar a encomenda: https://one.usepolia.com.br/pedidos");
  });

  it("segundo_passo_d4 fala da entrega e abre o quadro de Pedidos (ONE-175)", () => {
    const e = montarEmailRegua("segundo_passo_d4", { nome: null, testeFim: null, agora: antes });
    expect(e.assunto).toBe("Agora que a encomenda está no quadro");
    expect(e.html).toContain("O passo seguinte é a entrega");
    expect(e.texto).toContain(
      "Quero abrir o quadro de Pedidos: https://one.usepolia.com.br/pedidos",
    );
  });

  it("os dois e-mails de ativação não falam de preço, meta nem Calculadora (ONE-175)", () => {
    for (const tipo of ["guardar_d2", "segundo_passo_d4"] as const) {
      const e = montarEmailRegua(tipo, { nome: null, testeFim: null, agora: antes });
      expect(`${e.assunto} ${e.texto}`, tipo).not.toMatch(/preço|meta|calculadora/i);
    }
  });

  it("tipo desconhecido não passa", () => {
    expect(ehTipoRegua("preco_d1")).toBe(false);
    expect(ehTipoRegua("teste_acabou")).toBe(true);
  });

  it("o lembrete do Planejamento saiu junto com ele (31/10/2026)", () => {
    expect(ehTipoRegua("modulo_d7")).toBe(false);
    for (const tipo of TIPOS_REGUA) {
      const e = montarEmailRegua(tipo, { nome: null, testeFim: fim, agora: antes });
      expect(`${e.assunto} ${e.texto}`, tipo).not.toMatch(/Planejamento|módulo/i);
    }
  });
});
