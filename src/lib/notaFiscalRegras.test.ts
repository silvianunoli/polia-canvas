import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  formatarDocumento,
  tipoDocumento,
} from "../../supabase/functions/_shared/documentoFiscal";
import {
  CHAVE_CAMPO_DOCUMENTO,
  documentoDaCliente,
  documentoDoCampo,
  erroTemporario,
  faturaGeraNota,
  montarTomador,
  podeEmitir,
  separarNumero,
  tipoDeReembolso,
  valorEmReais,
} from "../../supabase/functions/_shared/notaFiscalRegras";

// PAY-32 (12/10/2026): nota fiscal automática pela NFE.io e cancelamento
// automático quando a assinatura é reembolsada.

describe("documento fiscal", () => {
  it("aceita CPF e CNPJ com dígito verificador certo, com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(tipoDocumento("52998224725")).toBe("cpf");
    expect(tipoDocumento("11222333000181")).toBe("cnpj");
  });

  it("recusa dígito errado, sequência repetida e tamanho errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(tipoDocumento("1234")).toBeNull();
    expect(tipoDocumento("")).toBeNull();
  });

  it("formata enquanto digita", () => {
    expect(formatarDocumento("529982")).toBe("529.982");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("112223330001819999")).toBe("11.222.333/0001-81");
  });
});

describe("faturaGeraNota", () => {
  it("emite só fatura paga em real com valor", () => {
    expect(faturaGeraNota({ status: "paid", amount_paid: 2990, currency: "brl" })).toBe(true);
    expect(faturaGeraNota({ status: "paid", amount_paid: 0, currency: "brl" })).toBe(false);
    expect(faturaGeraNota({ status: "open", amount_paid: 2990, currency: "brl" })).toBe(false);
    expect(faturaGeraNota({ status: "paid", amount_paid: 2990, currency: "usd" })).toBe(false);
  });
});

describe("tipoDeReembolso", () => {
  it("reembolso inteiro cancela a nota", () => {
    expect(tipoDeReembolso({ amount: 2990, amount_refunded: 2990, refunded: true })).toBe("total");
    expect(tipoDeReembolso({ amount: 2990, amount_refunded: 2990 })).toBe("total");
  });
  it("reembolso de parte do valor não cancela (NFS-e não cancela pela metade)", () => {
    expect(tipoDeReembolso({ amount: 2990, amount_refunded: 1000, refunded: false })).toBe(
      "parcial",
    );
  });
  it("sem valor devolvido não faz nada", () => {
    expect(tipoDeReembolso({ amount: 2990, amount_refunded: 0, refunded: false })).toBe("nenhum");
  });
});

describe("podeEmitir", () => {
  it("fatura nova emite", () => {
    expect(podeEmitir(null)).toBe(true);
  });
  it("reentrega do Stripe não emite a mesma nota duas vezes", () => {
    expect(podeEmitir({ status: "emitida", nfeio_id: "abc" })).toBe(false);
  });
  it("tentativa que falhou antes da NFE.io aceitar pode tentar de novo", () => {
    expect(podeEmitir({ status: "erro_emissao", nfeio_id: null })).toBe(true);
    expect(podeEmitir({ status: "emitindo", nfeio_id: null })).toBe(true);
  });
  it("fatura reembolsada antes da nota sair não emite mais", () => {
    expect(podeEmitir({ status: "cancelada", nfeio_id: null })).toBe(false);
  });
});

describe("erroTemporario", () => {
  it("fora do ar e tempo esgotado tentam de novo; dado inválido não", () => {
    expect(erroTemporario(500)).toBe(true);
    expect(erroTemporario(408)).toBe(true);
    expect(erroTemporario(429)).toBe(true);
    expect(erroTemporario(400)).toBe(false);
    expect(erroTemporario(401)).toBe(false);
  });
});

