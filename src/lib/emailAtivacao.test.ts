import { describe, expect, it } from "vitest";
import {
  contextoDaAtivacao,
  cortesiaDoContexto,
  montarEmailAtivacao,
  montarEmailCortesiaContaExistente,
  nomeDoPlanoCortesia,
} from "../../supabase/functions/_shared/emailAtivacao.ts";

// Cortesia da campanha UGC (16/10/2026): quem entra por cupom de 100% não
// comprou nada, então o e-mail não pode dizer "Sua compra foi confirmada".
const LINK = "https://exemplo.com/auth/v1/verify?token=abc&type=invite";

describe("montarEmailAtivacao", () => {
  it("sem cortesia segue o e-mail de compra", () => {
    const e = montarEmailAtivacao(LINK);
    expect(e.assunto).toBe("Sua compra foi confirmada");
    expect(e.texto).toContain(LINK);
  });

  it("cortesia troca o assunto e não fala em compra", () => {
    const e = montarEmailAtivacao(LINK, { plano: "Pro", ate: "16/12/2026" });
    expect(e.assunto).toBe("Seu acesso ao Pro foi liberado");
    expect(e.texto).toContain(LINK);
    expect(e.texto).toContain("16/12/2026");
    expect(e.html).toContain("Criar minha senha");
    for (const t of [e.assunto, e.texto, e.html]) expect(t.toLowerCase()).not.toMatch(/compr/);
  });

  it("cortesia sem data não promete o fim sem cobrança", () => {
    const e = montarEmailAtivacao(LINK, { plano: null, ate: null });
    expect(e.assunto).toBe("Seu acesso foi liberado");
    expect(e.texto).not.toContain("cobrança");
  });

  it("sem travessão nem exclamação", () => {
    const e = montarEmailAtivacao(LINK, { plano: "Pro", ate: "16/12/2026" });
    const c = montarEmailCortesiaContaExistente("https://one.usepolia.com.br", {
      plano: "Pro",
      ate: "16/12/2026",
    });
    for (const t of [e.assunto, e.texto, c.assunto, c.texto]) {
      expect(t).not.toMatch(/[—–!]/);
    }
  });
});

describe("montarEmailCortesiaContaExistente", () => {
  it("leva pro login e não fala em compra", () => {
    const e = montarEmailCortesiaContaExistente("https://one.usepolia.com.br", {
      plano: "Premium",
      ate: null,
    });
    expect(e.assunto).toBe("Seu acesso ao Premium foi liberado");
    expect(e.texto).toContain("https://one.usepolia.com.br/auth/login");
    expect(e.texto.toLowerCase()).not.toMatch(/compr/);
  });
});

describe("contexto da fila de reenvio", () => {
  it("ida e volta guarda plano e data", () => {
    const c = { plano: "Pro", ate: "16/12/2026" };
    expect(contextoDaAtivacao(c)).toBe("e-mail de ativação (cortesia Pro até 16/12/2026)");
    expect(cortesiaDoContexto(contextoDaAtivacao(c))).toEqual(c);
    expect(cortesiaDoContexto(contextoDaAtivacao({ plano: null, ate: null }))).toEqual({
      plano: null,
      ate: null,
    });
  });

  it("ativação de compra continua com o contexto antigo e não vira cortesia", () => {
    expect(contextoDaAtivacao(null)).toBe("e-mail de ativação");
    expect(cortesiaDoContexto("e-mail de ativação")).toBeNull();
    expect(cortesiaDoContexto("e-mail de pagamento recusado")).toBeNull();
  });
});

describe("nomeDoPlanoCortesia", () => {
  it("chave interna vira nome visível", () => {
    expect(nomeDoPlanoCortesia("projete")).toBe("Pro");
    expect(nomeDoPlanoCortesia("controle")).toBe("Premium");
    expect(nomeDoPlanoCortesia(undefined)).toBeNull();
  });
});
