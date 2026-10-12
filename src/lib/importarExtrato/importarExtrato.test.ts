import { describe, expect, it } from "vitest";
import {
  criarSugestorDeCategoria,
  decodificarArquivo,
  formatoDoArquivo,
  lerArquivo,
  lerDataExtrato,
  lerValorExtrato,
  linhasDoCsv,
  marcarRepetidos,
  type LinhaImportada,
} from "./index";
import { detectarColunas, lerCsvExtrato } from "./csvExtrato";
import { lerOfx } from "./ofx";
import { lerNfe } from "./nfe";

describe("lerValorExtrato", () => {
  it.each([
    ["-1.234,56", -1234.56],
    ["R$ 29,90", 29.9],
    ["(29,90)", -29.9],
    ["29,90 D", -29.9],
    ["180,00 C", 180],
    ["1234.56", 1234.56],
    ["-29.90", -29.9],
    ["1.234", 1234],
    ["1,234.50", 1234.5],
    ["50-", -50],
  ])("%s vira %s", (bruto, esperado) => {
    expect(lerValorExtrato(bruto)).toBeCloseTo(esperado, 2);
  });

  it("texto que não é número volta null", () => {
    expect(lerValorExtrato("")).toBeNull();
    expect(lerValorExtrato("abc")).toBeNull();
  });
});

describe("lerDataExtrato", () => {
  it.each([
    ["02/10/2026", "2026-10-02"],
    ["2/10/26", "2026-10-02"],
    ["2026-10-02", "2026-10-02"],
    ["02.10.2026", "2026-10-02"],
    ["20261002120000[-3:BRT]", "2026-10-02"],
  ])("%s vira %s", (bruto, esperado) => {
    expect(lerDataExtrato(bruto)).toBe(esperado);
  });

  it("data que não existe volta null", () => {
    expect(lerDataExtrato("31/02/2026")).toBeNull();
    expect(lerDataExtrato("Total")).toBeNull();
  });
});

describe("decodificarArquivo", () => {
  it("lê Windows-1252 quando o UTF-8 não fecha", () => {
    const bytes = new Uint8Array([0x50, 0xe3, 0x6f]); // "Pão" em 1252
    expect(decodificarArquivo(bytes.buffer)).toBe("Pão");
  });
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0260<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261002120000[-3:BRT]<TRNAMT>180.00<FITID>A1<MEMO>PIX RECEBIDO MARIA S
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003<TRNAMT>-29.90<FITID>A2<NAME>TARIFA PACOTE
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261004<TRNAMT>0.00<FITID>A3<MEMO>ZERADO
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_XML = `<?xml version="1.0"?><OFX><BANKACCTFROM><ACCTID>999</ACCTID></BANKACCTFROM>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261005</DTPOSTED><TRNAMT>-900,00</TRNAMT><FITID>X9</FITID><MEMO>ALUGUEL ATELIE</MEMO></STMTTRN></OFX>`;

describe("lerOfx", () => {
  it("lê o OFX em SGML, com sinal e id do banco", () => {
    const r = lerOfx(OFX_SGML);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas).toEqual([
      {
        data: "2026-10-02",
        descricao: "PIX RECEBIDO MARIA S",
        valor: 180,
        tipo: "entrada",
        idExterno: "ofx:12345-6:A1",
      },
      {
        data: "2026-10-03",
        descricao: "TARIFA PACOTE",
        valor: 29.9,
        tipo: "saida",
        idExterno: "ofx:12345-6:A2",
      },
    ]);
    expect(r.avisos).toHaveLength(1);
  });

  it("lê o OFX em XML com vírgula decimal", () => {
    const r = lerOfx(OFX_XML);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]).toMatchObject({ valor: 900, tipo: "saida", idExterno: "ofx:999:X9" });
  });

  it("arquivo que não é OFX dá erro", () => {
    expect(lerOfx("data;valor")).toHaveProperty("erro");
  });
});

describe("CSV de extrato", () => {
  it("acha a tabela depois do cabeçalho da conta e pula o saldo", () => {
    const texto = [
      "Agência: 0001;Conta: 12345-6",
      "",
      "Data;Histórico;Valor (R$);Saldo (R$)",
      "01/10/2026;SALDO ANTERIOR;;1.000,00",
      "02/10/2026;PIX RECEBIDO MARIA;180,00;1.180,00",
      "03/10/2026;TARIFA PACOTE;-29,90;1.150,10",
      "Total;;150,10;",
    ].join("\n");
    const r = lerArquivo("extrato.csv", texto, null);
    if (r.tipo !== "linhas") throw new Error(r.tipo);
    expect(r.linhas.map((l) => [l.data, l.tipo, l.valor])).toEqual([
      ["2026-10-02", "entrada", 180],
      ["2026-10-03", "saida", 29.9],
    ]);
    expect(r.avisos.join(" ")).toMatch(/saldo/i);
  });

  it("entende banco que separa crédito e débito", () => {
    const colunas = detectarColunas(["Data", "Descrição", "Crédito", "Débito", "Saldo"]);
    expect(colunas).toEqual({ data: 0, descricao: 1, credito: 2, debito: 3 });
    const r = linhasDoCsv(
      [
        ["Data", "Descrição", "Crédito", "Débito", "Saldo"],
        ["02/10/2026", "VENDA CIELO", "250,00", "", "10"],
        ["03/10/2026", "DAS MEI", "", "75,90", "10"],
      ],
      colunas!,
      0,
    );
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas.map((l) => [l.tipo, l.valor])).toEqual([
      ["entrada", 250],
      ["saida", 75.9],
    ]);
  });

  it("separador vírgula com aspas", () => {
    const r = lerArquivo("x.csv", 'date,description,amount\n2026-10-02,"Canva, Inc",-34.90', null);
    if (r.tipo !== "linhas") throw new Error(r.tipo);
    expect(r.linhas[0]).toMatchObject({ descricao: "Canva, Inc", valor: 34.9, tipo: "saida" });
  });

  it("sem títulos reconhecíveis, pede pra mapear as colunas", () => {
    expect(lerCsvExtrato("02/10/2026;PIX;180,00\n03/10/2026;TARIFA;-29,90").tipo).toBe("mapear");
  });
});

