// Vitrine pública da loja do catálogo (ONE-148, /loja/<endereço>). Puro: o
// carrinho que a cliente monta, as contas do resumo, os selos de confiança e
// as máscaras do checkout. Não conhece React nem localStorage; o hook
// useCarrinhoLoja (components/loja) guarda e lê, e chama daqui.
import { normalizarWhatsapp } from "@/lib/leads";
import type { LojaPublica, PedidoLoja, ProdutoLoja, ResultadoPedidoLoja } from "@/lib/loja";

/** Teto de itens e de quantidade que o pedidoLojaSchema aceita. */
export const MAX_ITENS_CARRINHO = 50;
export const MAX_QUANTIDADE_ITEM = 1000;

/** O que fica guardado no aparelho. Preço e nome nunca: saem da loja carregada. */
export interface ItemCarrinho {
  produtoId: string;
  skuId: string | null;
  variacaoNome: string | null;
  quantidade: number;
}

/** Item com o produto da loja junto, pronto pra mostrar e somar. */
export interface LinhaCarrinho extends ItemCarrinho {
  produto: ProdutoLoja;
  total: number;
}

export const chaveCarrinho = (slug: string) => `loja-carrinho-${slug}`;
export const chaveEnvio = (slug: string) => `loja-carrinho-${slug}-envio`;

const mesmoItem = (a: Pick<ItemCarrinho, "produtoId" | "skuId">, b: Pick<ItemCarrinho, "produtoId" | "skuId">) =>
  a.produtoId === b.produtoId && (a.skuId ?? null) === (b.skuId ?? null);

/**
 * Limpa o que veio do localStorage contra a loja de agora: tira produto que
 * saiu, variação que sumiu e item sem variação de produto que passou a ter
 * (a escolha é obrigatória), junta repetidos e prende a quantidade no teto.
 * O nome da variação vem sempre da loja, não do que estava guardado.
 */
export function limparCarrinho(bruto: unknown, produtos: ProdutoLoja[]): ItemCarrinho[] {
  if (!Array.isArray(bruto)) return [];
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const saida: ItemCarrinho[] = [];
  for (const cru of bruto) {
    if (!cru || typeof cru !== "object") continue;
    const i = cru as Partial<ItemCarrinho>;
    if (typeof i.produtoId !== "string") continue;
    const produto = porId.get(i.produtoId);
    if (!produto) continue;
    const skuId = typeof i.skuId === "string" ? i.skuId : null;
    let variacaoNome: string | null = null;
    if (produto.variacoes.length) {
      const v = produto.variacoes.find((x) => x.id === skuId);
      if (!v) continue;
      variacaoNome = v.nome;
    } else if (skuId) continue;
    const qtd = Math.floor(Number(i.quantidade));
    if (!Number.isFinite(qtd) || qtd < 1) continue;
    const ja = saida.find((x) => mesmoItem(x, { produtoId: produto.id, skuId }));
    if (ja) ja.quantidade = Math.min(MAX_QUANTIDADE_ITEM, ja.quantidade + qtd);
    else saida.push({ produtoId: produto.id, skuId, variacaoNome, quantidade: Math.min(MAX_QUANTIDADE_ITEM, qtd) });
    if (saida.length >= MAX_ITENS_CARRINHO) break;
  }
  return saida;
}

/** Põe um no carrinho (soma se o mesmo produto e variação já estão lá). */
export function adicionarItem(
  itens: ItemCarrinho[],
  novo: Omit<ItemCarrinho, "quantidade">,
  quantidade = 1,
): ItemCarrinho[] {
  const idx = itens.findIndex((x) => mesmoItem(x, novo));
  if (idx >= 0)
    return itens.map((x, k) =>
      k === idx ? { ...x, quantidade: Math.min(MAX_QUANTIDADE_ITEM, x.quantidade + quantidade) } : x,
    );
  if (itens.length >= MAX_ITENS_CARRINHO) return itens;
  return [...itens, { ...novo, quantidade: Math.min(MAX_QUANTIDADE_ITEM, Math.max(1, quantidade)) }];
}

