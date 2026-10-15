import { describe, expect, it } from "vitest";
import {
  CORTE_PRIMEIROS_PASSOS,
  businessTypeDaEscolha,
  contaCriadaDepoisDoCorte,
  contaVeBloco,
  escolhaDoBusinessType,
  hrefCalculadora,
  limparNomeMarca,
  mancheteDoBloco,
  mostraBloco,
  nichoDaConta,
  progressoPrimeirosPassos,
  textoPassoPreco,
  tipoPrecoDaBusca,
  tipoPrecoDaEscolha,
  PASSO_MODULO_1,
  PASSO_NOME,
  CTA_PRECO,
  ESCOLHAS_TIPO,
} from "./primeirosPassos";

const ANTES = "2026-10-14T23:59:59-03:00";
const DEPOIS = "2026-10-15T00:00:00-03:00";

describe("contaVeBloco (quem vê o bloco)", () => {
  it("o corte é 15/10/2026 à meia-noite de Brasília", () => {
    expect(Date.parse(CORTE_PRIMEIROS_PASSOS)).toBe(Date.parse("2026-10-15T03:00:00Z"));
  });

  it("conta criada a partir do corte vê, mesmo já marcada como concluída", () => {
    expect(
      contaVeBloco({ createdAt: DEPOIS, onboardingCompleted: true, onboardingCompletedAt: DEPOIS }),
    ).toBe(true);
  });

  it("conta antiga que já tinha feito o onboarding não vê (nada muda pra ela)", () => {
    expect(
      contaVeBloco({
        createdAt: "2026-09-01T10:00:00Z",
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-09-01T10:05:00Z",
      }),
    ).toBe(false);
    // Conta bem antiga, de antes da coluna onboarding_completed_at.
    expect(
      contaVeBloco({ createdAt: ANTES, onboardingCompleted: true, onboardingCompletedAt: null }),
    ).toBe(false);
  });

  it("conta antiga que ainda estava com onboarding pendente vê", () => {
    expect(
      contaVeBloco({ createdAt: ANTES, onboardingCompleted: false, onboardingCompletedAt: null }),
    ).toBe(true);
  });

  it("e continua vendo depois que o Painel marcou o onboarding (marca posterior ao corte)", () => {
    expect(
      contaVeBloco({
        createdAt: "2026-08-20T12:00:00Z",
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-10-16T09:00:00-03:00",
      }),
    ).toBe(true);
  });

  it("data inválida não conta como depois do corte", () => {
    expect(
      contaVeBloco({ createdAt: "lixo", onboardingCompleted: true, onboardingCompletedAt: "" }),
    ).toBe(false);
  });

  it("contaCriadaDepoisDoCorte serve pro skeleton antes da leitura", () => {
    expect(contaCriadaDepoisDoCorte(DEPOIS)).toBe(true);
    expect(contaCriadaDepoisDoCorte(ANTES)).toBe(false);
    expect(contaCriadaDepoisDoCorte(undefined)).toBe(false);
  });
});

describe("progressoPrimeirosPassos", () => {
  it("nada feito: destaque no preço", () => {
    const p = progressoPrimeirosPassos({ temPreco: false, modulo1Fechado: false, temNome: false });
    expect(p.destaque).toBe("preco");
    expect(p.totalFeitos).toBe(0);
    expect(p.completo).toBe(false);
  });

  it("o destaque desce pro próximo não feito", () => {
    expect(
      progressoPrimeirosPassos({ temPreco: true, modulo1Fechado: false, temNome: false }).destaque,
    ).toBe("modulo-1");
    expect(
      progressoPrimeirosPassos({ temPreco: true, modulo1Fechado: true, temNome: false }).destaque,
    ).toBe("nome");
  });

  it("feito fora de ordem não pula o primeiro pendente", () => {
    const p = progressoPrimeirosPassos({ temPreco: false, modulo1Fechado: true, temNome: true });
    expect(p.destaque).toBe("preco");
    expect(p.feitos).toEqual({ preco: false, "modulo-1": true, nome: true });
    expect(p.totalFeitos).toBe(2);
  });

  it("os três feitos: completo, sem destaque", () => {
    const p = progressoPrimeirosPassos({ temPreco: true, modulo1Fechado: true, temNome: true });
    expect(p.destaque).toBeNull();
    expect(p.completo).toBe(true);
  });
});

describe("mostraBloco", () => {
  const nova = { createdAt: DEPOIS, onboardingCompleted: true, onboardingCompletedAt: DEPOIS };
  it("some com os três feitos", () => {
    expect(mostraBloco(nova, { temPreco: true, modulo1Fechado: true, temNome: true })).toBe(false);
  });
  it("aparece enquanto falta um", () => {
    expect(mostraBloco(nova, { temPreco: true, modulo1Fechado: true, temNome: false })).toBe(true);
  });
  it("conta fora da regra nunca vê", () => {
    const antiga = { createdAt: ANTES, onboardingCompleted: true, onboardingCompletedAt: ANTES };
    expect(mostraBloco(antiga, { temPreco: false, modulo1Fechado: false, temNome: false })).toBe(
      false,
    );
  });
});

