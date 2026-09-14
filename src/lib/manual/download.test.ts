import { describe, expect, it } from "vitest";
import {
  CAMINHO_DOWNLOAD,
  ehCaminhoDeDownload,
  montarCabecalhosDownload,
  tokenDownloadValido,
  urlDownloadManual,
} from "./download";
import { NOME_ARQUIVO_PDF } from "./conteudo";

const TOKEN = "3f2504e0-4f89-4d3a-9a0c-0305e82c3301";

describe("token de download", () => {
  it("aceita uuid v4, que é o que o banco gera", () => {
    expect(tokenDownloadValido(TOKEN)).toBe(true);
    expect(tokenDownloadValido(TOKEN.toUpperCase())).toBe(true);
  });

  it("recusa vazio, lixo e uuid de outra versão", () => {
    expect(tokenDownloadValido(null)).toBe(false);
    expect(tokenDownloadValido(undefined)).toBe(false);
    expect(tokenDownloadValido("")).toBe(false);
    expect(tokenDownloadValido("abc")).toBe(false);
    expect(tokenDownloadValido("3f2504e0-4f89-1d3a-9a0c-0305e82c3301")).toBe(false);
    expect(tokenDownloadValido(`${TOKEN}'; DROP TABLE manual_leads;--`)).toBe(false);
  });
});

describe("caminhos", () => {
  it("só a rota exata de download é tratada", () => {
    expect(ehCaminhoDeDownload(CAMINHO_DOWNLOAD)).toBe(true);
    expect(ehCaminhoDeDownload("/manual")).toBe(false);
    expect(ehCaminhoDeDownload("/manual/baixar/")).toBe(false);
  });

  it("a URL do e-mail aponta pro domínio próprio, nunca pro workers.dev", () => {
    const url = urlDownloadManual(TOKEN);
    expect(url).toBe(`https://usepolia.com.br/manual/baixar?t=${TOKEN}`);
    expect(url).not.toContain("workers.dev");
  });
});

describe("cabeçalhos do download", () => {
  const h = montarCabecalhosDownload();

  it("entrega como PDF pra baixar, com o nome legível", () => {
    expect(h["content-type"]).toBe("application/pdf");
    expect(h["content-disposition"]).toBe(`attachment; filename="${NOME_ARQUIVO_PDF}"`);
  });

  it("não deixa cache nem indexar um link privado", () => {
    expect(h["cache-control"]).toContain("no-store");
    expect(h["x-robots-tag"]).toContain("noindex");
  });
});
