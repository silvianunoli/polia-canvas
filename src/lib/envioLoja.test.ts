import { createHmac } from "node:crypto";
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
  assinaturaMeConfere,
  corpoCotacao,
  corpoEtiqueta,
  efeitoDoAviso,
  emailPedidoEnviado,
  lerAvisoMe,
  mensagemDoMe,
  nomeDaConta,
  opcoesDaCotacao,
  precisaRenovar,
  tokensDaResposta,
  urlAutorizacao,
} from "../../supabase/functions/_shared/melhorEnvio.ts";

describe("aviso de rastreio do Melhor Envio", () => {
  const corpo = '{"event":"order.posted","data":{"id":"abc"}}';
  const assinar = (codificacao: "base64" | "hex", texto = corpo, chave = "segredo") =>
    createHmac("sha256", chave).update(texto).digest(codificacao);

  it("confere a assinatura em base64 e em hex", async () => {
    expect(await assinaturaMeConfere(corpo, "segredo", assinar("base64"))).toBe(true);
    expect(await assinaturaMeConfere(corpo, "segredo", assinar("hex"))).toBe(true);
  });
  it("barra corpo mexido, chave errada e assinatura vazia", async () => {
    expect(await assinaturaMeConfere(`${corpo} `, "segredo", assinar("base64"))).toBe(false);
    expect(await assinaturaMeConfere(corpo, "outra", assinar("base64"))).toBe(false);
    expect(await assinaturaMeConfere(corpo, "segredo", "")).toBe(false);
    expect(await assinaturaMeConfere(corpo, "", assinar("base64", corpo, ""))).toBe(false);
  });
  it("lê o aviso e limpa a URL com espaço do exemplo da doc", () => {
    expect(lerAvisoMe({ event: "order.posted", data: { id: "a", tracking: " ME1 ", tracking_url: "https: //www.melhorrastreio.com.br/rastreio/ME1" } })).toEqual({
      evento: "order.posted",
      etiquetaId: "a",
      codigo: "ME1",
      url: "https://www.melhorrastreio.com.br/rastreio/ME1",
    });
  });
  it("recusa URL que não é https e corpo torto", () => {
    expect(lerAvisoMe({ event: "order.posted", data: { id: "a", tracking: null, tracking_url: "javascript:alert(1)" } })?.url).toBeNull();
    expect(lerAvisoMe({ event: "order.posted" })).toBeNull();
    expect(lerAvisoMe(null)).toBeNull();
  });
  it("traduz os eventos", () => {
    expect(efeitoDoAviso("order.posted")).toBe("postada");
    expect(efeitoDoAviso("order.delivered")).toBe("entregue");
    expect(efeitoDoAviso("order.paused")).toBe("problema");
    expect(efeitoDoAviso("order.cancelled")).toBe("cancelada");
    expect(efeitoDoAviso("order.generated")).toBeNull();
  });
  it("e-mail com rastreio tem o link e escapa o nome", () => {
    const { assunto, html } = emailPedidoEnviado({ marca: "Mundo de Aimer", nome: "<Ana>", servico: "PAC", codigo: "ME1", url: "https://x.com/ME1" });
    expect(assunto).toContain("Mundo de Aimer");
    expect(html).toContain("&lt;Ana&gt;");
    expect(html).toContain('href="https://x.com/ME1"');
    expect(html).not.toContain("Pólia");
  });
  it("sem link avisa que o rastreio demora", () => {
    expect(emailPedidoEnviado({ marca: "M", nome: "A", servico: null, codigo: null, url: null }).html).toContain("1 dia útil");
  });
});

describe("etiqueta do Melhor Envio", () => {
  const remetente = {
    nome: "Marca Ltda", documento: "18305925000106", telefone: "11977435996", email: "a@b.com", cep: "04364030",
    rua: "Rua A", numero: "1", complemento: "", bairro: "B", cidade: "São Paulo", uf: "SP",
  };
  const dados = {
    vendaId: "v1",
    remetente,
    nome: "Ana",
    email: "ana@x.com",
    whatsapp: "5511999990000",
    cpf: "52998224725",
    endereco: { cep: "30130010", rua: "Praça", numero: "7", complemento: "", bairro: "Centro", cidade: "BH", uf: "MG" },
    servico: { id: 3, empresa: "Jadlog", pacotes: [{ dimensoes: { height: "12.5", width: 20, length: 20 }, peso: "2.00" }] },
    itens: [{ produto_nome: "Caneca", variacao: "Azul", quantidade: 2, preco: "39.9" }],
  };
  const corpo = (d = dados) => {
    const r = corpoEtiqueta(d);
    if ("erro" in r) throw new Error(r.erro);
    return r.corpo as Record<string, any>;
  };

  it("CNPJ vai em company_document, e a declaração de conteúdo não leva nota", () => {
    const c = corpo();
    expect(c.from).toMatchObject({ company_document: "18305925000106", document: "", state_register: "" });
    expect(c.options).toMatchObject({ non_commercial: true, insurance_value: 79.8 });
    expect(c.options.invoice).toBeUndefined();
  });
  it("CPF do remetente vai em document", () => {
    const c = corpo({ ...dados, remetente: { ...remetente, documento: "52998224725" } });
    expect(c.from).toMatchObject({ document: "52998224725", company_document: "" });
  });
  it("destinatário sem o 55 e volume em centímetro inteiro", () => {
    const c = corpo();
    expect(c.to).toMatchObject({ phone: "11999990000", document: "52998224725", postal_code: "30130010" });
    expect(c.volumes).toEqual([{ height: 13, width: 20, length: 20, weight: 2 }]);
    expect(c.products[0]).toEqual({ name: "Caneca Azul", quantity: "2", unitary_value: "39.90" });
  });
  it("recusa sem pacote, pacote torto e duas caixas nos Correios", () => {
    expect(corpoEtiqueta({ ...dados, servico: { id: 1, pacotes: [] } })).toEqual({ erro: "sem_pacote" });
    expect(corpoEtiqueta({ ...dados, servico: { id: 1, pacotes: [{ dimensoes: {}, peso: "1" }] } })).toEqual({ erro: "dados" });
    const duas = [dados.servico.pacotes[0], dados.servico.pacotes[0]];
    expect(corpoEtiqueta({ ...dados, servico: { id: 1, empresa: "Correios", pacotes: duas } })).toEqual({ erro: "varias_caixas" });
    expect("corpo" in corpoEtiqueta({ ...dados, servico: { id: 3, empresa: "Jadlog", pacotes: duas } })).toBe(true);
  });
  it("acha a primeira frase de erro do Melhor Envio", () => {
    expect(mensagemDoMe({ error: { volumes: [["Peso do pacote 1 não informado"]] } })).toBe("Peso do pacote 1 não informado");
    expect(mensagemDoMe({ message: "x", errors: { orders: ["Já foram pagas."] } })).toBe("Já foram pagas.");
    expect(mensagemDoMe(null)).toBeNull();
  });
});

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
