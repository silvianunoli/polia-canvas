import { describe, it, expect, afterEach, vi } from "vitest";
import { parseCsv, gerarCsv, baixarCsv } from "./csv";

describe("parseCsv", () => {
  it("separa campos por vírgula e linhas por quebra de linha", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("normaliza CRLF (arquivo salvo no Windows/Excel) pra LF", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mantém a vírgula dentro de campo entre aspas", () => {
    expect(parseCsv('nome,resposta\nAna,"sim, com certeza"')).toEqual([
      ["nome", "resposta"],
      ["Ana", "sim, com certeza"],
    ]);
  });

  it("desescapa aspas dobradas dentro de campo entre aspas", () => {
    expect(parseCsv('"ela disse ""oi"""')).toEqual([['ela disse "oi"']]);
  });

  it("mantém quebra de linha dentro de campo entre aspas (resposta aberta com parágrafos)", () => {
    expect(parseCsv('"linha 1\nlinha 2",x')).toEqual([["linha 1\nlinha 2", "x"]]);
  });

  it("descarta linhas totalmente vazias ou só com espaços", () => {
    expect(parseCsv("a,b\n\n   \n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserva campo vazio no meio da linha", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("não deixa a última linha de fora quando o arquivo não termina em quebra de linha", () => {
    expect(parseCsv("a\nb")).toEqual([["a"], ["b"]]);
  });

  it("devolve lista vazia pra texto vazio", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("gerarCsv", () => {
  it("põe o cabeçalho na primeira linha e junta linhas com CRLF (RFC 4180)", () => {
    expect(gerarCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("envolve em aspas o campo que tem vírgula", () => {
    expect(gerarCsv(["x"], [["sim, claro"]])).toBe('x\r\n"sim, claro"');
  });

  it("dobra as aspas internas e envolve o campo", () => {
    expect(gerarCsv(["x"], [['ela disse "oi"']])).toBe('x\r\n"ela disse ""oi"""');
  });

  it("envolve em aspas o campo com quebra de linha", () => {
    expect(gerarCsv(["x"], [["a\nb"]])).toBe('x\r\n"a\nb"');
  });

  it("não põe aspas em campo simples (acento e espaço não exigem)", () => {
    expect(gerarCsv(["Descrição"], [["Bolo de cenoura"]])).toBe("Descrição\r\nBolo de cenoura");
  });

  it("faz a viagem de ida e volta com parseCsv sem perder dado", () => {
    const linhas = [
      ["Ana", 'disse "oi", e foi', "a\nb"],
      ["", "vazio no começo", ""],
    ];
    expect(parseCsv(gerarCsv(["n", "r", "q"], linhas))).toEqual([["n", "r", "q"], ...linhas]);
  });
});

describe("baixarCsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // jsdom não implementa URL.createObjectURL; o download real é um clique
  // programático num <a>, então espiamos o clique em vez de deixar navegar.
  function prepararDownload() {
    let blobRecebido: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => {
      blobRecebido = b;
      return "blob:fake";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    return { createObjectURL, revokeObjectURL, click, blob: () => blobRecebido };
  }

  it("dispara o clique num <a download> com o nome do arquivo e libera a URL depois", () => {
    const { click, revokeObjectURL } = prepararDownload();
    let hrefNoClique = "";
    let downloadNoClique = "";
    click.mockImplementation(function (this: HTMLAnchorElement) {
      hrefNoClique = this.href;
      downloadNoClique = this.download;
    });

    baixarCsv("respostas.csv", "a,b");

    expect(click).toHaveBeenCalledTimes(1);
    expect(hrefNoClique).toBe("blob:fake");
    expect(downloadNoClique).toBe("respostas.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    // o <a> temporário não pode ficar sobrando no DOM
    expect(document.querySelector("a[download]")).toBeNull();
  });

  // Sem o BOM o Excel no Windows abre "Descrição" com acento quebrado.
  it("prefixa o conteúdo com BOM UTF-8 e usa o MIME text/csv", async () => {
    const { blob } = prepararDownload();
    baixarCsv("x.csv", "Descrição");

    const b = blob();
    expect(b).toBeDefined();
    expect(b!.type).toBe("text/csv;charset=utf-8;");
    // Blob.text() usa TextDecoder, que engole o BOM; lemos os bytes crus.
    const bytes = new Uint8Array(await b!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("Descrição");
  });
});
