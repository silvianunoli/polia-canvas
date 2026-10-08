import { describe, it, expect } from "vitest";
import { ordenarPorUltimaAtividade, rotuloStatusChamado } from "./chamados";

describe("rotuloStatusChamado (QA-36)", () => {
  it("em_andamento é 'Em andamento', não 'Em aberto'", () => {
    expect(rotuloStatusChamado("em_andamento")).toBe("Em andamento");
    expect(rotuloStatusChamado("aberto")).toBe("Aberto");
    expect(rotuloStatusChamado("resolvido")).toBe("Resolvido");
  });
  it("status desconhecido não aparece cru", () => {
    expect(rotuloStatusChamado("qualquer")).toBe("Aberto");
  });
});

describe("ordenarPorUltimaAtividade (QA-36)", () => {
  it("resposta nova sobe o chamado mais antigo pro topo", () => {
    const lista = ordenarPorUltimaAtividade([
      {
        id: "novo",
        created_at: "2026-10-05T10:00:00+00:00",
        updated_at: "2026-10-05T10:00:00+00:00",
        ticket_messages: [],
      },
      {
        id: "antigo",
        created_at: "2026-10-01T10:00:00+00:00",
        updated_at: "2026-10-01T10:00:00+00:00",
        ticket_messages: [
          { created_at: "2026-10-02T10:00:00+00:00" },
          { created_at: "2026-10-07T09:00:00.5+00:00" },
        ],
      },
    ]);
    expect(lista.map((t) => t.id)).toEqual(["antigo", "novo"]);
    expect(lista[0].ultimaMensagem).toBe("2026-10-07T09:00:00.5+00:00");
    expect(lista[1].ultimaMensagem).toBeNull();
    expect("ticket_messages" in lista[0]).toBe(false);
  });

  it("sem mensagens, vale o updated_at (status mudado pelo suporte)", () => {
    const lista = ordenarPorUltimaAtividade([
      {
        id: "a",
        created_at: "2026-10-03T10:00:00+00:00",
        updated_at: "2026-10-03T10:00:00+00:00",
        ticket_messages: null,
      },
      {
        id: "b",
        created_at: "2026-10-01T10:00:00+00:00",
        updated_at: "2026-10-06T10:00:00+00:00",
      },
    ]);
    expect(lista.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
