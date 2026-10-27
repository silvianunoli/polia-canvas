import { describe, it, expect } from "vitest";
import { resumoDoPlano, valorDoPlano } from "./planos";

describe("resumoDoPlano (PAY-31: o diálogo de pagamento diz plano e preço)", () => {
  it("monta plano, preço e ciclo", () => {
    expect(resumoDoPlano("controle_mensal")).toBe("Premium, R$ 29,90 por mês");
    expect(resumoDoPlano("controle_anual")).toBe("Premium, R$ 299,00 por ano");
    expect(resumoDoPlano("projete_mensal")).toBe("Pro, R$ 47,90 por mês");
    expect(resumoDoPlano("projete_anual")).toBe("Pro, R$ 479,00 por ano");
  });

  it("chave desconhecida não inventa texto", () => {
    expect(resumoDoPlano("confere")).toBeNull();
    expect(resumoDoPlano(null)).toBeNull();
  });
});
import {
  ehBeta,
  ehRotaProjete,
  recursoLiberado,
  rotaLiberada,
  temProjete,
  tierDoPlano,
  tierMinimoDaRota,
  tierPagoDaRota,
} from "./planos";

describe("tierDoPlano", () => {
  it("mapeia os pagos pro tier controle", () => {
    expect(tierDoPlano("controle")).toBe("controle");
    expect(tierDoPlano("projete")).toBe("controle");
  });

  it("cai em confere pro gratuito, cancelado e desconhecido", () => {
    expect(tierDoPlano("confere")).toBe("confere");
    expect(tierDoPlano("cancelada")).toBe("confere");
    expect(tierDoPlano(null)).toBe("confere");
    expect(tierDoPlano("valor-que-nao-existe")).toBe("confere");
  });
});

describe("tierMinimoDaRota", () => {
  it("nega por padrão: rota não listada exige controle", () => {
    expect(tierMinimoDaRota("/rota-inventada")).toBe("controle");
  });

  it("casa prefixo com subrota, mas não com nome parecido", () => {
    expect(tierMinimoDaRota("/planejamento/modulo/3")).toBe("confere");
    expect(tierMinimoDaRota("/planejamentos-secretos")).toBe("controle");
  });
});

describe("rotaLiberada", () => {
  it("libera tudo pra beta", () => {
    expect(rotaLiberada("/financeiro", "beta")).toBe(true);
  });

  it("libera rota confere pra todo mundo", () => {
    expect(rotaLiberada("/painel", "confere")).toBe(true);
    expect(rotaLiberada("/planejamento", null)).toBe(true);
  });

  it("bloqueia rota paga no confere", () => {
    expect(rotaLiberada("/financeiro", "confere")).toBe(false);
    expect(rotaLiberada("/clientes", "cancelada")).toBe(false);
  });

  // COPY-03 (03/09/2026): o card do Confere promete "até 3 metas acompanhadas".
  // Enquanto /metas exigia Controle, a promessa entregava zero.
  it("abre /metas no confere, que é o que a landing promete", () => {
    expect(rotaLiberada("/metas", "confere")).toBe(true);
    expect(recursoLiberado("/metas", "confere")).toBe(true);
    expect(tierMinimoDaRota("/metas")).toBe("confere");
  });

  // A Calculadora virou ferramenta própria e abre no plano Grátis: calcular não
  // gasta cota, só guardar como produto (cota do catálogo, em /produtos).
  it("abre /calculadora no confere", () => {
    expect(rotaLiberada("/calculadora", "confere")).toBe(true);
    expect(recursoLiberado("/calculadora", "confere")).toBe(true);
    expect(tierMinimoDaRota("/calculadora")).toBe("confere");
  });

  // COPY-04 (03/09/2026): o registro de entrada/saída abriu pro Confere por um
  // modal no Painel, mas a TELA /financeiro (histórico, filtros, os três
  // números do mês, resumo pro contador) segue sendo do Controle.
  it("mantém a tela /financeiro fechada no confere mesmo com o registro aberto", () => {
    expect(rotaLiberada("/financeiro", "confere")).toBe(false);
    expect(recursoLiberado("/financeiro", "confere")).toBe(false);
    expect(tierMinimoDaRota("/financeiro")).toBe("controle");
  });
});

describe("temProjete", () => {
  it("vale pro projete e pro beta", () => {
    expect(temProjete("projete")).toBe(true);
    expect(temProjete("beta")).toBe(true);
  });

  it("não vale pro controle nem pro confere", () => {
    expect(temProjete("controle")).toBe(false);
    expect(temProjete("confere")).toBe(false);
    expect(temProjete(null)).toBe(false);
  });
});

describe("ehRotaProjete", () => {
  it("reconhece as três rotas exclusivas, inclusive subrota", () => {
    expect(ehRotaProjete("/raiox")).toBe(true);
    expect(ehRotaProjete("/projecao")).toBe(true);
    expect(ehRotaProjete("/plano-conteudo")).toBe(true);
    expect(ehRotaProjete("/raiox/2026-07")).toBe(true);
  });

  it("não pega rota de Controle", () => {
    expect(ehRotaProjete("/financeiro")).toBe(false);
    expect(ehRotaProjete("/painel")).toBe(false);
  });
});

