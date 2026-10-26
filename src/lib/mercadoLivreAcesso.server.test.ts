import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, rpc } }));
const { registrarEventoSistema } = vi.hoisted(() => ({ registrarEventoSistema: vi.fn() }));
vi.mock("@/lib/founder-eventos.server", () => ({ registrarEventoSistema }));
const api = vi.hoisted(() => ({ renovarTokens: vi.fn() }));
vi.mock("./mercadoLivreApi", () => api);

import { chaveTravaToken, obterAcessoMercadoLivre } from "./mercadoLivreAcesso.server";

const METODOS = ["select", "eq", "maybeSingle", "update"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const AGORA = Date.parse("2026-10-24T12:00:00Z");
const agora = () => AGORA;
const esperar = vi.fn(async () => {});
const conectada = { id: "c-1", status: "conectada", shop_id: "468424240" };
const tokenEm = (min: number) => ({
  access_token: `at-${min}`,
  refresh_token: "rt-velho",
  access_expira_em: new Date(AGORA + min * 60_000).toISOString(),
});
const novos = {
  accessToken: "at-novo",
  refreshToken: "rt-novo",
  accessExpiraEm: "2026-10-24T18:00:00.000Z",
  vendedoraId: "468424240",
};

let conexao: unknown;
let leituras: unknown[];
let trava: boolean;
let salvarErros: Array<{ message: string } | null>;
const updates: Consulta[] = [];

beforeEach(() => {
  conexao = conectada;
  leituras = [];
  trava = true;
  salvarErros = [];
  updates.length = 0;
  from.mockReset();
  from.mockImplementation(() => {
    const q = consulta({ data: conexao, error: null });
    updates.push(q);
    return q;
  });
  rpc.mockReset();
  rpc.mockImplementation(async (nome: string) => {
    if (nome === "canal_token_ler") return { data: [leituras.shift() ?? null], error: null };
    if (nome === "pegar_trava_com_dono") return { data: trava ? "dono-1" : null, error: null };
    if (nome === "canal_token_salvar") return { error: salvarErros.shift() ?? null };
    return { data: null, error: null };
  });
  api.renovarTokens.mockReset();
  registrarEventoSistema.mockReset();
  esperar.mockClear();
});

const chamadas = (nome: string) => rpc.mock.calls.filter((c) => c[0] === nome);

describe("obterAcessoMercadoLivre", () => {
  it("token com folga sai direto, sem trava nem renovação", async () => {
    leituras = [tokenEm(60)];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r).toEqual({
      acesso: { conexaoId: "c-1", accessToken: "at-60", vendedoraId: "468424240" },
      error: null,
    });
    expect(chamadas("pegar_trava_com_dono")).toHaveLength(0);
    expect(api.renovarTokens).not.toHaveBeenCalled();
  });

  it("sem conexão conectada não lê token", async () => {
    conexao = { ...conectada, status: "erro" };
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso).toBeNull();
    expect(chamadas("canal_token_ler")).toHaveLength(0);
  });

  it("perto de vencer: pega a trava, renova, grava o par novo e solta a trava", async () => {
    leituras = [tokenEm(5), tokenEm(5)];
    api.renovarTokens.mockResolvedValue({ tokens: novos, error: null, recusado: false });
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso?.accessToken).toBe("at-novo");
    expect(api.renovarTokens).toHaveBeenCalledWith("rt-velho");
    expect(chamadas("pegar_trava_com_dono")[0][1]).toEqual({
      p_chave: chaveTravaToken("c-1"),
      p_segundos: 60,
    });
    expect(chamadas("canal_token_salvar")[0][1]).toMatchObject({
      p_access: "at-novo",
      p_refresh: "rt-novo",
      p_refresh_expira: null,
    });
    expect(chamadas("soltar_trava_com_dono")).toHaveLength(1);
  });

  it("renovação que outra chamada terminou antes da trava não gasta o token de renovação", async () => {
    leituras = [tokenEm(5), tokenEm(360)];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso?.accessToken).toBe("at-360");
    expect(api.renovarTokens).not.toHaveBeenCalled();
    expect(chamadas("soltar_trava_com_dono")).toHaveLength(1);
  });

  it("trava ocupada: espera o token novo aparecer, sem renovar", async () => {
    trava = false;
    leituras = [tokenEm(5), tokenEm(5), tokenEm(360)];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso?.accessToken).toBe("at-360");
    expect(esperar).toHaveBeenCalledTimes(2);
    expect(api.renovarTokens).not.toHaveBeenCalled();
    expect(chamadas("soltar_trava_com_dono")).toHaveLength(0);
  });

  it("trava ocupada que não libera a tempo pede para tentar de novo", async () => {
    trava = false;
    leituras = [tokenEm(5)];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso).toBeNull();
    expect(r.error).toContain("renovando");
    expect(esperar).toHaveBeenCalledTimes(12);
  });

  it("Mercado Livre recusou a renovação: conexão vira erro e pede para conectar de novo", async () => {
    leituras = [tokenEm(5), tokenEm(5)];
    api.renovarTokens.mockResolvedValue({ tokens: null, error: "x", recusado: true });
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.error).toContain("Conecta de novo");
    const marcou = updates.find((q) => q.update.mock.calls.length);
    expect(marcou?.update.mock.calls[0][0]).toMatchObject({ status: "erro" });
    expect(registrarEventoSistema).toHaveBeenCalled();
    expect(chamadas("soltar_trava_com_dono")).toHaveLength(1);
  });

  it("recusa depois que outra parte já renovou não derruba a conexão", async () => {
    leituras = [tokenEm(5), tokenEm(5), { ...tokenEm(360), refresh_token: "rt-outro" }];
    api.renovarTokens.mockResolvedValue({ tokens: null, error: "x", recusado: true });
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso?.accessToken).toBe("at-360");
    expect(updates.some((q) => q.update.mock.calls.length)).toBe(false);
  });

  it("solta só a própria trava", async () => {
    leituras = [tokenEm(5), tokenEm(360)];
    await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(chamadas("soltar_trava_com_dono")[0][1]).toEqual({
      p_chave: chaveTravaToken("c-1"),
      p_dono: "dono-1",
    });
  });

  it("falha de rede na renovação não derruba a conexão", async () => {
    leituras = [tokenEm(5), tokenEm(5)];
    api.renovarTokens.mockResolvedValue({ tokens: null, error: "rede", recusado: false });
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso).toBeNull();
    expect(updates.some((q) => q.update.mock.calls.length)).toBe(false);
  });

  it("par novo que não grava: tenta 3 vezes e, sem jeito, marca erro", async () => {
    leituras = [tokenEm(5), tokenEm(5)];
    api.renovarTokens.mockResolvedValue({ tokens: novos, error: null, recusado: false });
    salvarErros = [{ message: "a" }, { message: "b" }, { message: "c" }];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso).toBeNull();
    expect(chamadas("canal_token_salvar")).toHaveLength(3);
    expect(registrarEventoSistema).toHaveBeenCalledWith(
      expect.objectContaining({ detalhes: { motivo: "token_novo_nao_salvo" } }),
    );
  });

  it("par novo que grava na segunda tentativa segue normal", async () => {
    leituras = [tokenEm(5), tokenEm(5)];
    api.renovarTokens.mockResolvedValue({ tokens: novos, error: null, recusado: false });
    salvarErros = [{ message: "a" }, null];
    const r = await obterAcessoMercadoLivre("u-1", { agora, esperar });
    expect(r.acesso?.accessToken).toBe("at-novo");
  });
});
