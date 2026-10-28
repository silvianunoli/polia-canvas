import { describe, expect, it } from "vitest";

import {
  contarAbertos,
  ehErroDeTeto,
  estaAtrasado,
  ficaNoQuadro,
  linhaDoResumo,
  ordenarPorEntrega,
  proximoAndamento,
  resumoDoDia,
  rotuloEntrega,
  tetoAtingido,
  TETO_PEDIDOS_GRATIS,
  type PedidoResumo,
} from "./pedidos";

const HOJE = "2026-10-28"; // quarta

const p = (over: Partial<PedidoResumo> = {}): PedidoResumo => ({
  andamento: "a_fazer",
  entregaEm: HOJE,
  status: "a_receber",
  total: 10,
  ...over,
});

describe("andamentos", () => {
  it("avança na ordem e para no Entregue", () => {
    expect(proximoAndamento("a_fazer")).toBe("em_producao");
    expect(proximoAndamento("em_producao")).toBe("pronto");
    expect(proximoAndamento("pronto")).toBe("entregue");
    expect(proximoAndamento("entregue")).toBeNull();
  });
});

describe("atraso", () => {
  it("aberto com data passada atrasa; entregue e cancelado não", () => {
    expect(estaAtrasado(p({ entregaEm: "2026-10-27" }), HOJE)).toBe(true);
    expect(estaAtrasado(p({ entregaEm: HOJE }), HOJE)).toBe(false);
    expect(estaAtrasado(p({ entregaEm: "2026-10-27", andamento: "entregue" }), HOJE)).toBe(false);
    expect(estaAtrasado(p({ entregaEm: "2026-10-27", status: "cancelada" }), HOJE)).toBe(false);
  });
});

describe("rotuloEntrega", () => {
  it("hoje, amanhã, dia da semana e atraso", () => {
    expect(rotuloEntrega(p(), HOJE).texto).toBe("entrega hoje");
    expect(rotuloEntrega(p({ entregaEm: "2026-10-29" }), HOJE).texto).toBe("entrega amanhã");
    expect(rotuloEntrega(p({ entregaEm: "2026-10-30" }), HOJE).texto).toBe("entrega sex 30/10");
    expect(rotuloEntrega(p({ entregaEm: "2026-10-27" }), HOJE)).toEqual({
      texto: "atrasado desde 27/10",
      atrasado: true,
    });
    expect(rotuloEntrega(p({ entregaEm: "2026-10-27", andamento: "entregue" }), HOJE)).toEqual({
      texto: "combinado pra 27/10",
      atrasado: false,
    });
  });
});

describe("ficaNoQuadro", () => {
  it("aberto fica sempre; entregue só nos últimos 7 dias; cancelado sai", () => {
    expect(ficaNoQuadro(p({ entregaEm: "2026-09-01" }), HOJE)).toBe(true);
    expect(ficaNoQuadro(p({ andamento: "entregue", entregaEm: "2026-10-21" }), HOJE)).toBe(true);
    expect(ficaNoQuadro(p({ andamento: "entregue", entregaEm: "2026-10-20" }), HOJE)).toBe(false);
    expect(ficaNoQuadro(p({ status: "cancelada" }), HOJE)).toBe(false);
  });

  it("ordena pelo que vence primeiro", () => {
    const lista = ordenarPorEntrega([
      p({ entregaEm: "2026-11-02" }),
      p({ entregaEm: "2026-10-27" }),
    ]);
    expect(lista.map((x) => x.entregaEm)).toEqual(["2026-10-27", "2026-11-02"]);
  });
});

describe("resumoDoDia", () => {
  it("conta hoje, amanhã e atrasados e soma o a receber da semana", () => {
    const r = resumoDoDia(
      [
        p({ entregaEm: HOJE, total: 36 }),
        p({ entregaEm: HOJE, status: "recebida", total: 50 }),
        p({ entregaEm: "2026-10-29", total: 30 }),
        p({ entregaEm: "2026-10-26", total: 45 }),
        p({ entregaEm: "2026-11-03", total: 100 }), // hoje + 6: ainda na semana
        p({ entregaEm: "2026-11-04", total: 500 }), // hoje + 7: fora
        p({ andamento: "entregue", total: 999 }),
        p({ status: "cancelada", total: 999 }),
      ],
      HOJE,
    );
    expect(r).toEqual({ hoje: 2, amanha: 1, atrasados: 1, entraNaSemana: 211, abertos: 6 });
  });

  it("linha só com o que tem número", () => {
    expect(linhaDoResumo({ hoje: 2, amanha: 1, atrasados: 1, entraNaSemana: 0, abertos: 4 })).toBe(
      "Hoje: 2 entregas · Amanhã: 1 · Atrasados: 1",
    );
    expect(linhaDoResumo({ hoje: 1, amanha: 0, atrasados: 0, entraNaSemana: 0, abertos: 1 })).toBe(
      "Hoje: 1 entrega",
    );
    expect(linhaDoResumo({ hoje: 0, amanha: 0, atrasados: 0, entraNaSemana: 0, abertos: 3 })).toBe(
      "3 pedidos abertos, nenhum pra hoje.",
    );
    expect(linhaDoResumo({ hoje: 0, amanha: 0, atrasados: 0, entraNaSemana: 0, abertos: 0 })).toBe(
      "Nenhum pedido aberto.",
    );
  });
});

describe("teto do Grátis", () => {
  it("conta só os abertos e trava no 15º", () => {
    expect(contarAbertos([p(), p({ andamento: "entregue" }), p({ status: "cancelada" })])).toBe(1);
    expect(tetoAtingido(true, TETO_PEDIDOS_GRATIS - 1)).toBe(false);
    expect(tetoAtingido(true, TETO_PEDIDOS_GRATIS)).toBe(true);
    expect(tetoAtingido(false, 999)).toBe(false);
  });

  it("reconhece a recusa do banco", () => {
    expect(
      ehErroDeTeto(
        "Limite do plano Grátis atingido (15 pedidos abertos). Assine o Premium pra liberar.",
      ),
    ).toBe(true);
    expect(ehErroDeTeto("Produto não encontrado")).toBe(false);
  });
});
