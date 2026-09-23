import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const { from, storageFrom, download } = vi.hoisted(() => {
  const download = vi.fn();
  return { from: vi.fn(), download, storageFrom: vi.fn(() => ({ download })) };
});
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, storage: { from: storageFrom } },
}));

import { responderDownloadManual } from "./download.server";

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

const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const url = (t: string | null) =>
  new URL(`https://one.usepolia.com.br/manual/baixar${t === null ? "" : `?t=${t}`}`);

beforeEach(() => {
  from.mockReset();
  storageFrom.mockClear();
  download.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("responderDownloadManual: volta pra landing com aviso", () => {
  it("token ausente ou malformado: aviso=link, sem consultar o banco", async () => {
    for (const t of [null, "abc", "3f2504e0-4f89-11d3-9a0c-0305e82c3301"]) {
      const res = await responderDownloadManual(url(t));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://one.usepolia.com.br/manual?aviso=link");
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("token bem formado que não existe: mesmo aviso=link (não confirma qual foi)", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: null }));
    const res = await responderDownloadManual(url(TOKEN));
    expect(res.headers.get("location")).toBe("https://one.usepolia.com.br/manual?aviso=link");
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("erro ao consultar o banco: aviso=erro", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: { message: "db" } }));
    const res = await responderDownloadManual(url(TOKEN));
    expect(res.headers.get("location")).toBe("https://one.usepolia.com.br/manual?aviso=erro");
  });

  it("PDF sumiu do bucket: aviso=erro e não conta download", async () => {
    from.mockReturnValueOnce(consulta({ data: { id: "l-1", downloads: 0 }, error: null }));
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await responderDownloadManual(url(TOKEN));
    expect(res.headers.get("location")).toBe("https://one.usepolia.com.br/manual?aviso=erro");
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("responderDownloadManual: entrega", () => {
  it("token válido entrega o PDF como anexo, sem cache, e incrementa downloads", async () => {
    const lead = consulta({ data: { id: "l-1", downloads: 2 }, error: null });
    from.mockReturnValueOnce(lead);
    const contagem = consulta({ error: null });
    from.mockReturnValueOnce(contagem);
    // O Storage devolve Blob; aqui vai string porque sob jsdom o Blob (jsdom) e
    // o Response (Node) são de runtimes diferentes e não se entendem. No
    // Worker são o mesmo runtime. O que se prova é que o corpo passa intacto.
    download.mockResolvedValue({ data: "%PDF-1.4", error: null });

    const res = await responderDownloadManual(url(TOKEN));

    expect(lead.eq).toHaveBeenCalledWith("download_token", TOKEN);
    expect(storageFrom).toHaveBeenCalledWith("materiais");
    expect(download).toHaveBeenCalledWith("manual-pequena-marca.pdf");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment;");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe("%PDF-1.4");

    expect(contagem.update).toHaveBeenCalledWith({
      baixado_em: expect.any(String),
      downloads: 3,
    });
    expect(contagem.eq).toHaveBeenCalledWith("id", "l-1");
  });

  it("falha ao contar o download não segura a entrega", async () => {
    from.mockReturnValueOnce(consulta({ data: { id: "l-1", downloads: 0 }, error: null }));
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    download.mockResolvedValue({ data: "x", error: null });
    const res = await responderDownloadManual(url(TOKEN));
    expect(res.status).toBe(200);
  });
});
