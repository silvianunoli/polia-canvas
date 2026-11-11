import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const { from, storageFrom, download } = vi.hoisted(() => {
  const download = vi.fn();
  return { from: vi.fn(), download, storageFrom: vi.fn(() => ({ download })) };
});
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, storage: { from: storageFrom } },
}));

import { responderDownloadIsca } from "./download.server";

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
const SLUG = "black-friday";
const url = (t: string | null, slug = SLUG) =>
  new URL(
    `https://one.usepolia.com.br/materiais/${slug}/baixar${t === null ? "" : `?t=${t}`}`,
  );
const PAGINA = "https://one.usepolia.com.br/materiais/black-friday";

beforeEach(() => {
  from.mockReset();
  storageFrom.mockClear();
  download.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("responderDownloadIsca: volta pra página com aviso", () => {
  it("slug fora do catálogo: manda pra página (que vira o 404), sem banco", async () => {
    const res = await responderDownloadIsca(url(TOKEN, "natal-2099"), "natal-2099");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://one.usepolia.com.br/materiais/natal-2099");
    expect(from).not.toHaveBeenCalled();
  });

  it("token ausente ou malformado: aviso=link, sem consultar o banco", async () => {
    for (const t of [null, "abc"]) {
      const res = await responderDownloadIsca(url(t), SLUG);
      expect(res.headers.get("location")).toBe(`${PAGINA}?aviso=link`);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("token que não existe nesta isca: aviso=link, e a busca filtra pelo slug", async () => {
    const q = consulta({ data: null, error: null });
    from.mockReturnValueOnce(q);
    const res = await responderDownloadIsca(url(TOKEN), SLUG);
    expect(res.headers.get("location")).toBe(`${PAGINA}?aviso=link`);
    expect(from).toHaveBeenCalledWith("isca_leads");
    expect(q.eq).toHaveBeenCalledWith("download_token", TOKEN);
    expect(q.eq).toHaveBeenCalledWith("isca_slug", SLUG);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("erro do banco: aviso=erro", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: { message: "db" } }));
    const res = await responderDownloadIsca(url(TOKEN), SLUG);
    expect(res.headers.get("location")).toBe(`${PAGINA}?aviso=erro`);
  });

  it("PDF ausente do bucket: aviso=erro e não conta download", async () => {
    from.mockReturnValueOnce(consulta({ data: { id: "l-1", downloads: 0 }, error: null }));
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await responderDownloadIsca(url(TOKEN), SLUG);
    expect(res.headers.get("location")).toBe(`${PAGINA}?aviso=erro`);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("responderDownloadIsca: entrega", () => {
  it("lê do bucket privado iscas, conta o download e responde como anexo", async () => {
    from.mockReturnValueOnce(consulta({ data: { id: "l-1", downloads: 2 }, error: null }));
    const contagem = consulta({ error: null });
    from.mockReturnValueOnce(contagem);
    // Mesmo cuidado do teste do manual: sob jsdom o Blob (jsdom) e o Response
    // (Node) são de runtimes diferentes e quebram no CI (Node 22). No Worker são
    // o mesmo runtime. O que se prova é que o corpo passa intacto.
    download.mockResolvedValue({ data: "%PDF", error: null });

    const res = await responderDownloadIsca(url(TOKEN), SLUG);

    expect(res.status).toBe(200);
    expect(storageFrom).toHaveBeenCalledWith("iscas");
    expect(download).toHaveBeenCalledWith("checklist-black-friday-polia.pdf");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="checklist-black-friday-polia.pdf"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(contagem.update).toHaveBeenCalledWith({
      baixado_em: expect.any(String),
      downloads: 3,
    });
  });
});
