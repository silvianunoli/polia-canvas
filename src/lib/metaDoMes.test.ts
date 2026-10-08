import { describe, expect, it, vi } from "vitest";
import {
  ativasNoLimite,
  buscarMetaDoMes,
  LIMITE_METAS_ATIVAS,
  podeAtivarMeta,
  escolherMetaDoMes,
  metaDoMesConta,
  TITULO_META_DO_MES,
  type LinhaMetaDoMes,
} from "./metaDoMes";

function linha(p: Partial<LinhaMetaDoMes> & { id: string }): LinhaMetaDoMes {
  return {
    valor_alvo: 1000,
    valor_atual: 0,
    status: "ativa",
    da_jornada: true,
    updated_at: "2026-10-01T00:00:00Z",
    ...p,
  };
}

describe("escolherMetaDoMes", () => {
  it("sem linhas, não há meta", () => {
    expect(escolherMetaDoMes([])).toBeNull();
  });

  it("arquivada nunca vale", () => {
    expect(escolherMetaDoMes([linha({ id: "a", status: "arquivada" })])).toBeNull();
    expect(metaDoMesConta("arquivada")).toBe(false);
    expect(metaDoMesConta("ativa")).toBe(true);
    expect(metaDoMesConta("concluida")).toBe(true);
  });

  it("concluída continua valendo como alvo do mês", () => {
    expect(escolherMetaDoMes([linha({ id: "c", status: "concluida" })])?.id).toBe("c");
  });

  it("duas linhas não quebram: ativa ganha de concluída", () => {
    const r = escolherMetaDoMes([
      linha({ id: "concluida", status: "concluida", updated_at: "2026-10-09T00:00:00Z" }),
      linha({ id: "ativa", status: "ativa", updated_at: "2026-10-01T00:00:00Z" }),
    ]);
    expect(r?.id).toBe("ativa");
  });

  it("entre duas ativas, a do Planejamento ganha da criada à mão", () => {
    const r = escolherMetaDoMes([
      linha({ id: "mao", da_jornada: false, updated_at: "2026-10-09T00:00:00Z" }),
      linha({ id: "planejamento", da_jornada: true, updated_at: "2026-10-01T00:00:00Z" }),
    ]);
    expect(r?.id).toBe("planejamento");
  });

  it("empate no resto: a atualizada mais recentemente", () => {
    const r = escolherMetaDoMes([
      linha({ id: "velha", updated_at: "2026-09-01T00:00:00Z" }),
      linha({ id: "nova", updated_at: "2026-10-05T00:00:00Z" }),
    ]);
    expect(r?.id).toBe("nova");
  });

  it("arquivada fica de fora mesmo sendo a mais recente", () => {
    const r = escolherMetaDoMes([
      linha({ id: "arq", status: "arquivada", updated_at: "2026-10-09T00:00:00Z" }),
      linha({ id: "viva", status: "concluida", updated_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect(r?.id).toBe("viva");
  });
});

function clienteFalso(resultado: { data: unknown; error: unknown }) {
  const chamadas: Array<[string, ...unknown[]]> = [];
  const builder = {
    select: (...a: unknown[]) => (chamadas.push(["select", ...a]), builder),
    eq: (...a: unknown[]) => (chamadas.push(["eq", ...a]), builder),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(resultado).then(res, rej),
  };
  const from = vi.fn(() => builder);
  return { cliente: { from } as never, from, chamadas };
}

describe("buscarMetaDoMes", () => {
  it("filtra pela usuária e pelo título, sem maybeSingle", async () => {
    const { cliente, from, chamadas } = clienteFalso({
      data: [linha({ id: "x", valor_alvo: 5000, valor_atual: 1200 })],
      error: null,
    });
    const r = await buscarMetaDoMes(cliente, "user-1");
    expect(from).toHaveBeenCalledWith("metas");
    expect(chamadas).toContainEqual(["eq", "user_id", "user-1"]);
    expect(chamadas).toContainEqual(["eq", "titulo", TITULO_META_DO_MES]);
    expect(r).toEqual({ data: { id: "x", valor_alvo: 5000, valor_atual: 1200 }, error: null });
  });

  it("duas linhas com o mesmo título devolvem uma, sem erro", async () => {
    const { cliente } = clienteFalso({
      data: [
        linha({ id: "a", status: "arquivada", valor_alvo: 1 }),
        linha({ id: "b", status: "ativa", valor_alvo: 2 }),
      ],
      error: null,
    });
    const r = await buscarMetaDoMes(cliente, "u");
    expect(r.error).toBeNull();
    expect(r.data?.id).toBe("b");
  });

  it("propaga o erro da leitura", async () => {
    const erro = { message: "falhou" };
    const { cliente } = clienteFalso({ data: null, error: erro });
    expect(await buscarMetaDoMes(cliente, "u")).toEqual({ data: null, error: erro });
  });

  it("sem meta válida, data null e sem erro", async () => {
    const { cliente } = clienteFalso({ data: [], error: null });
    expect(await buscarMetaDoMes(cliente, "u")).toEqual({ data: null, error: null });
  });
});

// ONE-87 (08/10/2026): a Meta do mês não ocupa vaga no teto de 3 ativas.
describe("teto de metas ativas", () => {
  const meta = (id: string, titulo: string, status = "ativa") => ({ id, titulo, status });
  const tresProprias = [meta("a", "Vender 10"), meta("b", "Guardar 500"), meta("c", "Postar 3x")];

  it("a Meta do mês ativa não conta", () => {
    const metas = [...tresProprias, meta("m", TITULO_META_DO_MES)];
    expect(ativasNoLimite(metas).map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(LIMITE_METAS_ATIVAS).toBe(3);
  });

  it("concluída e arquivada não contam", () => {
    const metas = [meta("a", "x", "concluida"), meta("b", "y", "arquivada"), meta("c", "z")];
    expect(ativasNoLimite(metas)).toHaveLength(1);
  });

  it("com 3 metas próprias, outra meta não ativa, mas a Meta do mês ativa", () => {
    expect(podeAtivarMeta({ id: "n", titulo: "Nova" }, tresProprias)).toBe(false);
    expect(podeAtivarMeta({ id: "m", titulo: TITULO_META_DO_MES }, tresProprias)).toBe(true);
  });

  it("com 2 próprias e a Meta do mês, ainda cabe mais uma", () => {
    const metas = [meta("a", "x"), meta("b", "y"), meta("m", TITULO_META_DO_MES)];
    expect(podeAtivarMeta({ id: "n", titulo: "Nova" }, metas)).toBe(true);
  });

  it("reativar a própria meta não conta ela duas vezes", () => {
    expect(podeAtivarMeta({ id: "c", titulo: "Postar 3x" }, tresProprias)).toBe(true);
  });
});
