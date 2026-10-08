import { describe, it, expect, vi } from "vitest";
import {
  dataHoraDaGeracao,
  ehDuplicado,
  faltaSchema,
  gravarGeracaoRaioX,
  ordenarVersoes,
  versaoEscolhida,
} from "./raioxGeracoes";

const linha = { user_id: "u1", mes: "2026-09", placar: "p", causas: "c" };

function ops(respostasInserir: unknown[], respostasAtualizar: unknown[] = []) {
  const inserir = vi.fn(async () => ({ error: respostasInserir.shift() ?? null }));
  const atualizar = vi.fn(async () => ({ error: respostasAtualizar.shift() ?? null }));
  return { inserir, atualizar };
}

describe("gravarGeracaoRaioX", () => {
  it("depois da migração: insere uma linha nova, com avisos, sem tocar no update", async () => {
    const o = ops([null]);
    const r = await gravarGeracaoRaioX(linha, ["aviso"], o);
    expect(r).toEqual({ modo: "inserido" });
    expect(o.inserir).toHaveBeenCalledWith({ ...linha, avisos: ["aviso"] });
    expect(o.atualizar).not.toHaveBeenCalled();
  });

  it("antes da migração: 23505 no insert cai no update da linha existente", async () => {
    const o = ops([{ code: "23505" }], [null]);
    const r = await gravarGeracaoRaioX(linha, [], o);
    expect(r).toEqual({ modo: "atualizado" });
    expect(o.atualizar).toHaveBeenCalledWith({ ...linha, avisos: [] });
  });

  it("sem a coluna avisos: tenta de novo sem ela", async () => {
    const o = ops([{ code: "PGRST204" }, null]);
    const r = await gravarGeracaoRaioX(linha, ["aviso"], o);
    expect(r).toEqual({ modo: "inserido" });
    expect(o.inserir).toHaveBeenLastCalledWith(linha);
  });

  it("sem a coluna avisos E com a UNIQUE antiga: update sem avisos", async () => {
    const o = ops([{ code: "23505" }, { code: "23505" }], [{ code: "42703" }, null]);
    const r = await gravarGeracaoRaioX(linha, ["aviso"], o);
    expect(r).toEqual({ modo: "atualizado" });
    expect(o.atualizar).toHaveBeenLastCalledWith(linha);
  });

  it("outro erro não vira update e volta como falha", async () => {
    const erro = { code: "XX000", message: "caiu" };
    const o = ops([erro]);
    const r = await gravarGeracaoRaioX(linha, [], o);
    expect(r).toEqual({ modo: "falhou", error: erro });
    expect(o.atualizar).not.toHaveBeenCalled();
  });

  it("update que falha volta como falha", async () => {
    const erro = { code: "XX000" };
    const o = ops([{ code: "23505" }], [erro]);
    expect(await gravarGeracaoRaioX(linha, [], o)).toEqual({ modo: "falhou", error: erro });
  });
});

describe("códigos de erro", () => {
  it("reconhece duplicado e falta de schema", () => {
    expect(ehDuplicado({ code: "23505" })).toBe(true);
    expect(ehDuplicado({ code: "42703" })).toBe(false);
    expect(ehDuplicado(null)).toBe(false);
    expect(faltaSchema({ code: "PGRST205" })).toBe(true);
    expect(faltaSchema({ code: "42P01" })).toBe(true);
    expect(faltaSchema({ code: "23505" })).toBe(false);
    expect(faltaSchema(undefined)).toBe(false);
  });
});

describe("versões do mês", () => {
  const antiga = { id: "a", criado_em: "2026-10-01T09:00:00Z" };
  const meio = { id: "b", criado_em: "2026-10-03T15:30:00Z" };
  const nova = { id: "c", criado_em: "2026-10-07T18:45:00Z" };

  it("ordena da mais recente pra mais antiga", () => {
    expect(ordenarVersoes([antiga, nova, meio]).map((v) => v.id)).toEqual(["c", "b", "a"]);
  });

  it("empate de horário desempata pelo id, sempre igual", () => {
    const x = { id: "x", criado_em: "2026-10-07T18:45:00Z" };
    expect(ordenarVersoes([nova, x]).map((v) => v.id)).toEqual(["x", "c"]);
    expect(ordenarVersoes([x, nova]).map((v) => v.id)).toEqual(["x", "c"]);
  });

  it("sem escolha mostra a mais recente", () => {
    expect(versaoEscolhida([antiga, nova, meio], null)?.id).toBe("c");
  });

  it("com escolha mostra a escolhida", () => {
    expect(versaoEscolhida([antiga, nova, meio], "a")?.id).toBe("a");
  });

  it("escolha que não existe mais cai na mais recente", () => {
    expect(versaoEscolhida([antiga, meio], "sumiu")?.id).toBe("b");
  });

  it("lista vazia devolve null", () => {
    expect(versaoEscolhida([], null)).toBeNull();
  });
});

describe("dataHoraDaGeracao", () => {
  it("escreve data e hora em pt-BR no fuso pedido", () => {
    expect(dataHoraDaGeracao("2026-10-07T18:45:00Z", "America/Sao_Paulo")).toBe(
      "07/10/2026 às 15:45",
    );
  });

  it("vira o dia conforme o fuso", () => {
    expect(dataHoraDaGeracao("2026-10-08T01:10:00Z", "America/Sao_Paulo")).toBe(
      "07/10/2026 às 22:10",
    );
  });

  it("data inválida não quebra", () => {
    expect(dataHoraDaGeracao("lixo")).toBe("Data indisponível");
  });
});