describe("recursoLiberado", () => {
  // Este bloco existe por causa de um bug real: a barra lateral usava só a
  // trava de rota, e como Raio-x/Projeção/Plano de conteúdo são tier "controle",
  // a usuária do Controle via os três SEM cadeado e só descobria que eram pagos
  // depois de clicar e bater no portão de dentro da página.
  it("nega rota Projete pra quem está no Controle, mesmo a rota passando no guard", () => {
    expect(rotaLiberada("/raiox", "controle")).toBe(true);
    expect(recursoLiberado("/raiox", "controle")).toBe(false);
    expect(recursoLiberado("/projecao", "controle")).toBe(false);
    expect(recursoLiberado("/plano-conteudo", "controle")).toBe(false);
  });

  it("libera rota Projete pro projete e pro beta", () => {
    expect(recursoLiberado("/raiox", "projete")).toBe(true);
    expect(recursoLiberado("/raiox", "beta")).toBe(true);
  });

  it("mantém o comportamento das demais rotas", () => {
    expect(recursoLiberado("/painel", "confere")).toBe(true);
    expect(recursoLiberado("/financeiro", "confere")).toBe(false);
    expect(recursoLiberado("/financeiro", "controle")).toBe(true);
  });

  it("no confere a rota Projete é barrada já pelo tier", () => {
    expect(recursoLiberado("/raiox", "confere")).toBe(false);
  });
});

describe("tierPagoDaRota", () => {
  it("nomeia o plano certo pra tela de upgrade", () => {
    expect(tierPagoDaRota("/raiox")).toBe("projete");
    expect(tierPagoDaRota("/financeiro")).toBe("controle");
  });
});

describe("ehBeta", () => {
  it("só o literal beta", () => {
    expect(ehBeta("beta")).toBe(true);
    expect(ehBeta("Beta")).toBe(false);
    expect(ehBeta(undefined)).toBe(false);
  });
});

describe("valorDoPlano", () => {
  it("devolve o preço cobrado de cada plano pago", () => {
    expect(valorDoPlano("controle_mensal")).toBe(29.9);
    expect(valorDoPlano("controle_anual")).toBe(299);
    expect(valorDoPlano("projete_mensal")).toBe(47.9);
    expect(valorDoPlano("projete_anual")).toBe(479);
  });

  it("chave desconhecida ou vazia volta null", () => {
    expect(valorDoPlano("confere")).toBeNull();
    expect(valorDoPlano("controle_semanal")).toBeNull();
    expect(valorDoPlano(undefined)).toBeNull();
  });
});

import {
  BENEFICIOS_GRATIS,
  TIERS_PAGOS,
  beneficiosNaOrdem,
  seloDoBeneficio,
  type Beneficio,
} from "./planos";

describe("seloDoBeneficio (selos Novo e Em breve da lista de planos)", () => {
  const novo: Beneficio = { id: "x", texto: "X", novoAte: "2026-11-22" };

  it("mostra Novo até o dia de novoAte, inclusive, no horário de Brasília", () => {
    expect(seloDoBeneficio(novo, new Date("2026-11-22T12:00:00-03:00"))).toBe("novo");
    // 22/11 às 23h em Brasília já é 23/11 em UTC: ainda é Novo.
    expect(seloDoBeneficio(novo, new Date("2026-11-23T02:00:00Z"))).toBe("novo");
  });

  it("o Novo vence sozinho no dia seguinte", () => {
    expect(seloDoBeneficio(novo, new Date("2026-11-23T08:00:00-03:00"))).toBeNull();
  });

  it("Em breve ganha de Novo e não vence", () => {
    const b: Beneficio = { id: "y", texto: "Y", emBreve: true, novoAte: "2000-01-01" };
    expect(seloDoBeneficio(b, new Date("2030-01-01"))).toBe("em-breve");
  });

  it("item sem marcação não tem selo", () => {
    expect(seloDoBeneficio({ id: "z", texto: "Z" })).toBeNull();
  });
});

describe("beneficiosNaOrdem", () => {
  const lista: Beneficio[] = [
    { id: "a", texto: "A" },
    { id: "breve", texto: "Breve", emBreve: true },
    { id: "b", texto: "B" },
    { id: "c", texto: "C" },
  ];

  it("põe os escolhidos na frente e os Em breve por último", () => {
    expect(beneficiosNaOrdem(lista, ["c"]).map((b) => b.id)).toEqual(["c", "a", "b", "breve"]);
  });

  it("id que não existe é ignorado", () => {
    expect(beneficiosNaOrdem(lista, ["nao-existe"]).map((b) => b.id)).toEqual([
      "a",
      "b",
      "c",
      "breve",
    ]);
  });
});

describe("lista de benefícios dos planos", () => {
  const todas = [
    BENEFICIOS_GRATIS,
    TIERS_PAGOS.controle.beneficios,
    TIERS_PAGOS.projete.beneficios,
  ];

  it("ids únicos dentro de cada plano (a landing escolhe a ordem pelo id)", () => {
    for (const lista of todas) {
      expect(new Set(lista.map((b) => b.id)).size).toBe(lista.length);
    }
  });

  it("o Grátis não promete nada Em breve", () => {
    expect(BENEFICIOS_GRATIS.some((b) => b.emBreve)).toBe(false);
  });

  it("o teste do Pro é só pra visitante e só no Grátis (a /assinar logada filtra)", () => {
    expect(BENEFICIOS_GRATIS.find((b) => b.id === "teste-pro")?.soParaVisitante).toBe(true);
    for (const lista of [TIERS_PAGOS.controle.beneficios, TIERS_PAGOS.projete.beneficios]) {
      expect(lista.some((b) => b.soParaVisitante)).toBe(false);
    }
  });
});
