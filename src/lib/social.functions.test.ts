import { describe, it, expect, vi, beforeEach } from "vitest";

const { uploadMock, getPublicUrlMock, insertMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }),
    },
    from: () => ({ insert: insertMock }),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
  },
}));

const { validarQuantidadeETipo, criarPostManual } = await import("./social.functions");

function arquivoFalso(nome: string, tipo: string, tamanho = 1024): File {
  const conteudo = new Uint8Array(tamanho);
  return new File([conteudo], nome, { type: tipo });
}

describe("validarQuantidadeETipo", () => {
  it("exige exatamente 1 imagem pra foto única", () => {
    const erro = validarQuantidadeETipo("feed", [arquivoFalso("a.jpg", "image/jpeg")]);
    expect(erro).toBeNull();
  });

  it("reprova foto única com mais de 1 arquivo", () => {
    const erro = validarQuantidadeETipo("feed", [
      arquivoFalso("a.jpg", "image/jpeg"),
      arquivoFalso("b.jpg", "image/jpeg"),
    ]);
    expect(erro).toBe("Foto única leva exatamente 1 imagem.");
  });

  it("reprova carrossel com 1 imagem só (mínimo é 2)", () => {
    const erro = validarQuantidadeETipo("carrossel", [arquivoFalso("a.jpg", "image/jpeg")]);
    expect(erro).toBe("Carrossel vai de 2 a 10 imagens.");
  });

  it("reprova carrossel com 11 imagens (máximo é 10)", () => {
    const arquivos = Array.from({ length: 11 }, (_, i) => arquivoFalso(`${i}.jpg`, "image/jpeg"));
    const erro = validarQuantidadeETipo("carrossel", arquivos);
    expect(erro).toBe("Carrossel vai de 2 a 10 imagens.");
  });

  it("aceita carrossel com 2 a 10 imagens", () => {
    const arquivos = Array.from({ length: 5 }, (_, i) => arquivoFalso(`${i}.jpg`, "image/jpeg"));
    expect(validarQuantidadeETipo("carrossel", arquivos)).toBeNull();
  });

  it("reprova mídia de tipo errado em feed/carrossel", () => {
    const erro = validarQuantidadeETipo("feed", [arquivoFalso("a.mp4", "video/mp4")]);
    expect(erro).toBe("Essa mídia não serve pro formato. Feed e carrossel: imagem 4:5 (1080x1350).");
  });

  it("aceita vídeo mp4 em story", () => {
    expect(validarQuantidadeETipo("story", [arquivoFalso("a.mp4", "video/mp4")])).toBeNull();
  });

  it("reprova story sem nenhuma mídia", () => {
    const erro = validarQuantidadeETipo("story", []);
    expect(erro).toBe("Adiciona ao menos 1 imagem ou vídeo pro story.");
  });

  it("reprova arquivo acima do tamanho máximo", () => {
    const grande = arquivoFalso("a.jpg", "image/jpeg", 9 * 1024 * 1024);
    const erro = validarQuantidadeETipo("feed", [grande]);
    expect(erro).toBe("Arquivo grande demais. Reduz e envia de novo.");
  });
});

describe("criarPostManual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia o save quando a legenda reprova no lint R1, sem chamar upload nem insert", async () => {
    const resultado = await criarPostManual({
      tipo: "feed",
      pilar: null,
      caption: "Faz do seu jeito, sem pressa.",
      altText: ["descrição"],
      arquivos: [arquivoFalso("a.jpg", "image/jpeg")],
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok && typeof resultado.erro !== "string") {
      expect(resultado.erro.termo).toBe('"do seu jeito"');
    }
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("bloqueia o save quando falta alt text de alguma mídia", async () => {
    const resultado = await criarPostManual({
      tipo: "feed",
      pilar: null,
      caption: "Quanto sobra depois do custo fixo.",
      altText: [""],
      arquivos: [arquivoFalso("a.jpg", "image/jpeg")],
    });
    expect(resultado.ok).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("sobe a mídia e insere a peça como rascunho quando tudo passa", async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://cdn.example/social/x.jpg" } });
    insertMock.mockResolvedValue({ error: null });

    const resultado = await criarPostManual({
      tipo: "feed",
      pilar: "P5",
      caption: "Quanto sobra depois do custo fixo.",
      altText: ["print da planilha"],
      arquivos: [arquivoFalso("a.jpg", "image/jpeg")],
    });

    expect(resultado.ok).toBe(true);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertPayload = insertMock.mock.calls[0][0];
    expect(insertPayload.status).toBe("rascunho");
    expect(insertPayload.origem_criacao).toBe("manual");
    expect(insertPayload.midias).toEqual(["https://cdn.example/social/x.jpg"]);
  });

  it("retorna erro amigável quando o upload falha", async () => {
    uploadMock.mockResolvedValue({ error: { message: "network down" } });

    const resultado = await criarPostManual({
      tipo: "feed",
      pilar: null,
      caption: "Quanto sobra depois do custo fixo.",
      altText: ["descrição"],
      arquivos: [arquivoFalso("a.jpg", "image/jpeg")],
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toBe("A mídia não subiu. Tenta de novo.");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
