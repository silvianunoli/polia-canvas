import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

type Mod = typeof import("./useTurnstile");
type Hook = ReturnType<Mod["useTurnstile"]>;

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// O hook só renderiza o widget se containerRef aponta pra um elemento real,
// então montamos um componente mínimo em vez de renderHook.
function montar(useTurnstile: Mod["useTurnstile"]) {
  const ultimo: { atual: Hook | null } = { atual: null };
  function Comp() {
    const hook = useTurnstile();
    ultimo.atual = hook;
    return <div ref={hook.containerRef} data-testid="turnstile" />;
  }
  const utils = render(<Comp />);
  return { ...utils, hook: () => ultimo.atual! };
}

function stubTurnstile() {
  const turnstile = {
    render: vi.fn<(container: HTMLElement, options: Record<string, unknown>) => string>(
      () => "widget-1",
    ),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = turnstile;
  return turnstile;
}

function opcoesDoRender(turnstile: ReturnType<typeof stubTurnstile>) {
  return turnstile.render.mock.calls[0][1] as Record<string, (t?: string) => void> & {
    sitekey: string;
    action: string;
  };
}

async function drenar() {
  await act(async () => {
    await Promise.resolve();
  });
}

let useTurnstile: Mod["useTurnstile"];

beforeEach(async () => {
  // scriptPromise é estado de módulo: recarrega a cada teste.
  vi.resetModules();
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "sitekey-teste");
  document.head.innerHTML = "";
  delete window.turnstile;
  ({ useTurnstile } = await import("./useTurnstile"));
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("carregamento do script", () => {
  it("injeta o script do Turnstile (async + defer) quando window.turnstile não existe", () => {
    montar(useTurnstile);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    expect(script).not.toBeNull();
    expect(script!.async).toBe(true);
    expect(script!.defer).toBe(true);
  });

  it("renderiza o widget assim que o script termina de carregar", async () => {
    const { hook } = montar(useTurnstile);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)!;
    const turnstile = stubTurnstile();

    await act(async () => {
      script.onload!(new Event("load"));
      await Promise.resolve();
    });

    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(hook().token).toBeNull();
  });

  it("não injeta o script quando window.turnstile já existe", async () => {
    const turnstile = stubTurnstile();
    montar(useTurnstile);
    await drenar();
    expect(document.head.querySelector("script")).toBeNull();
    expect(turnstile.render).toHaveBeenCalledTimes(1);
  });

  it("dois widgets na mesma página dividem um único script", () => {
    montar(useTurnstile);
    montar(useTurnstile);
    expect(document.head.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)).toHaveLength(1);
  });

  it("falha no script deixa o token nulo sem explodir", async () => {
    const { hook } = montar(useTurnstile);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)!;
    await act(async () => {
      script.onerror!(new Event("error"));
      await Promise.resolve();
    });
    expect(hook().token).toBeNull();
  });
});

describe("widget", () => {
  it("renderiza no container com a sitekey do ambiente e a action fixa", async () => {
    const turnstile = stubTurnstile();
    const { getByTestId } = montar(useTurnstile);
    await drenar();

    expect(turnstile.render.mock.calls[0][0]).toBe(getByTestId("turnstile"));
    expect(opcoesDoRender(turnstile)).toMatchObject({
      sitekey: "sitekey-teste",
      action: "turnstile-spin-v1",
    });
  });

  it("callback preenche o token; expired/error limpam", async () => {
    const turnstile = stubTurnstile();
    const { hook } = montar(useTurnstile);
    await drenar();
    const opcoes = opcoesDoRender(turnstile);

    act(() => opcoes.callback("tok-1"));
    expect(hook().token).toBe("tok-1");

    act(() => opcoes["expired-callback"]());
    expect(hook().token).toBeNull();

    act(() => opcoes.callback("tok-2"));
    act(() => opcoes["error-callback"]());
    expect(hook().token).toBeNull();
  });

  // Depois de um submit que falhou, o token já foi consumido: precisa de outro.
  it("reset() zera o token e pede reset do widget pelo id", async () => {
    const turnstile = stubTurnstile();
    const { hook } = montar(useTurnstile);
    await drenar();
    act(() => opcoesDoRender(turnstile).callback("tok-1"));

    act(() => hook().reset());
    expect(hook().token).toBeNull();
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
  });

  it("ao desmontar, remove o widget pelo id", async () => {
    const turnstile = stubTurnstile();
    const { unmount } = montar(useTurnstile);
    await drenar();
    unmount();
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
  });

  it("desmontar antes do script carregar não renderiza nada depois", async () => {
    const { unmount } = montar(useTurnstile);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)!;
    unmount();
    const turnstile = stubTurnstile();
    await act(async () => {
      script.onload!(new Event("load"));
      await Promise.resolve();
    });
    expect(turnstile.render).not.toHaveBeenCalled();
    expect(turnstile.remove).not.toHaveBeenCalled();
  });
});
