// Regras do módulo Vendas (VND-03, Fase 1). Puro: não conhece Supabase nem
// React. A gravação é das RPCs registrar_venda / receber_venda / cancelar_venda
// (migration 20261023120000); aqui mora o que a tela mostra antes e depois:
// total, quanto a venda lucra, ranking de mais vendidos e estoque baixo.
//
// Mesma convenção do card do produto: custo é produtos.preco_custo e item sem
// custo deixa o lucro desconhecido (null), nunca zero. Frete cobrado é repasse
// e não entra no lucro.

export const CANAIS_VENDA = [
  "instagram",
  "whatsapp",
  "presencial",
  "encomenda",
  "site",
  "shopee",
  "tiktok_shop",
  "outro",
] as const;
export type CanalVenda = (typeof CANAIS_VENDA)[number];

export const CANAL_LABEL: Record<CanalVenda, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  presencial: "Presencial ou feira",
  encomenda: "Encomenda",
  site: "Site",
  shopee: "Shopee",
  tiktok_shop: "TikTok Shop",
  outro: "Outro",
};

/** Canais que a usuária escolhe ao registrar à mão; Shopee e TikTok entram pela integração. */
export const CANAIS_MANUAIS: CanalVenda[] = [
  "instagram",
  "whatsapp",
  "presencial",
  "encomenda",
  "site",
  "outro",
];

export type StatusVenda = "recebida" | "a_receber" | "cancelada";

export interface ItemVenda {
  produtoId: string | null;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  /** null = produto sem custo cadastrado. */
  custoUnitario: number | null;
}

export interface Venda {
  status: StatusVenda;
  desconto: number;
  taxaCanal: number;
  itens: ItemVenda[];
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function subtotalDaVenda(itens: readonly Pick<ItemVenda, "quantidade" | "precoUnitario">[]) {
  // Preço arredondado por item antes de multiplicar, igual à RPC registrar_venda.
  return centavos(itens.reduce((s, i) => s + i.quantidade * centavos(i.precoUnitario), 0));
}

/** O que a cliente pagou: itens - desconto + frete. */
export function totalDaVenda(params: {
  itens: readonly Pick<ItemVenda, "quantidade" | "precoUnitario">[];
  desconto: number;
  frete: number;
}) {
  return centavos(
    subtotalDaVenda(params.itens) - centavos(params.desconto) + centavos(params.frete),
  );
}

/** O que entra na conta e vira lançamento no Financeiro: total - taxa do canal. */
export function valorRecebidoDaVenda(params: {
  itens: readonly Pick<ItemVenda, "quantidade" | "precoUnitario">[];
  desconto: number;
  frete: number;
  taxaCanal: number;
}) {
  return centavos(totalDaVenda(params) - centavos(params.taxaCanal));
}

/**
 * Quanto a venda deixou: itens - desconto - taxa - custo. Frete fica de fora
 * (é repasse). null quando algum item não tem custo: a tela pede o custo em
 * vez de mostrar um lucro inventado.
 */
export function lucroDaVenda(
  venda: Pick<Venda, "desconto" | "taxaCanal" | "itens">,
): number | null {
  if (venda.itens.some((i) => i.custoUnitario == null)) return null;
  const custo = venda.itens.reduce((s, i) => s + i.quantidade * (i.custoUnitario ?? 0), 0);
  return centavos(subtotalDaVenda(venda.itens) - venda.desconto - venda.taxaCanal - custo);
}

export type ErroVenda =
  | "sem_itens"
  | "quantidade_invalida"
  | "preco_invalido"
  | "valor_negativo"
  | "desconto_maior_que_venda";

/** Mesmas travas da RPC, pra tela avisar antes de mandar. */
export function validarVenda(params: {
  itens: readonly Pick<ItemVenda, "quantidade" | "precoUnitario">[];
  desconto: number;
  frete: number;
  taxaCanal: number;
}): ErroVenda | null {
  if (params.itens.length === 0) return "sem_itens";
  for (const i of params.itens) {
    if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) return "quantidade_invalida";
    if (!Number.isFinite(i.precoUnitario) || i.precoUnitario < 0) return "preco_invalido";
  }
  if (params.desconto < 0 || params.frete < 0 || params.taxaCanal < 0) return "valor_negativo";
  if (params.desconto > subtotalDaVenda(params.itens)) return "desconto_maior_que_venda";
  return null;
}

export interface LinhaRanking {
  chave: string;
  produtoNome: string;
  unidades: number;
  entrou: number;
  /** null se alguma venda do produto não tinha custo. */
  lucrou: number | null;
}

export type OrdemRanking = "unidades" | "entrou" | "lucrou";

/**
 * Mais vendidos. Desconto e taxa da venda são rateados entre os itens pelo
 * valor de cada um, senão o produto que divide pedido com outro levaria a
 * taxa inteira. Venda cancelada não conta; a receber conta (saiu da prateleira).
 */
