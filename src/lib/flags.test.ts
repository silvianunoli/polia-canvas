import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { maybeSingleMock, eqAmbienteMock, eqKeyMock, selectMock, fromMock, bucketMock } = vi.hoisted(
  () => {
    const maybeSingleMock = vi.fn();
    const eqAmbienteMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqKeyMock = vi.fn(() => ({ eq: eqAmbienteMock }));
    const selectMock = vi.fn(() => ({ eq: eqKeyMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    return {
      maybeSingleMock,
      eqAmbienteMock,
      eqKeyMock,
      selectMock,
      fromMock,
      bucketMock: vi.fn(),
    };
  },
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

// A decisão (decidirFlag) é a real, já coberta em flags-regra.test.ts; só o
// bucket (sha256) é fixado pra controlar de que lado do rollout a usuária cai.
vi.mock("@/lib/flags-regra", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags-regra")>();
  return { ...real, bucketDaUsuaria: bucketMock };
});

type Mod = typeof import("./flags");

function flagNoBanco(
  flag: { estado: string; rollout_pct: number; beta_user_ids: string[] } | null,
) {
  maybeSingleMock.mockResolvedValue({ data: flag });
}

describe("flagAtiva", () => {
  let flagAtiva: Mod["flagAtiva"];

  beforeEach(async () => {
    // O cache de 60 s é estado de módulo: recarrega pra cada teste começar limpo.
    vi.resetModules();
    vi.useFakeTimers();
    bucketMock.mockResolvedValue(50);
    ({ flagAtiva } = await import("./flags"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("devolve true pra flag 'on' com rollout 100%", async () => {
    flagNoBanco({ estado: "on", rollout_pct: 100, beta_user_ids: [] });
    expect(await flagAtiva("csat_modal_ativo", "u1")).toBe(true);
  });

  it("devolve o padrão quando a flag não existe no banco", async () => {
    flagNoBanco(null);
    expect(await flagAtiva("inexistente", "u1", true)).toBe(true);
    expect(await flagAtiva("inexistente2", "u1", false)).toBe(false);
  });

  it("devolve false pra flag 'off' mesmo com padrão true", async () => {
    flagNoBanco({ estado: "off", rollout_pct: 100, beta_user_ids: [] });
    expect(await flagAtiva("ia_ativa", "u1", true)).toBe(false);
  });

  it("consulta founder_flags pela chave e pelo ambiente do hostname (localhost = preview)", async () => {
    flagNoBanco(null);
    await flagAtiva("k", "u1");
    expect(fromMock).toHaveBeenCalledWith("founder_flags");
    expect(selectMock).toHaveBeenCalledWith("estado, rollout_pct, beta_user_ids");
    expect(eqKeyMock).toHaveBeenCalledWith("key", "k");
    expect(eqAmbienteMock).toHaveBeenCalledWith("ambiente", "preview");
  });

  it("usa o bucket da usuária pra decidir rollout parcial", async () => {
    flagNoBanco({ estado: "on", rollout_pct: 30, beta_user_ids: [] });
    bucketMock.mockResolvedValue(10);
    expect(await flagAtiva("k", "u1")).toBe(true);
    expect(bucketMock).toHaveBeenCalledWith("u1", "k");

    bucketMock.mockResolvedValue(90);
    expect(await flagAtiva("k", "u2")).toBe(false);
  });

  it("não calcula bucket quando não há usuária logada (rollout parcial fica fechado)", async () => {
    flagNoBanco({ estado: "on", rollout_pct: 30, beta_user_ids: [] });
    expect(await flagAtiva("k", null)).toBe(false);
    expect(bucketMock).not.toHaveBeenCalled();
  });

  // Sem o cache, cada render bateria no banco.
  it("reaproveita a leitura por 60 s e volta a consultar depois", async () => {
    flagNoBanco({ estado: "on", rollout_pct: 100, beta_user_ids: [] });
    await flagAtiva("k", "u1");
    await flagAtiva("k", "u1");
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59_000);
    await flagAtiva("k", "u1");
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await flagAtiva("k", "u1");
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("cacheia também a ausência da flag (null), sem repetir a consulta", async () => {
    flagNoBanco(null);
    await flagAtiva("k", "u1");
    await flagAtiva("k", "u1");
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("chaves diferentes têm cache separado", async () => {
    flagNoBanco(null);
    await flagAtiva("a", "u1");
    await flagAtiva("b", "u1");
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("devolve o padrão quando a consulta explode (rede, RLS)", async () => {
    maybeSingleMock.mockRejectedValue(new Error("rede"));
    expect(await flagAtiva("k", "u1", true)).toBe(true);
    expect(await flagAtiva("k2", "u1", false)).toBe(false);
  });
});
