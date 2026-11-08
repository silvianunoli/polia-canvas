import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  envioDoBanco,
  envioParaBanco,
  envioVazio,
  lerMedida,
  normalizarCep,
  pendenciasDoEnvio,
  problemasDoEnvio,
  type EnvioLoja,
} from "./envioLoja";
import {
  corpoCotacao,
  nomeDaConta,
  opcoesDaCotacao,
  precisaRenovar,
  tokensDaResposta,
  urlAutorizacao,
} from "../../supabase/functions/_shared/melhorEnvio.ts";

describe("cotação do Melhor Envio", () => {
  it("manda as medidas do cadastro nos nomes que a API pede", () => {
    const c = corpoCotacao({
      origem: "01001000",
      destino: "05583000",
      produtos: [{ id: "p", quantidade: 2, peso_kg: 0.4, altura_cm: 10, largura_cm: 12, comprimento_cm: 14, valor: 39.9 }],
    });
    expect(c.from.postal_code).toBe("01001000");
    expect(c.to.postal_code).toBe("05583000");
    expect(c.products[0]).toEqual({ id: "p", width: 12, height: 10, length: 14, weight: 0.4, insurance_value: 39.9, quantity: 2 });
  });
  it("ignora serviço com erro, ordena pelo preço e guarda o pacote", () => {
    const o = opcoesDaCotacao([
      { id: 2, name: "SEDEX", price: "40.10", delivery_time: 2, company: { name: "Correios" }, packages: [] },
      { id: 1, name: "PAC", price: "22.90", custom_price: "20.15", delivery_time: 9, custom_delivery_time: 7, company: { name: "Correios" }, packages: [{ dimensions: { height: 10 }, weight: "0.4", insurance_value: "39.90" }] },
      { id: 3, name: "Mini", error: "Transportadora não atende este trecho." },
    ]);
    expect(o.map((s) => s.id)).toEqual([1, 2]);
    expect(o[0]).toMatchObject({ preco: 20.15, prazo: 7, empresa: "Correios", pacotes: [{ peso: "0.4" }] });
  });
  it("resposta torta vira lista vazia", () => {
    expect(opcoesDaCotacao(null)).toEqual([]);
    expect(opcoesDaCotacao([{ id: 1, name: "X", price: "abc", delivery_time: 1 }])).toEqual([]);
  });
});

const completo = (): EnvioLoja => ({
  cepOrigem: "05583-000",
  caixaPadrao: { pesoKg: 0.5, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 },
  retirada: { ativa: true, instrucoes: "Combinar pelo WhatsApp." },
  remetente: {
    nome: "Nunoli Soluções Digitais Ltda",
    documento: "18.305.925/0001-06",
    telefone: "(11) 97743-5996",
    email: "MUNDODEAIMER@gmail.com",
    cep: "05583-000",
    rua: "Rua Exemplo",
    numero: "10",
    complemento: "",
    bairro: "Butantã",
    cidade: "São Paulo",
    uf: "sp",
  },
});

describe("documentos e CEP", () => {
  it("CPF e CNPJ com dígito certo", () => {
    expect(cpfValido("123.456.789-09")).toBe(true);
    expect(cpfValido("123.456.789-00")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cnpjValido("18.305.925/0001-06")).toBe(true);
    expect(cnpjValido("18.305.925/0001-07")).toBe(false);
  });
  it("CEP só com 8 números", () => {
    expect(normalizarCep("05583-000")).toBe("05583000");
    expect(normalizarCep("0558")).toBeNull();
  });
});

describe("problemasDoEnvio", () => {
  it("completo não tem problema", () => {
    expect(problemasDoEnvio(completo())).toEqual([]);
  });
  it("aponta documento, telefone, e-mail, UF e retirada sem texto", () => {
    const e = completo();
    e.remetente.documento = "123";
    e.remetente.telefone = "99";
    e.remetente.email = "x";
    e.remetente.uf = "XX";
    e.retirada.instrucoes = " ";
    expect(problemasDoEnvio(e)).toHaveLength(5);
  });
  it("vazio não é problema, é pendência", () => {
    expect(problemasDoEnvio(envioVazio())).toEqual([]);
    expect(pendenciasDoEnvio(envioVazio())).toEqual(["CEP de origem", "caixa padrão", "remetente"]);
    expect(pendenciasDoEnvio(completo())).toEqual([]);
  });
});

describe("banco", () => {
  it("vai e volta igual, já limpo", () => {
    const banco = envioParaBanco(completo());
    expect(banco.cep_origem).toBe("05583000");
    expect(banco.remetente).toMatchObject({ documento: "18305925000106", telefone: "11977435996", email: "mundodeaimer@gmail.com", uf: "SP" });
    const volta = envioDoBanco(banco);
    expect(volta.caixaPadrao).toEqual(completo().caixaPadrao);
    expect(volta.retirada.ativa).toBe(true);
  });
  it("dado torto vira vazio, sem quebrar a tela", () => {
    expect(envioDoBanco(null)).toEqual(envioVazio());
    expect(envioDoBanco({ caixa_padrao: { peso_kg: 999 } })).toEqual(envioVazio());
    expect(envioDoBanco({ retirada: "sim" }).retirada.ativa).toBe(false);
  });
});

describe("lerMedida", () => {
  it("aceita vírgula e vazio", () => {
    expect(lerMedida("1,5")).toBe(1.5);
    expect(lerMedida("")).toBeNull();
    expect(lerMedida("abc")).toBeNaN();
  });
});

describe("Melhor Envio: regras da conexão", () => {
  const agora = Date.UTC(2026, 10, 7);
  it("monta a autorização com state, escopos e retorno", () => {
    const u = new URL(urlAutorizacao({ base: "https://sandbox.melhorenvio.com.br/", clientId: "42", redirect: "https://one.usepolia.com.br/x", state: "s1" }));
    expect(u.origin + u.pathname).toBe("https://sandbox.melhorenvio.com.br/oauth/authorize");
    expect(u.searchParams.get("state")).toBe("s1");
    expect(u.searchParams.get("scope")).toContain("shipping-calculate");
    expect(u.searchParams.get("redirect_uri")).toBe("https://one.usepolia.com.br/x");
  });
  it("token com validade de 30 dias e renovação de 45", () => {
    const t = tokensDaResposta({ access_token: "a", refresh_token: "r", expires_in: 2592000 }, agora)!;
    expect(Date.parse(t.accessExpiraEm) - agora).toBe(30 * 86400000);
    expect(Date.parse(t.refreshExpiraEm) - agora).toBe(45 * 86400000);
    expect(tokensDaResposta({ access_token: "a" }, agora)).toBeNull();
  });
  it("renova quando faltam menos de 10 dias", () => {
    expect(precisaRenovar(new Date(agora + 11 * 86400000).toISOString(), agora)).toBe(false);
    expect(precisaRenovar(new Date(agora + 9 * 86400000).toISOString(), agora)).toBe(true);
    expect(precisaRenovar(null, agora)).toBe(true);
  });
  it("nome da conta", () => {
    expect(nomeDaConta({ id: 7, firstname: "Silvia", lastname: "Oliveira" })).toEqual({ id: "7", nome: "Silvia Oliveira" });
    expect(nomeDaConta({ email: "a@b.com" }).nome).toBe("a@b.com");
    expect(nomeDaConta(null).nome).toBe("Conta do Melhor Envio");
  });
});