/** Muda a quantidade de um item; zero ou menos tira ele. */
export function mudarQuantidade(itens: ItemCarrinho[], indice: number, quantidade: number): ItemCarrinho[] {
  if (quantidade < 1) return itens.filter((_, k) => k !== indice);
  return itens.map((x, k) => (k === indice ? { ...x, quantidade: Math.min(MAX_QUANTIDADE_ITEM, quantidade) } : x));
}

/** Itens com o produto da loja junto (quem não bate com a loja fica de fora). */
export function linhasDoCarrinho(itens: ItemCarrinho[], produtos: ProdutoLoja[]): LinhaCarrinho[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const saida: LinhaCarrinho[] = [];
  for (const i of itens) {
    const produto = porId.get(i.produtoId);
    if (produto) saida.push({ ...i, produto, total: produto.preco * i.quantidade });
  }
  return saida;
}

export interface ResumoCarrinho {
  quantidade: number;
  subtotal: number;
  sinal: number;
}

/** Soma das peças, subtotal e o sinal (frete fica a combinar, fora da conta). */
export function resumoDoCarrinho(linhas: LinhaCarrinho[], sinalPercentual: number): ResumoCarrinho {
  const subtotal = arredondar(linhas.reduce((s, l) => s + l.total, 0));
  return {
    quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
    subtotal,
    sinal: sinalPercentual > 0 ? arredondar((subtotal * sinalPercentual) / 100) : 0,
  };
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

/** Sinal de um produto só ("Comece com R$ X de sinal"); 0 quando a loja não pede sinal. */
export const sinalDoPreco = (preco: number, sinalPercentual: number) =>
  sinalPercentual > 0 ? arredondar((preco * sinalPercentual) / 100) : 0;

// ── cor da marca da cliente ──────────────────────────────────────────────────
// A vitrine é da marca da cliente, então as cores aqui são o tema neutro do
// modelo aprovado do Lab (Loveless), não tokens da Pólia. A cor de destaque é
// a que a dona escolheu; o que vira texto ou contorno é ajustado até passar
// contraste AA, pra uma cor clara (amarelo, menta) não sumir no fundo.

export const COR_DESTAQUE_PADRAO = "#C8387F";
const FUNDO_VITRINE = "#F6F3EF";
const TEXTO_VITRINE = "#141414";
const BRANCO = "#FFFFFF";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const corDaLoja = (cor: string | null | undefined) =>
  cor && HEX.test(cor) ? cor.toUpperCase() : COR_DESTAQUE_PADRAO;

const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Mistura `cor` com `alvo` (0 = só cor, 1 = só alvo), em sRGB, como o color-mix. */
function misturar(cor: string, alvo: string, peso: number): string {
  const a = canais(cor);
  const b = canais(alvo);
  return `#${a
    .map((c, i) => Math.round(c * (1 - peso) + b[i] * peso).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** Puxa a cor na direção de `alvo` até ela fechar `minimo` de contraste contra `fundo`. */
function ajustarAte(cor: string, alvo: string, fundo: string, minimo: number): string {
  for (let peso = 0; peso <= 1; peso += 0.05) {
    const c = misturar(cor, alvo, peso);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return alvo;
}

export interface CoresDaVitrine {
  destaque: string;
  /** Destaque pra texto pequeno e contorno de foco sobre o fundo claro (AA 4,5). */
  destaqueTexto: string;
  /** Texto em cima do destaque (contador da sacola). */
  destaqueSobre: string;
  /** Destaque claro sobre a faixa escura do fechamento (AA 4,5). */
  destaqueClaro: string;
}

export function coresDaVitrine(cor: string | null | undefined): CoresDaVitrine {
  const destaque = corDaLoja(cor);
  return {
    destaque,
    destaqueTexto: ajustarAte(destaque, TEXTO_VITRINE, FUNDO_VITRINE, 4.5),
    destaqueSobre: contraste(destaque, BRANCO) >= contraste(destaque, TEXTO_VITRINE) ? BRANCO : TEXTO_VITRINE,
    destaqueClaro: ajustarAte(misturar(destaque, BRANCO, 0.45), BRANCO, TEXTO_VITRINE, 4.5),
  };
}

// ── selos de confiança (vitrine e página do produto) ─────────────────────────

export type IconeSelo = "relogio" | "carteira" | "entrega" | "whatsapp";
export interface Selo {
  icone: IconeSelo;
  titulo: string;
  texto: string;
}

/** Só o que a dona configurou vira selo; nada inventado. */
export function selosDaLoja(
  loja: Pick<LojaPublica, "prazoDiasUteis" | "sinalPercentual" | "entregaTexto" | "whatsapp">,
): Selo[] {
  const selos: Selo[] = [];
  const dias = loja.prazoDiasUteis;
  selos.push({
    icone: "relogio",
    titulo: `Pronto em ${dias} ${dias === 1 ? "dia útil" : "dias úteis"}`,
    texto: "depois da confirmação",
  });
  if (loja.sinalPercentual > 0)
    selos.push({ icone: "carteira", titulo: `Sinal de ${loja.sinalPercentual}%`, texto: "pra começar o pedido" });
  if (loja.entregaTexto?.trim()) selos.push({ icone: "entrega", titulo: "Entrega", texto: loja.entregaTexto.trim() });
  if (loja.whatsapp) selos.push({ icone: "whatsapp", titulo: "Pedido direto pelo WhatsApp", texto: "a loja confirma com você" });
  return selos;
}

// ── checkout ─────────────────────────────────────────────────────────────────

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** "(11) 98888-0000" enquanto a cliente digita. Aceita colar com +55. */
export function mascararWhatsapp(v: string): string {
  const d = soDigitos(v).replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (!d.length) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "01310-100" enquanto digita. */
export function mascararCep(v: string): string {
  return soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export interface DadosCheckout {
  nome: string;
  whatsapp: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  presente: boolean;
  presentePara: string;
  observacao: string;
}

export const DADOS_VAZIOS: DadosCheckout = {
  nome: "",
  whatsapp: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  presente: false,
  presentePara: "",
  observacao: "",
};

export type CampoCheckout = keyof DadosCheckout;

/** Erros por campo, na ordem da tela (o primeiro recebe o foco). */
export function validarCheckout(d: DadosCheckout, pedeEndereco: boolean): Partial<Record<CampoCheckout, string>> {
  const e: Partial<Record<CampoCheckout, string>> = {};
  if (!d.nome.trim()) e.nome = "Escreva seu nome.";
  if (!normalizarWhatsapp(d.whatsapp)) e.whatsapp = "Confira o número, com DDD.";
  if (pedeEndereco) {
    if (soDigitos(d.cep).length !== 8) e.cep = "O CEP tem 8 números.";
    if (!d.rua.trim()) e.rua = "Escreva a rua.";
    if (!d.numero.trim()) e.numero = "Escreva o número (ou s/n).";
    if (!d.cidade.trim()) e.cidade = "Escreva a cidade.";
    if (!/^[A-Za-z]{2}$/.test(d.uf.trim())) e.uf = "Use a sigla, como SP.";
  }
  if (d.presente && !d.presentePara.trim()) e.presentePara = "Escreva o nome de quem vai receber.";
  return e;
}

/** Endereço numa linha só, no teto de 300 do pedido. Vazio quando a loja não pede. */
export function enderecoEmLinha(d: DadosCheckout, pedeEndereco: boolean): string | undefined {
  if (!pedeEndereco) return undefined;
  const rua = [d.rua.trim(), d.numero.trim(), d.complemento.trim()].filter(Boolean).join(", ");
  const cidade = [d.cidade.trim(), d.uf.trim().toUpperCase()].filter(Boolean).join("/");
  const cep = soDigitos(d.cep).length === 8 ? `CEP ${mascararCep(d.cep)}` : "";
  const linha = [rua, d.bairro.trim(), cidade, cep].filter(Boolean).join(" - ");
  return linha ? linha.slice(0, 300) : undefined;
}

/** Corpo do pedido sem o id, o token e o campo-isca (esses entram na hora de enviar). */
export function montarPedido(
  slug: string,
  itens: ItemCarrinho[],
  d: DadosCheckout,
  pedeEndereco: boolean,
): Omit<PedidoLoja, "id" | "turnstileToken" | "hp"> {
  const presentePara = d.presente && d.presentePara.trim() ? d.presentePara.trim().slice(0, 120) : undefined;
  const observacao = d.observacao.trim() ? d.observacao.trim().slice(0, 400) : undefined;
  return {
    slug,
    itens: itens.map((i) => ({ produtoId: i.produtoId, skuId: i.skuId, quantidade: i.quantidade })),
    cliente: { nome: d.nome.trim().slice(0, 120), whatsapp: mascararWhatsapp(d.whatsapp) },
    endereco: enderecoEmLinha(d, pedeEndereco),
    presentePara,
    observacao,
  };
}

/**
 * Assinatura do pedido: muda quando muda o carrinho ou algum dado. Enquanto
 * ela for a mesma, o id do pedido também é, e o segundo toque em "Confirmar"
 * cai como repetido no banco em vez de virar outro pedido. Hash curto (não
 * criptográfico) pra não guardar o dado da cliente em texto no aparelho.
 */
export function assinaturaDoPedido(corpo: unknown): string {
  const s = JSON.stringify(corpo);
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = (Math.imul(h2, 33) + c) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}${s.length.toString(36)}`;
}

/** Id do pedido: o mesmo enquanto a assinatura não muda, um novo quando muda. */
export function idDoPedido(
  anterior: { assinatura: string; id: string } | null,
  assinatura: string,
  novoId: () => string,
): { assinatura: string; id: string } {
  if (anterior && anterior.assinatura === assinatura && /^[A-Za-z0-9-]{8,64}$/.test(anterior.id)) return anterior;
  return { assinatura, id: novoId() };
}

export function gerarIdPedido(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Itens no formato que mensagemDoPedido espera. */
export function itensDaMensagem(linhas: LinhaCarrinho[]) {
  return linhas.map((l) => ({
    nome: l.produto.nome,
    variacao: l.variacaoNome,
    quantidade: l.quantidade,
    preco: l.produto.preco,
  }));
}

/** O motivo que o servidor devolve, no português que a cliente lê (mesmo tom do /l/$slug). */
export function mensagemDoErroPedido(motivo: Extract<ResultadoPedidoLoja, { ok: false }>["motivo"] | "rede"): string {
  switch (motivo) {
    case "turnstile":
      return "A verificação anti-robô não passou. Marque de novo a caixa acima e tente.";
    case "whatsapp":
      return "Confira o número do WhatsApp, com DDD.";
    case "indisponivel":
      return "A loja deixou de receber pedidos agora há pouco. Fale com a marca pelo perfil onde você achou o link.";
    case "invalido":
      return "Algum item do carrinho mudou ou saiu da loja. Atualize a página e confira o carrinho.";
    case "limite":
      return "A loja recebeu muitos pedidos deste aparelho hoje. Tente de novo amanhã.";
    default:
      return "Não deu pra enviar o pedido agora. Tente de novo em instantes.";
  }
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

/** Link do WhatsApp da loja com a mensagem pronta. Null quando a loja não tem número. */
export function linkWhatsapp(whatsapp: string | null, texto: string): string | null {
  const numero = whatsapp ? soDigitos(whatsapp) : "";
  if (numero.length < 10) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