describe("documentoDaCliente", () => {
  it("lê o Tax ID do Stripe", () => {
    expect(documentoDaCliente([{ type: "br_cpf", value: "529.982.247-25" }], {})).toBe(
      "52998224725",
    );
  });
  it("cai pro metadata quando não tem Tax ID", () => {
    expect(documentoDaCliente([], { cpf_cnpj: "11.222.333/0001-81" })).toBe("11222333000181");
  });
  it("ignora documento inválido e tipo de outro país", () => {
    expect(documentoDaCliente([{ type: "eu_vat", value: "DE123" }], {})).toBeNull();
    expect(documentoDaCliente([{ type: "br_cpf", value: "11111111111" }], null)).toBeNull();
  });
});

describe("separarNumero", () => {
  it("tira o número do fim da linha", () => {
    expect(separarNumero("Rua das Flores, 123")).toEqual({ rua: "Rua das Flores", numero: "123" });
    expect(separarNumero("Av. Paulista 1000")).toEqual({ rua: "Av. Paulista", numero: "1000" });
    expect(separarNumero("Rua A, nº 45B")).toEqual({ rua: "Rua A", numero: "45B" });
  });
  it("sem número vira S/N", () => {
    expect(separarNumero("Estrada do Sítio")).toEqual({ rua: "Estrada do Sítio", numero: "S/N" });
  });
});

describe("montarTomador", () => {
  const endereco = {
    line1: "Rua das Flores, 123",
    line2: "Apto 4",
    city: "São Paulo",
    state: "SP",
    postal_code: "01310-100",
    country: "BR",
  };

  it("pessoa física com endereço completo", () => {
    expect(
      montarTomador({
        documento: "52998224725",
        nome: "Ana Souza",
        email: "ana@exemplo.com",
        endereco,
        codigoIbge: "3550308",
        bairro: "Bela Vista",
      }),
    ).toEqual({
      type: "NaturalPerson",
      federalTaxNumber: 52998224725,
      name: "Ana Souza",
      email: "ana@exemplo.com",
      address: {
        country: "BRA",
        postalCode: "01310100",
        street: "Rua das Flores",
        number: "123",
        additionalInformation: "Apto 4",
        district: "Bela Vista",
        city: { code: "3550308", name: "São Paulo" },
        state: "SP",
      },
    });
  });

  it("CNPJ vira pessoa jurídica", () => {
    const t = montarTomador({
      documento: "11222333000181",
      nome: "Ana Ltda",
      email: null,
      endereco: null,
      codigoIbge: null,
      bairro: null,
    });
    expect(t.type).toBe("LegalEntity");
    expect(t.federalTaxNumber).toBe(11222333000181);
  });

  it("sem código da cidade o endereço não vai (a prefeitura recusaria)", () => {
    const t = montarTomador({
      documento: "52998224725",
      nome: "Ana",
      email: null,
      endereco,
      codigoIbge: null,
      bairro: null,
    });
    expect(t.address).toBeUndefined();
  });

  it("assinante antiga sem CPF vai como não identificada, só nome e e-mail", () => {
    expect(
      montarTomador({
        documento: null,
        nome: "Ana",
        email: "ana@exemplo.com",
        endereco: null,
        codigoIbge: null,
        bairro: null,
      }),
    ).toEqual({ name: "Ana", email: "ana@exemplo.com" });
  });
});

describe("valorEmReais", () => {
  it("converte centavos", () => {
    expect(valorEmReais(2990)).toBe(29.9);
    expect(valorEmReais(47900)).toBe(479);
  });
});

describe("documentoDoCampo (campo do Checkout público)", () => {
  it("lê o CPF digitado no campo próprio", () => {
    expect(
      documentoDoCampo([{ key: CHAVE_CAMPO_DOCUMENTO, numeric: { value: "52998224725" } }]),
    ).toBe("52998224725");
  });
  it("número que não fecha o dígito vira nota sem documento, não nota errada", () => {
    expect(
      documentoDoCampo([{ key: CHAVE_CAMPO_DOCUMENTO, numeric: { value: "52998224726" } }]),
    ).toBeNull();
  });
  it("sessão sem o campo (compra antiga) não quebra", () => {
    expect(documentoDoCampo([])).toBeNull();
    expect(documentoDoCampo(undefined)).toBeNull();
    expect(documentoDoCampo([{ key: "outro", text: { value: "52998224725" } }])).toBeNull();
  });
});