export function maisVendidos(
  vendas: readonly Venda[],
  ordem: OrdemRanking = "unidades",
): LinhaRanking[] {
  const porProduto = new Map<string, LinhaRanking>();

  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    const subtotal = subtotalDaVenda(v.itens);
    for (const i of v.itens) {
      const valorItem = i.quantidade * i.precoUnitario;
      const peso = subtotal > 0 ? valorItem / subtotal : 1 / v.itens.length;
      const entrou = valorItem - v.desconto * peso;
      const lucro =
        i.custoUnitario == null
          ? null
          : entrou - v.taxaCanal * peso - i.quantidade * i.custoUnitario;

      const chave = i.produtoId ?? `nome:${i.produtoNome}`;
      const atual = porProduto.get(chave) ?? {
        chave,
        produtoNome: i.produtoNome,
        unidades: 0,
        entrou: 0,
        lucrou: 0,
      };
      atual.unidades += i.quantidade;
      atual.entrou += entrou;
      atual.lucrou = atual.lucrou == null || lucro == null ? null : atual.lucrou + lucro;
      porProduto.set(chave, atual);
    }
  }

  const linhas = [...porProduto.values()].map((l) => ({
    ...l,
    entrou: centavos(l.entrou),
    lucrou: l.lucrou == null ? null : centavos(l.lucrou),
  }));
  // Lucro desconhecido vai pro fim quando ordena por lucro.
  const valor = (l: LinhaRanking) => (ordem === "lucrou" ? (l.lucrou ?? -Infinity) : l[ordem]);
  return linhas.sort((a, b) => valor(b) - valor(a) || b.unidades - a.unidades);
}

/**
 * A frase do ranking: só existe quando quem mais sai não é quem mais lucra.
 * Devolve os dois nomes e a diferença de unidades; a copy fica na tela.
 */
export function campeaoDivergente(
  linhas: readonly LinhaRanking[],
): { maisSai: LinhaRanking; maisLucra: LinhaRanking; diferencaUnidades: number } | null {
  const comLucro = linhas.filter((l) => l.lucrou != null);
  if (linhas.length < 2 || comLucro.length === 0) return null;
  const maisSai = [...linhas].sort((a, b) => b.unidades - a.unidades)[0];
  const maisLucra = [...comLucro].sort((a, b) => (b.lucrou ?? 0) - (a.lucrou ?? 0))[0];
  if (maisSai.chave === maisLucra.chave) return null;
  return { maisSai, maisLucra, diferencaUnidades: maisSai.unidades - maisLucra.unidades };
}

export interface SaldoSku {
  skuId: string;
  saldo: number;
  estoqueMinimo: number;
}

/** Baixo = no mínimo ou abaixo. Mínimo 0 só avisa quando acaba (saldo <= 0). */
export function estoqueBaixo(saldo: Pick<SaldoSku, "saldo" | "estoqueMinimo">): boolean {
  return saldo.saldo <= saldo.estoqueMinimo;
}

export function contarEstoqueBaixo(saldos: readonly SaldoSku[]): number {
  return saldos.filter(estoqueBaixo).length;
}

export interface ResumoVendas {
  /** Vendas que valem (sem as canceladas). */
  quantidade: number;
  /** O que já entrou na conta: total - taxa das recebidas (bate com o Financeiro). */
  entrou: number;
  /** Lucro das vendas com custo conhecido. */
  lucrou: number;
  /** Quantas vendas ficaram de fora do lucro por falta de custo. */
  semCusto: number;
  /** O que ainda vai entrar: total - taxa das vendas a receber. */
  aReceber: number;
}

/** Os números do topo da tela Vendas e do card do Painel. */
export function resumoVendas(vendas: readonly (Venda & { total: number })[]): ResumoVendas {
  const r: ResumoVendas = { quantidade: 0, entrou: 0, lucrou: 0, semCusto: 0, aReceber: 0 };
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    r.quantidade += 1;
    const liquido = v.total - v.taxaCanal;
    if (v.status === "a_receber") r.aReceber += liquido;
    else r.entrou += liquido;
    const lucro = lucroDaVenda(v);
    if (lucro == null) r.semCusto += 1;
    else r.lucrou += lucro;
  }
  return {
    ...r,
    entrou: centavos(r.entrou),
    lucrou: centavos(r.lucrou),
    aReceber: centavos(r.aReceber),
  };
}

export type PeriodoVendas = "mes" | "passado" | "90dias";

/** Datas "AAAA-MM-DD" inclusivas do período, contadas a partir de `hoje` (local). */
export function intervaloDoPeriodo(
  periodo: PeriodoVendas,
  hoje: Date,
): { de: string; ate: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  if (periodo === "mes") return { de: iso(new Date(ano, mes, 1)), ate: iso(hoje) };
  if (periodo === "passado") {
    return { de: iso(new Date(ano, mes - 1, 1)), ate: iso(new Date(ano, mes, 0)) };
  }
  return { de: iso(new Date(ano, mes, hoje.getDate() - 89)), ate: iso(hoje) };
}

/**
 * "Contei e corrigi": a usuária digita quanto TEM na prateleira, o livro
 * guarda a diferença. 0 = nada a lançar.
 */
export function diferencaDoAjuste(saldoAtual: number, contado: number): number {
  return contado - saldoAtual;
}
