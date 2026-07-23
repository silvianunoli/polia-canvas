import { describe, it, expect } from "vitest";
import {
  funil,
  abandonoPorPergunta,
  distribuicao,
  respostasAbertas,
  filtrarPorSegmento,
  type RespostaRow,
} from "@/lib/pesquisa-agg";
import type { Pergunta } from "@/lib/pesquisas/tipos";

const rows: RespostaRow[] = [
  {
    progresso: 24,
    concluida: true,
    respostas: {
      categoria: "comida",
      canais: ["instagram", "whatsapp"],
      aperto: "não sei precificar",
    },
    criado_em: "2026-07-21T10:00:00Z",
  },
  {
    progresso: 24,
    concluida: true,
    respostas: { categoria: "comida", canais: ["instagram"], aperto: "   " },
    criado_em: "2026-07-21T11:00:00Z",
  },
  {
    progresso: 3,
    concluida: false,
    respostas: { categoria: "moda_acessorios" },
    criado_em: "2026-07-21T12:00:00Z",
  },
  {
    progresso: 0,
    concluida: false,
    respostas: {},
    criado_em: "2026-07-21T13:00:00Z",
  },
];

describe("funil", () => {
  it("conta começaram, concluíram e a taxa", () => {
    expect(funil(rows)).toEqual({ comecaram: 4, concluiram: 2, taxaConclusao: 50 });
  });
  it("não divide por zero", () => {
    expect(funil([])).toEqual({ comecaram: 0, concluiram: 0, taxaConclusao: 0 });
  });
});

describe("abandonoPorPergunta", () => {
  it("conta os não-concluídos pelo progresso", () => {
    const perguntas = [
      { id: "a", ordem: 3, titulo: "P3" },
      { id: "b", ordem: 0, titulo: "P0" },
      { id: "c", ordem: 5, titulo: "P5" },
    ];
    const r = abandonoPorPergunta(rows, perguntas);
    expect(r.find((x) => x.ordem === 3)?.abandonos).toBe(1);
    expect(r.find((x) => x.ordem === 0)?.abandonos).toBe(1);
    expect(r.find((x) => x.ordem === 5)?.abandonos).toBe(0);
  });
});

describe("distribuicao", () => {
  const catP: Pergunta = {
    id: "categoria",
    ordem: 1,
    parte: 1,
    tipo: "unica",
    titulo: "categoria",
    opcoes: [
      { id: "comida", rotulo: "Comida" },
      { id: "moda_acessorios", rotulo: "Moda" },
    ],
  };
  it("única: conta e calcula pct sobre quem respondeu", () => {
    const d = distribuicao(rows, catP);
    const comida = d.find((x) => x.id === "comida")!;
    // 3 responderam categoria (a linha vazia não); comida = 2 -> 67%
    expect(comida.contagem).toBe(2);
    expect(comida.pct).toBe(67);
  });

  const canaisP: Pergunta = {
    id: "canais",
    ordem: 3,
    parte: 1,
    tipo: "multipla",
    titulo: "canais",
    opcoes: [
      { id: "instagram", rotulo: "IG" },
      { id: "whatsapp", rotulo: "WA" },
    ],
  };
  it("múltipla: conta cada seleção", () => {
    const d = distribuicao(rows, canaisP);
    expect(d.find((x) => x.id === "instagram")!.contagem).toBe(2);
    expect(d.find((x) => x.id === "whatsapp")!.contagem).toBe(1);
  });
});

describe("respostasAbertas", () => {
  it("ignora vazias e só-espaço, e apara", () => {
    expect(respostasAbertas(rows, "aperto")).toEqual(["não sei precificar"]);
  });
});

describe("filtrarPorSegmento", () => {
  it("filtra por dimensão e valor", () => {
    expect(filtrarPorSegmento(rows, "categoria", "comida").length).toBe(2);
  });
  it("sem dimensão devolve tudo", () => {
    expect(filtrarPorSegmento(rows, "", "").length).toBe(4);
  });
});
