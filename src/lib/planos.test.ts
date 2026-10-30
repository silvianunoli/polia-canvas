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
  VIRADA_PRECOS,
  beneficiosNaOrdem,
  depoisDaVirada,
  seloDoBeneficio,
  temNumerosDoMes,
  tierDosNumeros,
  tiersPagos,
  tiersPagosDeFundadora,
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

const NOV = Date.parse("2026-11-30T23:59:59-03:00");
const DEZ = Date.parse(VIRADA_PRECOS);

describe("lista de benefícios dos planos", () => {
  const todas = [
    BENEFICIOS_GRATIS,
    ...[NOV, DEZ].flatMap((t) => [
      tiersPagos(t).controle.beneficios,
      tiersPagos(t).projete.beneficios,
    ]),
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
    for (const lista of todas.slice(1)) {
      expect(lista.some((b) => b.soParaVisitante)).toBe(false);
    }
  });
});

describe("abas do app Android (AND-07)", () => {
  it("Hoje e Mais abrem no Grátis; o cadeado fica em cada tela listada", () => {
    expect(rotaLiberada("/hoje", "confere")).toBe(true);
    expect(rotaLiberada("/mais", "confere")).toBe(true);
    expect(rotaLiberada("/vendas", "confere")).toBe(false);
  });
});

describe("virada de preços de 01/12/2026 (PAY-43/44/45)", () => {
  it("vira no primeiro minuto de 01/12 em Brasília, logo depois do prazo de fundadora", () => {
    expect(depoisDaVirada(NOV)).toBe(false);
    expect(depoisDaVirada(DEZ)).toBe(true);
  });

  it("preços: 29,90/299 e 47,90/479 até 30/11; 39,90/399 e 79,90/799 depois", () => {
    const nov = tiersPagos(NOV);
    const dez = tiersPagos(DEZ);
    expect([nov.controle.precoMensal, nov.controle.precoAnual]).toEqual([29.9, 299]);
    expect([nov.projete.precoMensal, nov.projete.precoAnual]).toEqual([47.9, 479]);
    expect([dez.controle.precoMensal, dez.controle.precoAnual]).toEqual([39.9, 399]);
    expect([dez.projete.precoMensal, dez.projete.precoAnual]).toEqual([79.9, 799]);
  });

  it("a fundadora trava o preço de antes da virada em qualquer data", () => {
    expect(tiersPagosDeFundadora().controle.precoMensal).toBe(29.9);
    expect(tiersPagosDeFundadora().projete.precoMensal).toBe(47.9);
  });

  it("Raio-x, Projeção, Resumo e Encomenda saem do Pro e entram no Premium", () => {
    const quatro = ["raiox", "projecao", "resumo-contador", "encomenda"];
    const ids = (l: Beneficio[]) => l.map((b) => b.id);
    for (const id of quatro) {
      expect(ids(tiersPagos(NOV).projete.beneficios)).toContain(id);
      expect(ids(tiersPagos(NOV).controle.beneficios)).not.toContain(id);
      expect(ids(tiersPagos(DEZ).controle.beneficios)).toContain(id);
      expect(ids(tiersPagos(DEZ).projete.beneficios)).not.toContain(id);
    }
    // O Pro continua com o que é canal e automação.
    expect(ids(tiersPagos(DEZ).projete.beneficios)).toEqual(
      expect.arrayContaining(["plano-conteudo", "assistente", "catalogo", "marketplaces"]),
    );
  });

  it("temNumerosDoMes: Premium só a partir da virada; Pro e beta sempre; Grátis nunca", () => {
    expect(temNumerosDoMes("controle", NOV)).toBe(false);
    expect(temNumerosDoMes("controle", DEZ)).toBe(true);
    for (const t of [NOV, DEZ]) {
      expect(temNumerosDoMes("projete", t)).toBe(true);
      expect(temNumerosDoMes("beta", t)).toBe(true);
      expect(temNumerosDoMes("confere", t)).toBe(false);
      expect(temNumerosDoMes("cancelada", t)).toBe(false);
    }
    expect(tierDosNumeros(NOV)).toBe("projete");
    expect(tierDosNumeros(DEZ)).toBe("controle");
  });

  it("Raio-x e Projeção deixam de ser rota do Pro; Plano de conteúdo e Catálogo seguem", () => {
    expect(ehRotaProjete("/raiox", NOV)).toBe(true);
    expect(ehRotaProjete("/projecao", NOV)).toBe(true);
    expect(ehRotaProjete("/raiox", DEZ)).toBe(false);
    expect(ehRotaProjete("/projecao", DEZ)).toBe(false);
    expect(tierPagoDaRota("/raiox", DEZ)).toBe("controle");
    expect(ehRotaProjete("/plano-conteudo", DEZ)).toBe(true);
    expect(ehRotaProjete("/catalogo", DEZ)).toBe(true);
  });

  it("recursoLiberado segue a data de hoje (sem cadeado do Raio-x pro Premium depois da virada)", () => {
    const esperado = depoisDaVirada();
    expect(recursoLiberado("/raiox", "controle")).toBe(esperado);
    expect(recursoLiberado("/plano-conteudo", "controle")).toBe(false);
  });
});
