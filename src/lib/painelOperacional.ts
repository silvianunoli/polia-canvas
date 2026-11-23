// Bloco "Produtos e vendas · mês" do Painel (23/11/2026, pedido da Sil: "algo
// operacional no painel"). Substitui o cartão "Vendas · mês" e junta, num lugar
// só, quantos produtos estão ativos e arquivados, quantos acabaram, o ticket
// médio e os mais e menos vendidos do mês.
//
// Aqui mora só a regra. A leitura fica em components/painel/CartaoProdutosVendasPainel.

import { estoqueBaixo, maisVendidos, type LinhaRanking, type Venda } from "@/lib/vendas";

export interface ProdutoDoResumo {
  id: string;
  nome: string;
  controlaEstoque: boolean;
  /** created_at do produto: no empate de "menos vendidos", o mais antigo vem antes. */
  criadoEm: string;
  skus: readonly { saldo: number; estoqueMinimo: number }[];
}

export interface ResumoProdutos {
  ativos: number;
  inativos: number;
  /** Ativos com estoque ligado e nada na prateleira. */
  semEstoque: number;
  /** Ativos com estoque ligado, com saldo, mas alguma variação no mínimo ou abaixo. */
  estoqueBaixo: number;
}

/**
 * Saldo negativo de uma variação não abate o positivo de outra (mesma régua de
 * produtosParados). Produto sem estoque ligado, como o feito por encomenda,
 * nunca conta como "sem estoque".
 */
export function resumoProdutos(
  ativos: readonly ProdutoDoResumo[],
  inativos: number,
): ResumoProdutos {
  let semEstoque = 0;
  let baixo = 0;
  for (const p of ativos) {
    if (!p.controlaEstoque) continue;
    const saldo = p.skus.reduce((s, x) => s + Math.max(0, x.saldo), 0);
    if (saldo <= 0) semEstoque += 1;
    else if (p.skus.some(estoqueBaixo)) baixo += 1;
  }
  return { ativos: ativos.length, inativos, semEstoque, estoqueBaixo: baixo };
}

export interface TicketMedio {
  /** Vendas que valem (sem as canceladas). */
  vendas: number;
  /** Soma do que as clientes pagaram (itens - desconto + frete). */
  total: number;
  /** total / vendas; null sem venda no período. */
  ticket: number | null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Ticket médio = o que as clientes pagaram ÷ número de vendas. Cancelada não conta. */
export function ticketMedio(
  vendas: readonly (Pick<Venda, "status"> & { total: number })[],
): TicketMedio {
  let n = 0;
  let total = 0;
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    n += 1;
    total += v.total;
  }
  return { vendas: n, total: centavos(total), ticket: n > 0 ? centavos(total / n) : null };
}

export interface LinhaMenosVendido {
  id: string;
  produtoNome: string;
  /** 0 = sem venda no período. */
  unidades: number;
  entrou: number;
}

/** Quantos aparecem em cada lista do bloco. */
export const LIMITE_LISTA = 3;

/** Os mais vendidos do período, por unidades (régua de maisVendidos). */
export function topMaisVendidos(vendas: readonly Venda[], n = LIMITE_LISTA): LinhaRanking[] {
  return maisVendidos(vendas).slice(0, n);
}

/**
 * Os produtos ATIVOS que menos venderam no período, contando os que não
 * venderam nada: é o que mostra o que está parado. Quem já está na lista de
 * mais vendidos não repete. No empate, o produto mais antigo vem antes (o
 * recém-cadastrado ainda não teve tempo de vender). Sem nenhuma venda no
 * período a lista fica vazia: todos empatariam em zero e a ordem não diria
 * nada.
 */
export function menosVendidos(
  vendas: readonly Venda[],
  ativos: readonly Pick<ProdutoDoResumo, "id" | "nome" | "criadoEm">[],
  n = LIMITE_LISTA,
): LinhaMenosVendido[] {
  const ranking = maisVendidos(vendas);
  if (ranking.length === 0) return [];
  const porId = new Map(ranking.map((r) => [r.chave, r]));
  const noTopo = new Set(ranking.slice(0, n).map((r) => r.chave));
  return ativos
    .filter((p) => !noTopo.has(p.id))
    .map((p) => {
      const r = porId.get(p.id);
      return {
        id: p.id,
        produtoNome: p.nome,
        unidades: r?.unidades ?? 0,
        entrou: r?.entrou ?? 0,
        criadoEm: p.criadoEm,
      };
    })
    .sort(
      (a, b) =>
        a.unidades - b.unidades ||
        a.criadoEm.localeCompare(b.criadoEm) ||
        a.produtoNome.localeCompare(b.produtoNome, "pt-BR"),
    )
    .slice(0, n)
    .map(({ id, produtoNome, unidades, entrou }) => ({ id, produtoNome, unidades, entrou }));
}
