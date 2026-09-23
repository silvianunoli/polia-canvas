import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: (i: unknown) => unknown = (i) => i;
    const builder = {
      inputValidator(v: (i: unknown) => unknown) {
        validator = v;
        return builder;
      },
      middleware() {
        return builder;
      },
      handler(fn: (ctx: { data: unknown; context: unknown }) => unknown) {
        return async (opts?: { data?: unknown; context?: unknown }) =>
          fn({ data: validator(opts?.data), context: opts?.context });
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

const { verificarTurnstileServer } = vi.hoisted(() => ({ verificarTurnstileServer: vi.fn() }));
vi.mock("@/lib/turnstile.server", () => ({ verificarTurnstileServer }));

import {
  getPesquisaAberta,
  salvarPesquisa,
  importarRespostasPesquisa,
  alternarPesquisaAtiva,
} from "./pesquisa.functions";
import { discoveryNegocio } from "./pesquisas/discovery-negocio";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const aberta = getPesquisaAberta as unknown as Chamavel;
const salvar = salvarPesquisa as unknown as Chamavel;
const importar = importarRespostasPesquisa as unknown as Chamavel;
const alternar = alternarPesquisaAtiva as unknown as Chamavel;

const METODOS = [
  "select",
  "eq",
  "neq",
  "order",
  "limit",
  "maybeSingle",
  "insert",
  "update",
] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const SLUG = discoveryNegocio.slug;
const pesquisaAtiva = {
  id: "p-1",
  slug: SLUG,
  titulo: "Discovery",
  subtitulo: null,
  ativa: true,
  abre_em: null,
  fecha_em: null,
  criado_em: "2026-07-01T00:00:00Z",
};

function pesquisas(rows: unknown[]) {
  from.mockReturnValueOnce(consulta({ data: rows }));
}
function perfil(isAdmin: boolean) {
  from.mockReturnValueOnce(consulta({ data: { is_admin: isAdmin } }));
}

const admin = { userId: "admin-1" };

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPesquisaAberta", () => {
  it("sem pesquisa ativa devolve fechada e vazia", async () => {
    pesquisas([]);
    expect(await aberta()).toEqual({ aberta: false, titulo: "", subtitulo: "", slug: "" });
  });

  it("pesquisa ativa no banco mas sem config no código conta como inexistente", async () => {
    pesquisas([{ ...pesquisaAtiva, slug: "nao-existe-no-codigo" }]);
    expect(await aberta()).toEqual({ aberta: false, titulo: "", subtitulo: "", slug: "" });
  });

  it("ativa e dentro da janela: aberta com título e slug", async () => {
    pesquisas([pesquisaAtiva]);
    expect(await aberta()).toEqual({
      aberta: true,
      titulo: "Discovery",
      subtitulo: "",
      slug: SLUG,
    });
  });

  it("janela de datas: ainda não abriu ou já fechou => aberta false, mas com dados", async () => {
    pesquisas([{ ...pesquisaAtiva, abre_em: "2099-01-01T00:00:00Z" }]);
    expect(await aberta()).toEqual(expect.objectContaining({ aberta: false, slug: SLUG }));
    pesquisas([{ ...pesquisaAtiva, fecha_em: "2000-01-01T00:00:00Z" }]);
    expect(await aberta()).toEqual(expect.objectContaining({ aberta: false, slug: SLUG }));
  });
});