const nfe = (emit: string, dest: string) => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35261012345678000199550010000001231000001234" versao="4.00">
<ide><nNF>123</nNF><dhEmi>2026-10-02T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>${emit}</CNPJ><xNome>Malharia Sol</xNome></emit>
<dest><CNPJ>${dest}</CNPJ><xNome>Ateliê Florescer</xNome></dest>
<total><ICMSTot><vNF>450.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

describe("lerNfe", () => {
  it("nota emitida pelo CNPJ dela é venda", () => {
    const r = lerNfe(nfe("11222333000181", "99888777000166"), "11.222.333/0001-81");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]).toMatchObject({
      data: "2026-10-02",
      valor: 450,
      tipo: "entrada",
      descricao: "NF 123 · Ateliê Florescer",
      categoria: "Venda de produto",
      idExterno: "nfe:35261012345678000199550010000001231000001234",
    });
  });

  it("nota de fornecedor é compra", () => {
    const r = lerNfe(nfe("99888777000166", "11222333000181"), "11222333000181");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]).toMatchObject({ tipo: "saida", descricao: "NF 123 · Malharia Sol" });
  });

  it("sem CNPJ cadastrado, trata como compra e avisa", () => {
    const r = lerNfe(nfe("11222333000181", "99888777000166"), null);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0].tipo).toBe("saida");
    expect(r.avisos).toHaveLength(1);
  });

  it("XML que não é NF-e dá erro", () => {
    expect(lerNfe("<CompNfse><Nfse/></CompNfse>", null)).toHaveProperty("erro");
    expect(lerNfe("<isso nao fecha", null)).toHaveProperty("erro");
  });
});

describe("formatoDoArquivo", () => {
  it("reconhece pela extensão e pelo conteúdo", () => {
    expect(formatoDoArquivo("extrato.OFX", "")).toBe("ofx");
    expect(formatoDoArquivo("extrato.txt", "<OFX>")).toBe("ofx");
    expect(formatoDoArquivo("nota.xml", "")).toBe("xml");
    expect(formatoDoArquivo("planilha.csv", "a;b")).toBe("csv");
    expect(formatoDoArquivo("planilha.xlsx", "PK")).toBeNull();
  });

  it("planilha do Excel explica como salvar em CSV", () => {
    const r = lerArquivo("planilha.xlsx", "PK", null);
    expect(r.tipo).toBe("erro");
    if (r.tipo === "erro") expect(r.erro).toMatch(/CSV/);
  });
});

describe("criarSugestorDeCategoria", () => {
  it("o histórico dela vence as palavras de banco", () => {
    const sugerir = criarSugestorDeCategoria([
      {
        data: "2026-09-03",
        valor: 29.9,
        tipo: "saida",
        descricao: "TARIFA PACOTE 09",
        categoria: "Outros",
      },
    ]);
    expect(sugerir("TARIFA PACOTE 10", "saida")).toBe("Outros");
    expect(sugerir("TARIFA AVULSA", "saida")).toBe("Taxas fixas");
  });

  it("usa palavras comuns de extrato", () => {
    const sugerir = criarSugestorDeCategoria([]);
    expect(sugerir("PAGTO DAS SIMPLES NACIONAL", "saida")).toBe("Contador e imposto fixo");
    expect(sugerir("FACEBK *ADS", "saida")).toBe("Marketing");
    expect(sugerir("Conta de Luz ENEL", "saida")).toBe("Luz, água e gás");
    expect(sugerir("VENDA CIELO DEBITO", "entrada")).toBe("Venda de produto");
  });

  it("PIX recebido fica sem sugestão: pode ser transferência dela mesma", () => {
    expect(criarSugestorDeCategoria([])("PIX RECEBIDO MARIA", "entrada")).toBeNull();
  });
});

describe("marcarRepetidos", () => {
  const linha = (over: Partial<LinhaImportada>): LinhaImportada => ({
    data: "2026-10-02",
    descricao: "CAFE",
    valor: 8,
    tipo: "saida",
    idExterno: null,
    ...over,
  });

  it("conta por quantidade: um já lançado, só um é repetido", () => {
    const r = marcarRepetidos(
      [linha({}), linha({}), linha({ valor: 9 })],
      [{ data: "2026-10-02", valor: 8, tipo: "saida" }],
    );
    expect(r).toEqual([true, false, false]);
  });

  it("mesmo id do banco duas vezes no arquivo: a segunda é repetida", () => {
    const r = marcarRepetidos([linha({ idExterno: "a" }), linha({ idExterno: "a", valor: 3 })], []);
    expect(r).toEqual([false, true]);
  });

  it("entrada e saída de mesmo valor não se confundem", () => {
    expect(
      marcarRepetidos(
        [linha({ tipo: "entrada" })],
        [{ data: "2026-10-02", valor: 8, tipo: "saida" }],
      ),
    ).toEqual([false]);
  });
});
