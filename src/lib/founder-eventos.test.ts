import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

type Mod = typeof import("./founder-eventos");

const AGORA = new Date("2026-09-22T12:00:00Z");
const SESSAO = {
  access_token: "tok-1",
  user: { id: "u1", created_at: "2026-09-01T00:00:00Z" },
};

let mod: Mod;
let fetchMock: ReturnType<typeof vi.fn>;

function corpoDaChamada(n = 0): Array<Record<string, unknown>> {
  return JSON.parse(fetchMock.mock.calls[n][1].body as string);
}

function eventosEnviados(): string[] {
  return fetchMock.mock.calls.flatMap((c) =>
    (JSON.parse(c[1].body as string) as Array<{ evento: string }>).map((l) => l.evento),
  );
}

function definirVisibilidade(estado: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => estado,
  });
}

beforeEach(async () => {
  // fila, timer e ultimaAtividade são estado de módulo: recarrega a cada teste.
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk-test");
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
  definirVisibilidade("visible");
  getSessionMock.mockResolvedValue({ data: { session: SESSAO } });
  mod = await import("./founder-eventos");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("registrar", () => {
  it("não envia na hora: junta em lote e manda depois de 5 s", async () => {
    await mod.registrar("create_product");
    await mod.registrar("edit_product");
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corpoDaChamada().map((l) => l.evento)).toEqual(["create_product", "edit_product"]);
  });

  it("monta a linha com usuária, sessão, página, ambiente e origem client", async () => {
    await mod.registrar("create_goal", { propriedades: { valor: 10 } });
    await vi.advanceTimersByTimeAsync(5_000);

    const [linha] = corpoDaChamada();
    expect(linha).toMatchObject({
      user_id: "u1",
      evento: "create_goal",
      origem: "client",
      // jsdom roda em localhost, que o catálogo classifica como dev
      ambiente: "dev",
      pagina: "/",
      feature: null,
      propriedades: { valor: 10 },
    });
    expect(linha.sessao_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("posta em /rest/v1/founder_eventos com apikey e o access_token da sessão", async () => {
    await mod.registrar("login");
    await vi.advanceTimersByTimeAsync(5_000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.supabase.co/rest/v1/founder_eventos");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(false);
    expect(init.headers).toMatchObject({
      apikey: "pk-test",
      Authorization: "Bearer tok-1",
      Prefer: "return=minimal",
    });
  });

  it("sem sessão, grava com user_id null e autoriza com a apikey", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await mod.registrar("logout");
    await vi.advanceTimersByTimeAsync(5_000);

    expect(corpoDaChamada()[0].user_id).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer pk-test");
  });

  it("com 10 eventos na fila manda na hora, sem esperar os 5 s", async () => {
    for (let i = 0; i < 10; i++) await mod.registrar("edit_goal");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corpoDaChamada()).toHaveLength(10);

    // e o timer antigo não dispara um segundo POST vazio
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não envia nada sem VITE_SUPABASE_URL configurada", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    await mod.registrar("login");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uma falha do fetch não vira erro pra usuária", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await mod.registrar("login");
    // uma rejeição não tratada aqui derrubaria o teste
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("sessão de uso", () => {
  it("cria um uuid em sessionStorage e reaproveita nos eventos seguintes", async () => {
    await mod.registrar("login");
    const id = sessionStorage.getItem("polia-founder-sessao");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    vi.advanceTimersByTime(10 * 60 * 1000);
    await mod.registrar("edit_goal");
    expect(sessionStorage.getItem("polia-founder-sessao")).toBe(id);
  });

  it("renova o id depois de 30 min sem evento", async () => {
    await mod.registrar("login");
    const id = sessionStorage.getItem("polia-founder-sessao");

    vi.advanceTimersByTime(31 * 60 * 1000);
    await mod.registrar("edit_goal");
    expect(sessionStorage.getItem("polia-founder-sessao")).not.toBe(id);
  });
});

describe("registrarEAguardar", () => {
  it("manda o lote com keepalive pra sobreviver à saída da página", async () => {
    await mod.registrarEAguardar("logout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(corpoDaChamada().map((l) => l.evento)).toEqual(["logout"]);
  });
});

describe("registrarAberturaDeTela", () => {
  it("registra feature_opened com a feature da rota", async () => {
    mod.registrarAberturaDeTela("/produtos/novo");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(corpoDaChamada()[0]).toMatchObject({ evento: "feature_opened", feature: "produtos" });
  });

  it("ignora rota que não é feature do catálogo (site público)", async () => {
    mod.registrarAberturaDeTela("/sobre");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("montarHeartbeat", () => {
  it("manda heartbeat a cada 60 s enquanto há atividade nos últimos 2 min", async () => {
    const desmontar = mod.montarHeartbeat();
    await vi.advanceTimersByTimeAsync(65_000);
    expect(eventosEnviados()).toEqual(["heartbeat"]);
    desmontar();
  });

  // Aba esquecida aberta não pode inflar a duração de sessão.
  it("para de mandar depois de 2 min sem atividade e volta quando a usuária mexe", async () => {
    const desmontar = mod.montarHeartbeat();
    // 60 s e 120 s ainda estão dentro da janela; 180 s não.
    await vi.advanceTimersByTimeAsync(190_000);
    expect(eventosEnviados()).toEqual(["heartbeat", "heartbeat"]);

    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(eventosEnviados()).toEqual(["heartbeat", "heartbeat", "heartbeat"]);
    desmontar();
  });

  it("não manda heartbeat com a aba escondida", async () => {
    definirVisibilidade("hidden");
    const desmontar = mod.montarHeartbeat();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(fetchMock).not.toHaveBeenCalled();
    desmontar();
  });

  it("ao desmontar, para o intervalo e os listeners", async () => {
    const desmontar = mod.montarHeartbeat();
    desmontar();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no pagehide despacha com keepalive o que já estava na fila", async () => {
    const desmontar = mod.montarHeartbeat();
    await mod.registrar("edit_goal");
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(corpoDaChamada().map((l) => l.evento)).toEqual(["edit_goal"]);
    desmontar();
  });

  // BUG REAL (não corrigido aqui): em aoSair, `void registrar("sessao_fim")`
  // suspende no await de getSession antes de empurrar na fila, e o
  // `void flush(true)` logo abaixo roda com a fila ainda vazia. O sessao_fim
  // só entra na fila depois e fica esperando o timer de 5 s sem keepalive,
  // que a aba fechando quase nunca deixa disparar.
  it.fails("no pagehide o sessao_fim sai no mesmo POST com keepalive", async () => {
    const desmontar = mod.montarHeartbeat();
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(corpoDaChamada().map((l) => l.evento)).toEqual(["sessao_fim"]);
    desmontar();
  });
});

describe("login pendente (OAuth Google)", () => {
  it("consumir sem marca não faz nada", async () => {
    await mod.consumirLoginPendente();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marca a intenção em sessionStorage", () => {
    mod.marcarLoginPendente("google");
    expect(sessionStorage.getItem("polia-founder-login-pendente")).toBe("google");
  });

  it("conta criada há menos de 2 min vira signup, com o método nas propriedades", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { ...SESSAO, user: { id: "u1", created_at: "2026-09-22T11:59:00Z" } } },
    });
    mod.marcarLoginPendente("google");
    await mod.consumirLoginPendente();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(corpoDaChamada()[0]).toMatchObject({
      evento: "signup",
      feature: "conta",
      propriedades: { metodo: "google" },
    });
    expect(sessionStorage.getItem("polia-founder-login-pendente")).toBeNull();
  });

  it("conta antiga vira login", async () => {
    mod.marcarLoginPendente("google");
    await mod.consumirLoginPendente();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(corpoDaChamada()[0].evento).toBe("login");
  });

  it("consome a marca uma vez só: a segunda chamada não registra de novo", async () => {
    mod.marcarLoginPendente("google");
    await mod.consumirLoginPendente();
    await mod.consumirLoginPendente();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(corpoDaChamada()).toHaveLength(1);
  });

  it("sem sessão depois do redirect, limpa a marca e não registra", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    mod.marcarLoginPendente("google");
    await mod.consumirLoginPendente();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("polia-founder-login-pendente")).toBeNull();
  });
});