describe("salvarPesquisa", () => {
  const base = { sessaoId: "sessao-12345678", progresso: 3, concluida: false };

  it("sessaoId curto ou progresso negativo rejeitam", async () => {
    await expect(salvar({ data: { ...base, sessaoId: "abc" } })).rejects.toThrow();
    await expect(salvar({ data: { ...base, progresso: -1 } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("honeypot finge sucesso sem ler nada", async () => {
    expect(await salvar({ data: { ...base, hp: "x" } })).toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
  });

  it("sem pesquisa ativa: nao_encontrada; fora da janela: fechada", async () => {
    pesquisas([]);
    expect(await salvar({ data: base })).toEqual({ ok: false, motivo: "nao_encontrada" });
    pesquisas([{ ...pesquisaAtiva, fecha_em: "2000-01-01T00:00:00Z" }]);
    expect(await salvar({ data: base })).toEqual({ ok: false, motivo: "fechada" });
  });

  it("primeira gravação da sessão exige Turnstile; reprovado não insere", async () => {
    pesquisas([pesquisaAtiva]);
    from.mockReturnValueOnce(consulta({ data: null }));
    verificarTurnstileServer.mockResolvedValue(false);
    expect(await salvar({ data: { ...base, turnstileToken: "tok" } })).toEqual({
      ok: false,
      motivo: "turnstile",
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("insere a linha com as respostas SANITIZADAS contra a config", async () => {
    pesquisas([pesquisaAtiva]);
    from.mockReturnValueOnce(consulta({ data: null }));
    verificarTurnstileServer.mockResolvedValue(true);
    const ins = consulta({ error: null });
    from.mockReturnValueOnce(ins);

    const respostas = {
      estagio: "ja_vendo",
      categoria: "opcao_forjada",
      // múltipla: repete, inclui inválida e passa do maxSelecoes (2).
      onde_clareza: ["quanto_cobrar", "quanto_cobrar", "invalida", 7, "dou_lucro", "diferencial"],
      aperto: "  texto aberto  ",
      pergunta_inventada: "x",
    };
    expect(await salvar({ data: { ...base, turnstileToken: "tok", respostas } })).toEqual({
      ok: true,
    });
    expect(ins.insert).toHaveBeenCalledWith({
      pesquisa_id: "p-1",
      sessao_id: "sessao-12345678",
      progresso: 3,
      concluida: false,
      respostas: {
        estagio: "ja_vendo",
        onde_clareza: ["quanto_cobrar", "dou_lucro"],
        aperto: "texto aberto",
      },
    });
  });

  it("corrida no insert (23505) conta como sucesso", async () => {
    pesquisas([pesquisaAtiva]);
    from.mockReturnValueOnce(consulta({ data: null }));
    verificarTurnstileServer.mockResolvedValue(true);
    from.mockReturnValueOnce(consulta({ error: { code: "23505" } }));
    expect(await salvar({ data: { ...base, turnstileToken: "tok" } })).toEqual({ ok: true });
  });

  it("atualização da mesma sessão não repete Turnstile e nunca volta o progresso", async () => {
    pesquisas([pesquisaAtiva]);
    from.mockReturnValueOnce(consulta({ data: { id: "r-1", progresso: 7 } }));
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);

    expect(
      await salvar({ data: { ...base, progresso: 3, concluida: true, respostas: {} } }),
    ).toEqual({ ok: true });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    const patch = up.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.progresso).toBe(7);
    expect(patch.concluida).toBe(true);
    // Respostas vazias não apagam o parcial já gravado.
    expect(patch).not.toHaveProperty("respostas");
    expect(up.eq).toHaveBeenCalledWith("id", "r-1");
  });

  it("atualização com respostas envia o patch sanitizado", async () => {
    pesquisas([pesquisaAtiva]);
    from.mockReturnValueOnce(consulta({ data: { id: "r-1", progresso: 1 } }));
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);
    await salvar({ data: { ...base, progresso: 2, respostas: { estagio: "comecei" } } });
    expect(up.update.mock.calls[0][0]).toEqual(
      expect.objectContaining({ progresso: 2, respostas: { estagio: "comecei" } }),
    );
  });
});

describe("importarRespostasPesquisa (admin)", () => {
  const linhas = [{ estagio: "ja_vendo", categoria: "comida" }, { estagio: "invalido" }];

  it("não-admin recebe Forbidden", async () => {
    perfil(false);
    await expect(
      importar({ data: { slug: SLUG, linhas }, context: { userId: "x" } }),
    ).rejects.toThrow("Forbidden");
  });

  it("lista vazia rejeita na validação", async () => {
    await expect(importar({ data: { slug: SLUG, linhas: [] }, context: admin })).rejects.toThrow();
  });

  it("slug sem config ou sem linha no banco: nao_encontrada", async () => {
    perfil(true);
    expect(await importar({ data: { slug: "zzz", linhas }, context: admin })).toEqual({
      ok: false,
      motivo: "nao_encontrada",
      inseridas: 0,
    });
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: null }));
    expect(await importar({ data: { slug: SLUG, linhas }, context: admin })).toEqual({
      ok: false,
      motivo: "nao_encontrada",
      inseridas: 0,
    });
  });

  it("cada linha vira resposta concluída, sessão sintética e sanitizada", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: { id: "p-1" } }));
    const ins = consulta({ error: null });
    from.mockReturnValueOnce(ins);

    expect(await importar({ data: { slug: SLUG, linhas }, context: admin })).toEqual({
      ok: true,
      inseridas: 2,
    });
    const inseridas = ins.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(inseridas).toHaveLength(2);
    expect(inseridas[0]).toEqual(
      expect.objectContaining({
        pesquisa_id: "p-1",
        concluida: true,
        progresso: discoveryNegocio.perguntas.length,
        respostas: { estagio: "ja_vendo", categoria: "comida" },
      }),
    );
    expect(inseridas[0].sessao_id).toMatch(/^externo-[0-9a-f-]{36}$/);
    expect(inseridas[1].respostas).toEqual({});
  });
});

describe("alternarPesquisaAtiva (admin)", () => {
  it("ativar desliga todas as outras antes (só uma pública por vez)", async () => {
    perfil(true);
    const outras = consulta({ error: null });
    const esta = consulta({ error: null });
    from.mockReturnValueOnce(outras).mockReturnValueOnce(esta);

    expect(await alternar({ data: { slug: SLUG, ativa: true }, context: admin })).toEqual({
      ok: true,
    });
    expect(outras.update).toHaveBeenCalledWith({ ativa: false });
    expect(outras.neq).toHaveBeenCalledWith("slug", SLUG);
    expect(esta.update).toHaveBeenCalledWith({ ativa: true });
    expect(esta.eq).toHaveBeenCalledWith("slug", SLUG);
  });

  it("desativar mexe só na própria", async () => {
    perfil(true);
    const esta = consulta({ error: null });
    from.mockReturnValueOnce(esta);
    expect(await alternar({ data: { slug: SLUG, ativa: false }, context: admin })).toEqual({
      ok: true,
    });
    expect(from).toHaveBeenCalledTimes(2);
    expect(esta.update).toHaveBeenCalledWith({ ativa: false });
  });

  it("falha ao desativar as demais aborta sem ativar esta", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ error: { message: "x" } }));
    expect(await alternar({ data: { slug: SLUG, ativa: true }, context: admin })).toEqual({
      ok: false,
    });
    expect(from).toHaveBeenCalledTimes(2);
  });
});
