import { describe, expect, it } from "vitest";
import {
  CABECALHO_PLANILHA,
  chaveDaForma,
  fechamentoDoMes,
  limitesDoMesISO,
  linhasDaPlanilha,
  type ExtrasDoFechamento,
  type LancamentoDoFechamento,
} from "./fechamentoDoMes";

const l = (
  id: string,
  tipo: "entrada" | "saida",
  valor: number,
  data: string,
  forma: string | null = null,
  descricao: string | null = null,
): LancamentoDoFechamento => ({ id, tipo, valor, data, descricao, categoria: null, forma });

const semExtras: ExtrasDoFechamento = { contasPagas: [], contasRecebidas: [], vendas: [] };

describe("limitesDoMesISO e chaveDaForma", () => {
  it("acha o último dia do mês, inclusive fevereiro bissexto", () => {
    expect(limitesDoMesISO("2026-11")).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
    expect(limitesDoMesISO("2028-02")).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
  });
  it("forma desconhecida ou vazia vira não informada", () => {
    expect(chaveDaForma("pix")).toBe("pix");
    expect(chaveDaForma("voucher")).toBe("nao_informada");
    expect(chaveDaForma(null)).toBe("nao_informada");
  });
});

describe("fechamentoDoMes", () => {
  const lancamentos = [
    l("e1", "entrada", 64.96, "2026-10-19", "pix"),
    l("e2", "entrada", 215.88, "2026-10-19", "credito"),
    l("e3", "entrada", 0.1, "2026-10-21", "pix"),
    l("e4", "entrada", 0.2, "2026-10-21", "pix"),
    l("e5", "entrada", 57.97, "2026-10-21", null),
    l("s1", "saida", 412.08, "2026-10-28"),
    l("fora", "entrada", 999, "2026-11-01", "pix"),
  ];

  it("soma entradas por forma, na ordem das formas, com não informada no fim", () => {
    const f = fechamentoDoMes(lancamentos, "2026-10", semExtras);
    expect(f.porForma).toEqual([
      { chave: "pix", total: 65.26, quantidade: 3 },
      { chave: "credito", total: 215.88, quantidade: 1 },
      { chave: "nao_informada", total: 57.97, quantidade: 1 },
    ]);
    expect(f.saidasPorForma).toEqual([{ chave: "nao_informada", total: 412.08, quantidade: 1 }]);
    expect(f.entradas).toBe(339.11);
    expect(f.saidas).toBe(412.08);
  });

  it("monta o dia a dia só com os dias que tiveram movimento", () => {
    const f = fechamentoDoMes(lancamentos, "2026-10", semExtras);
    expect(f.porDia.map((d) => [d.data, d.entradas, d.saidas])).toEqual([
      ["2026-10-19", 280.84, 0],
      ["2026-10-21", 58.27, 0],
      ["2026-10-28", 0, 412.08],
    ]);
    expect(f.porDia[1].porForma).toEqual({ pix: 0.3, nao_informada: 57.97 });
  });

  it("separa taxas no recebimento, juros pagos e descontos obtidos, só do mês", () => {
    const f = fechamentoDoMes(
      [
        l("v1", "entrada", 113.5, "2026-10-20", "credito"),
        l("r1", "entrada", 95.01, "2026-10-20", "credito"),
        l("p1", "saida", 412.08, "2026-10-28"),
        l("p2", "saida", 95, "2026-10-29"),
        l("p3", "saida", 2972.27, "2026-10-22"),
      ],
      "2026-10",
      {
        vendas: [
          { lancamentoId: "v1", clienteNome: "Ana", total: 120, taxaCanal: 6.5, custoEnvio: 0 },
          { lancamentoId: "outro-mes", clienteNome: null, total: 50, taxaCanal: 5, custoEnvio: 0 },
        ],
        contasRecebidas: [
          {
            lancamentoId: "r1",
            cliente: "Bia",
            documento: null,
            parcela: null,
            parcelas: null,
            valor: 100,
            valorRecebido: 95.01,
          },
        ],
        contasPagas: [
          {
            lancamentoId: "p1",
            fornecedor: "Nina",
            documento: null,
            parcela: null,
            parcelas: null,
            valor: 400,
            valorPago: 412.08,
          },
          {
            lancamentoId: "p2",
            fornecedor: null,
            documento: null,
            parcela: null,
            parcelas: null,
            valor: 100,
            valorPago: 95,
          },
          {
            lancamentoId: "p3",
            fornecedor: null,
            documento: null,
            parcela: null,
            parcelas: null,
            valor: 2972.27,
            valorPago: null,
          },
        ],
      },
    );
    expect(f.taxasNoRecebimento).toBe(11.49);
    expect(f.jurosPagos).toBe(12.08);
    expect(f.descontosObtidos).toBe(5);
  });
});

