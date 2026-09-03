import { describe, it, expect } from "vitest";
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