describe("tipo de negócio", () => {
  it("business_type salvo vira a pílula marcada", () => {
    expect(escolhaDoBusinessType("produto_fisico")).toBe("produto");
    expect(escolhaDoBusinessType("produto_digital")).toBe("produto");
    expect(escolhaDoBusinessType("servico")).toBe("servico");
    expect(escolhaDoBusinessType("hibrido")).toBe("os_dois");
    expect(escolhaDoBusinessType(null)).toBeNull();
    expect(escolhaDoBusinessType("outra")).toBeNull();
  });

  it("a escolha grava um valor que o check do banco aceita", () => {
    expect(businessTypeDaEscolha("produto")).toBe("produto_fisico");
    expect(businessTypeDaEscolha("servico")).toBe("servico");
    expect(businessTypeDaEscolha("os_dois")).toBe("hibrido");
  });

  it("Produto e Os dois abrem a aba Produto; Serviço abre a aba Serviço", () => {
    expect(hrefCalculadora(tipoPrecoDaEscolha("produto"))).toBe("/calculadora?tipo=produto");
    expect(hrefCalculadora(tipoPrecoDaEscolha("os_dois"))).toBe("/calculadora?tipo=produto");
    expect(hrefCalculadora(tipoPrecoDaEscolha("servico"))).toBe("/calculadora?tipo=servico");
  });

  it("?tipo= da URL é tolerante e ignora o inválido", () => {
    expect(tipoPrecoDaBusca("servico")).toBe("servico");
    expect(tipoPrecoDaBusca(" Produto ")).toBe("produto");
    expect(tipoPrecoDaBusca("serviço")).toBe("servico");
    expect(tipoPrecoDaBusca("encomenda")).toBeUndefined();
    expect(tipoPrecoDaBusca(3)).toBeUndefined();
    expect(tipoPrecoDaBusca(undefined)).toBeUndefined();
  });
});

describe("nichoDaConta", () => {
  it("lê o nicho do utm_content gravado no cadastro", () => {
    expect(nichoDaConta({ origem_campanha: { utm_content: "N02-trancista" } })).toEqual({
      pessoa: "Trancista",
      tipo: "servico",
    });
    expect(nichoDaConta({ origem_campanha: { utm_content: "N07-confeiteira" } })).toEqual({
      pessoa: "Confeiteira",
      tipo: "produto",
    });
  });

  it("sem anúncio de nicho é null", () => {
    expect(nichoDaConta(undefined)).toBeNull();
    expect(nichoDaConta({})).toBeNull();
    expect(nichoDaConta({ origem_campanha: { utm_content: "120212345678" } })).toBeNull();
    expect(nichoDaConta({ origem_campanha: { utm_content: 42 } })).toBeNull();
  });
});

describe("textos", () => {
  it("passo do preço por nicho e sem nicho", () => {
    expect(textoPassoPreco({ pessoa: "Trancista", tipo: "servico" })).toEqual({
      titulo: "Calcular o preço da sua hora",
      subtitulo: "Material e o seu tempo. Uns 3 minutos.",
      perguntaTipo: false,
    });
    expect(textoPassoPreco({ pessoa: "Confeiteira", tipo: "produto" })).toEqual({
      titulo: "Calcular o preço de um produto",
      subtitulo: "Material, embalagem e o seu tempo. Uns 3 minutos.",
      perguntaTipo: false,
    });
    expect(textoPassoPreco(null)).toEqual({
      titulo: "Calcular o primeiro preço",
      subtitulo: "A sua marca vende o quê?",
      perguntaTipo: true,
    });
  });

  it("manchete por nicho e sem nicho", () => {
    expect(mancheteDoBloco({ pessoa: "Trancista", tipo: "servico" })).toBe(
      "Trancista, o preço da sua hora começa por aqui.",
    );
    expect(mancheteDoBloco({ pessoa: "Papelaria personalizada", tipo: "produto" })).toBe(
      "Papelaria personalizada, o preço do seu produto começa por aqui.",
    );
    expect(mancheteDoBloco(null)).toBe("Três passos e o Painel começa a mostrar o seu mês.");
  });

  it("nome da marca: sem espaço nas pontas e até 60 caracteres", () => {
    expect(limparNomeMarca("  Ateliê da Ana  ")).toBe("Ateliê da Ana");
    expect(limparNomeMarca("a".repeat(80))).toHaveLength(60);
    expect(limparNomeMarca("   ")).toBe("");
  });

  it("copy sem travessão, exclamação nem emoji; CTA começa por Quero", () => {
    const textos = [
      mancheteDoBloco(null),
      mancheteDoBloco({ pessoa: "Trancista", tipo: "servico" }),
      ...Object.values(textoPassoPreco(null)).filter((v) => typeof v === "string"),
      ...Object.values(textoPassoPreco({ pessoa: "X", tipo: "servico" })).filter(
        (v) => typeof v === "string",
      ),
      PASSO_MODULO_1.titulo,
      PASSO_MODULO_1.subtitulo,
      PASSO_MODULO_1.acao,
      PASSO_NOME.titulo,
      PASSO_NOME.subtitulo,
      CTA_PRECO,
      ...ESCOLHAS_TIPO.map((e) => e.rotulo),
    ] as string[];
    for (const t of textos) expect(t, t).not.toMatch(/[—–!]|\p{Extended_Pictographic}/u);
    expect(CTA_PRECO.startsWith("Quero")).toBe(true);
    expect(PASSO_MODULO_1.acao.startsWith("Quero")).toBe(true);
  });
});