describe("linhasDaPlanilha", () => {
  it("leva fornecedor, documento, parcela e o valor original da conta", () => {
    const linhas = linhasDaPlanilha(
      [
        l("p1", "saida", 412.08, "2026-10-28", null, "Frutas (2/3) · Nina"),
        l("r1", "entrada", 95.01, "2026-10-20", "credito", "Resto da encomenda"),
        l("e1", "entrada", 64.96, "2026-10-19", "pix", "Venda balcão"),
      ],
      "2026-10",
      {
        vendas: [],
        contasRecebidas: [
          {
            lancamentoId: "r1",
            cliente: "Bia",
            documento: "pedido 128",
            parcela: null,
            parcelas: null,
            valor: 100,
            valorRecebido: 95.01,
          },
        ],
        contasPagas: [
          {
            lancamentoId: "p1",
            fornecedor: "Nina Rainha das Frutas",
            documento: "NF-e 261026",
            parcela: 2,
            parcelas: 3,
            valor: 400,
            valorPago: 412.08,
          },
        ],
      },
    );
    expect(CABECALHO_PLANILHA).toHaveLength(9);
    expect(linhas).toEqual([
      ["Entrada", "19/10/2026", "", "", "Pix", "Venda balcão", "", "64,96", "64,96"],
      [
        "Entrada",
        "20/10/2026",
        "Bia",
        "pedido 128",
        "Crédito à vista",
        "Resto da encomenda",
        "",
        "100,00",
        "95,01",
      ],
      [
        "Saída",
        "28/10/2026",
        "Nina Rainha das Frutas",
        "NF-e 261026 · parcela 2/3",
        "Não informada",
        "Frutas (2/3) · Nina",
        "",
        "400,00",
        "412,08",
      ],
    ]);
  });
});

describe("saídas por forma de pagamento", () => {
  it("separa boleto, Pix e não informada nas saídas, e o boleto vai pra planilha", () => {
    const lancs = [
      l("s1", "saida", 2972.27, "2026-10-22", "boleto", "Aluguel"),
      l("s2", "saida", 77.8, "2026-10-28", "pix", "Leite condensado"),
      l("s3", "saida", 110.8, "2026-10-31", "boleto", "Torneira"),
      l("s4", "saida", 100, "2026-10-27", null, "Freelancer"),
    ];
    const f = fechamentoDoMes(lancs, "2026-10", semExtras);
    expect(f.saidasPorForma).toEqual([
      { chave: "pix", total: 77.8, quantidade: 1 },
      { chave: "boleto", total: 3083.07, quantidade: 2 },
      { chave: "nao_informada", total: 100, quantidade: 1 },
    ]);
    expect(f.porForma).toEqual([]);
    expect(chaveDaForma("boleto")).toBe("boleto");
    const linhas = linhasDaPlanilha(lancs, "2026-10", semExtras);
    expect(linhas[0].slice(0, 5)).toEqual(["Saída", "22/10/2026", "", "", "Boleto"]);
  });
});
