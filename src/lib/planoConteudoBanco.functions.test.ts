import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/data.functions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data.functions")>()),
  hojeEmBrasilia: () => "2026-10-08",
}));

import { montarAnoDoBanco, NICHOS } from "@/lib/bancoIdeias";
import {
  montarLinhasDoPlano,
  montarPlanoConteudoDoBanco,
  rpcInexistente,
  substituirPlanoDoAno,
  type LinhaPlanoDoBanco,
  type OperacoesPlano,
} from "./planoConteudoBanco.functions";

const NICHO = NICHOS[0].chave;

function ops(over: Partial<OperacoesPlano> = {}) {
  return {
    substituirNaTransacao: vi.fn(async () => ({ data: 3, error: null })),
    apagarDeHojeEmDiante: vi.fn(async () => ({ error: null })),
    inserir: vi.fn(async () => ({ error: null })),
    ...over,
  };
}

const LINHAS: LinhaPlanoDoBanco[] = [
  { data: "2026-10-08", tipo: "feed", titulo: "a", ideia: "b" },
  { data: "2026-10-09", tipo: "reels", titulo: "c", ideia: "d" },
];

describe("montarLinhasDoPlano", () => {
  it("monta o ano inteiro e tira só os dias passados que já têm linha", () => {
    const ano = montarAnoDoBanco(2026, [NICHO]);
    const jaTem = new Set(["2026-01-01", "2026-01-02"]);
    const linhas = montarLinhasDoPlano(2026, [NICHO], jaTem);
    expect(linhas).toHaveLength(ano.length - 2);
    expect(linhas.some((l) => jaTem.has(l.data))).toBe(false);
    // Payload mínimo pra RPC: só os quatro campos do dia, sem user_id nem ano.
    expect(Object.keys(linhas[0]).sort()).toEqual(["data", "ideia", "tipo", "titulo"]);
  });
});

describe("rpcInexistente", () => {
  it("reconhece função que não existe no PostgREST e no Postgres", () => {
    expect(rpcInexistente({ code: "PGRST202" })).toBe(true);
    expect(rpcInexistente({ code: "42883" })).toBe(true);
    expect(rpcInexistente({ code: "42501" })).toBe(false);
    expect(rpcInexistente(null)).toBe(false);
  });
});

describe("substituirPlanoDoAno", () => {
  it("usa a RPC (uma transação) e não toca no caminho de dois passos", async () => {
    const o = ops();
    const r = await substituirPlanoDoAno(LINHAS, o);
    expect(r).toEqual({ ok: true, dias: 3, via: "rpc" });
    expect(o.substituirNaTransacao).toHaveBeenCalledWith(LINHAS);
    expect(o.apagarDeHojeEmDiante).not.toHaveBeenCalled();
    expect(o.inserir).not.toHaveBeenCalled();
  });

  it("RPC ainda não criada: cai no apagar + inserir antigo", async () => {
    const o = ops({
      substituirNaTransacao: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
    });
    const r = await substituirPlanoDoAno(LINHAS, o);
    expect(r).toEqual({ ok: true, dias: 2, via: "dois_passos" });
    expect(o.apagarDeHojeEmDiante).toHaveBeenCalledTimes(1);
    expect(o.inserir).toHaveBeenCalledWith(LINHAS);
  });

  it("erro da RPC que não é 'não existe' vira falha sem apagar nada", async () => {
    const o = ops({
      substituirNaTransacao: vi.fn(async () => ({ data: null, error: { code: "42501" } })),
    });
    const r = await substituirPlanoDoAno(LINHAS, o);
    expect(r.ok).toBe(false);
    expect(o.apagarDeHojeEmDiante).not.toHaveBeenCalled();
    expect(o.inserir).not.toHaveBeenCalled();
  });

  it("fallback com insert falhando devolve falha", async () => {
    const o = ops({
      substituirNaTransacao: vi.fn(async () => ({ data: null, error: { code: "42883" } })),
      inserir: vi.fn(async () => ({ error: { code: "23505" } })),
    });
    expect((await substituirPlanoDoAno(LINHAS, o)).ok).toBe(false);
  });

  it("fallback com lista vazia só apaga", async () => {
    const o = ops({
      substituirNaTransacao: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
    });
    expect(await substituirPlanoDoAno([], o)).toEqual({ ok: true, dias: 0, via: "dois_passos" });
    expect(o.inserir).not.toHaveBeenCalled();
  });
});

// ── Handler inteiro, com o Supabase falso ───────────────────────────────────

function consulta(resultado: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "lt", "gte", "maybeSingle", "delete", "insert"]) {
    q[m] = vi.fn(() => q);
  }
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(res, rej);
  return q as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;
}

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const montar = montarPlanoConteudoDoBanco as unknown as Chamavel;

describe("montarPlanoConteudoDoBanco", () => {
  beforeEach(() => {
    from.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("manda pra RPC pelo client da sessão, com o dia de Brasília e sem os dias já gravados", async () => {
    from.mockReturnValueOnce(consulta({ data: { plano: "projete" } }));
    from.mockReturnValueOnce(consulta({ data: [{ data: "2026-01-01" }], error: null }));
    const rpc = vi.fn(async () => ({ data: 364, error: null }));

    const r = await montar({
      data: { ano: 2026, nichos: [NICHO] },
      context: { userId: "u1", supabase: { rpc } },
    });

    expect(r).toEqual({ ok: true, dias: 364 });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [nome, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(nome).toBe("substituir_plano_conteudo_do_ano");
    expect(args.p_user_id).toBe("u1");
    expect(args.p_ano).toBe(2026);
    expect(args.p_desde).toBe("2026-10-08");
    const linhas = args.p_linhas as LinhaPlanoDoBanco[];
    expect(linhas).toHaveLength(montarAnoDoBanco(2026, [NICHO]).length - 1);
    expect(linhas.some((l) => l.data === "2026-01-01")).toBe(false);
    // Só profiles e a leitura dos dias passados: nada de delete/insert direto.
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("sem a RPC, insere com user_id e ano pelo service role", async () => {
    from.mockReturnValueOnce(consulta({ data: { plano: "beta" } }));
    from.mockReturnValueOnce(consulta({ data: [], error: null }));
    const apagar = consulta({ error: null });
    const inserir = consulta({ error: null });
    from.mockReturnValueOnce(apagar);
    from.mockReturnValueOnce(inserir);
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PGRST202" } }));

    const r = (await montar({
      data: { ano: 2026, nichos: [NICHO] },
      context: { userId: "u1", supabase: { rpc } },
    })) as { ok: boolean; dias: number };

    expect(r.ok).toBe(true);
    expect(apagar.gte).toHaveBeenCalledWith("data", "2026-10-08");
    const enviadas = inserir.insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(enviadas[0]).toEqual(expect.objectContaining({ user_id: "u1", ano: 2026 }));
    expect(r.dias).toBe(enviadas.length);
  });

  it("plano Grátis não chega no banco", async () => {
    from.mockReturnValueOnce(consulta({ data: { plano: "confere" } }));
    const rpc = vi.fn();
    expect(
      await montar({ data: { ano: 2026, nichos: [NICHO] }, context: { userId: "u1", supabase: { rpc } } }),
    ).toEqual({ ok: false, motivo: "plano_insuficiente" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
