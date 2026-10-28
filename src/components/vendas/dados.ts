// Leitura e escrita do módulo Vendas (VND-03). As regras de conta ficam em
// lib/vendas.ts; aqui só a ponte com o Supabase e a conversão de linha do
// banco pro formato que as regras e as telas usam.
//
// Escrita de venda passa sempre pelas RPCs (registrar_venda, receber_venda,
// cancelar_venda): venda, itens, baixa no estoque e lançamento no Financeiro
// numa transação só.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CanalVenda, ItemVenda, StatusVenda, Venda } from "@/lib/vendas";
import type { ComprasDoCliente } from "@/lib/recorrencia";
import type { ComponenteKit } from "@/lib/kits";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";

export interface VendaLinha extends Venda {
  id: string;
  canal: CanalVenda;
  data: string;
  clienteId: string | null;
  clienteNome: string | null;
  subtotal: number;
  frete: number;
  total: number;
  observacao: string | null;
  itens: (ItemVenda & { variacao: string | null })[];
}

export interface SkuProduto {
  id: string;
  variacao: string | null;
  sku: string | null;
  estoqueMinimo: number;
  saldo: number;
}

export interface ProdutoVendavel {
  id: string;
  nome: string;
  tipo: string;
  precoVenda: number;
  precoCusto: number | null;
  controlaEstoque: boolean;
  /** created_at do produto (produto recém-cadastrado não é "parado"). */
  criadoEm: string;
  skus: SkuProduto[];
  /** Componentes quando o produto é kit (ONE-132); vazio nos outros. */
  componentes: ComponenteKit[];
}

export interface MovimentoEstoque {
  id: string;
  tipo: "entrada" | "venda" | "devolucao" | "ajuste" | "perda";
  quantidade: number;
  motivo: string | null;
  createdAt: string;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const nOuNull = (v: unknown) => (v == null ? null : Number(v));

type ItemBanco = {
  produto_id: string | null;
  produto_nome: string;
  variacao: string | null;
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number | null;
};

export type VendaBanco = {
  id: string;
  canal: string;
  data: string;
  status: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  subtotal: number;
  desconto: number;
  frete: number;
  taxa_canal: number;
  custo_envio?: number | null;
  total: number;
  observacao: string | null;
  venda_itens: ItemBanco[] | null;
};

export function vendaDoBanco(v: VendaBanco): VendaLinha {
  return {
    id: v.id,
    canal: v.canal as CanalVenda,
    data: v.data,
    status: v.status as StatusVenda,
    clienteId: v.cliente_id,
    clienteNome: v.cliente_nome,
    subtotal: n(v.subtotal),
    desconto: n(v.desconto),
    frete: n(v.frete),
    taxaCanal: n(v.taxa_canal),
    custoEnvio: n(v.custo_envio ?? 0),
    total: n(v.total),
    observacao: v.observacao,
    itens: (v.venda_itens ?? []).map((i) => ({
      produtoId: i.produto_id,
      produtoNome: i.produto_nome,
      variacao: i.variacao,
      quantidade: n(i.quantidade),
      precoUnitario: n(i.preco_unitario),
      custoUnitario: nOuNull(i.custo_unitario),
    })),
  };
}

export const chaveVendas = (userId: string | undefined) => ["vendas", userId] as const;
export const chaveEstoque = (userId: string | undefined) => ["estoque", userId] as const;

/** Vendas de um período (datas "AAAA-MM-DD", inclusivas), mais recente primeiro. */
export function useVendas(userId: string | undefined, de: string, ate: string) {
  return useQuery({
    queryKey: [...chaveVendas(userId), de, ate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          "id, canal, data, status, cliente_id, cliente_nome, subtotal, desconto, frete, taxa_canal, custo_envio, total, observacao, venda_itens(produto_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)",
        )
        .eq("user_id", userId!)
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      // Leitura que falha não pode virar "nenhuma venda": a tela mostra o erro.
      if (error) throw error;
      return ((data ?? []) as unknown as VendaBanco[]).map(vendaDoBanco);
    },
  });
}

/**
 * Catálogo pronto pra vender: produto ativo com as variações e o saldo de cada
 * uma. Serve ao modal de venda e à aba Estoque.
 */
export function useProdutosComEstoque(userId: string | undefined) {
  return useQuery({
    queryKey: chaveEstoque(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ProdutoVendavel[]> => {
      const [produtos, saldos, componentes] = await Promise.all([
        supabase
          .from("produtos")
          .select("id, nome, tipo, preco_venda, preco_custo, controla_estoque, created_at")
          .eq("user_id", userId!)
          .eq("arquivado", false)
          .order("nome", { ascending: true }),
        supabase
          .from("estoque_saldos")
          .select("sku_id, produto_id, variacao, sku, estoque_minimo, saldo")
          .eq("user_id", userId!),
        supabase
          .from("produto_componentes")
          .select("kit_id, componente_id, sku_id, quantidade")
          .eq("user_id", userId!),
      ]);
      if (produtos.error) throw produtos.error;
      if (saldos.error) throw saldos.error;
      if (componentes.error) throw componentes.error;

      const porKit = new Map<string, ComponenteKit[]>();
      for (const c of componentes.data ?? []) {
        const lista = porKit.get(c.kit_id) ?? [];
        lista.push({ componenteId: c.componente_id, skuId: c.sku_id, quantidade: c.quantidade });
        porKit.set(c.kit_id, lista);
      }

      const porProduto = new Map<string, SkuProduto[]>();
      for (const s of saldos.data ?? []) {
        if (!s.produto_id || !s.sku_id) continue;
        const lista = porProduto.get(s.produto_id) ?? [];
        lista.push({
          id: s.sku_id,
          variacao: s.variacao,
          sku: s.sku,
          estoqueMinimo: n(s.estoque_minimo),
          saldo: n(s.saldo),
        });
        porProduto.set(s.produto_id, lista);
      }

      return (produtos.data ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        precoVenda: n(p.preco_venda),
        precoCusto: nOuNull(p.preco_custo),
        controlaEstoque: !!p.controla_estoque,
        criadoEm: p.created_at,
        // Padrão (sem nome) primeiro, depois as variações em ordem alfabética.
        skus: (porProduto.get(p.id) ?? []).sort((a, b) =>
          (a.variacao ?? "").localeCompare(b.variacao ?? "", "pt-BR"),
        ),
        componentes: porKit.get(p.id) ?? [],
      }));
    },
  });
}

/**
 * Data da última venda de cada produto (ONE-130), uma linha por produto.
 * Agregado no banco: ler as vendas inteiras pra achar o max(data) batia no
 * teto de 1.000 linhas do PostgREST.
 */
export function useUltimaVendaPorProduto(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveVendas(userId), "ultima-por-produto"],
    enabled: !!userId,
    queryFn: async () => {
      // Uma linha por produto, mas o teto de 1.000 por chamada vale aqui também.
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase.rpc("ultima_venda_por_produto").order("produto_id").range(de, ate),
      );
      return new Map(linhas.map((r) => [r.produto_id, r.ultima_venda] as const));
    },
  });
}

/**
 * Resumo de compras por cliente com ficha (ONE-131): nome, primeira e última
 * compra, quantas e quanto. Agregado no banco (compras_por_cliente) e lido
 * página por página: o PostgREST corta em 1.000 linhas sem avisar.
 */
export function useComprasPorCliente(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveVendas(userId), "compras-por-cliente"],
    enabled: !!userId,
    queryFn: async (): Promise<ComprasDoCliente[]> => {
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase.rpc("compras_por_cliente").order("cliente_id").range(de, ate),
      );
      return linhas.map((r) => ({
        clienteId: r.cliente_id,
        nome: r.nome,
        primeiraCompra: r.primeira_compra,
        ultimaCompra: r.ultima_compra,
        compras: Number(r.compras),
        total: Number(r.total),
      }));
    },
  });
}

export function useMovimentos(skuId: string | null) {
  return useQuery({
    queryKey: ["estoque-movimentos", skuId],
    enabled: !!skuId,
    queryFn: async (): Promise<MovimentoEstoque[]> => {
      const { data, error } = await supabase
        .from("estoque_movimentos")
        .select("id, tipo, quantidade, motivo, created_at")
        .eq("sku_id", skuId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id,
        tipo: m.tipo as MovimentoEstoque["tipo"],
        quantidade: n(m.quantidade),
        motivo: m.motivo,
        createdAt: m.created_at,
      }));
    },
  });
}

export interface NovaVenda {
  /** Gerado quando o modal abre: repetir o envio devolve a mesma venda, sem duplicar. */
  id: string;
  data: string;
  canal: CanalVenda;
  clienteId: string | null;
  clienteNome: string | null;
  itens: { produtoId: string; skuId: string | null; quantidade: number; precoUnitario: number }[];
  desconto: number;
  frete: number;
  taxaCanal: number;
  recebida: boolean;
  observacao: string | null;
  /** Veio do "Registrar venda" de Clientes: marca a cliente na mesma transação. */
  marcarCliente?: boolean;
  /**
   * Veio do "Virar venda" de um orçamento (ONE-129): converter_orcamento grava
   * a venda e marca o orçamento como convertido na mesma transação.
   */
  orcamentoId?: string;
}

export async function registrarVenda(v: NovaVenda) {
  const itens = v.itens.map((i) => ({
    produto_id: i.produtoId,
    sku_id: i.skuId,
    quantidade: i.quantidade,
    preco_unitario: i.precoUnitario,
  })) as unknown as Json;
  if (v.orcamentoId) {
    return supabase.rpc("converter_orcamento", {
      p_orcamento_id: v.orcamentoId,
      p_venda_id: v.id,
      p_data: v.data,
      p_canal: v.canal,
      p_itens: itens,
      p_cliente_id: v.clienteId,
      p_cliente_nome: v.clienteNome,
      p_desconto: v.desconto,
      p_frete: v.frete,
      p_taxa_canal: v.taxaCanal,
      p_recebida: v.recebida,
      p_observacao: v.observacao,
    });
  }
  return supabase.rpc("registrar_venda", {
    p_id: v.id,
    p_data: v.data,
    p_canal: v.canal,
    p_itens: itens,
    p_cliente_id: v.clienteId,
    p_cliente_nome: v.clienteNome,
    p_desconto: v.desconto,
    p_frete: v.frete,
    p_taxa_canal: v.taxaCanal,
    p_recebida: v.recebida,
    p_observacao: v.observacao,
    p_marcar_cliente: v.marcarCliente ?? false,
  });
}

/** Grava a lista inteira de componentes do kit (vazia desfaz o kit). */
export async function salvarKit(kitId: string, componentes: readonly ComponenteKit[]) {
  return supabase.rpc("salvar_kit", {
    p_kit_id: kitId,
    p_componentes: componentes.map((c) => ({
      componente_id: c.componenteId,
      sku_id: c.skuId,
      quantidade: c.quantidade,
    })) as unknown as Json,
  });
}

export async function receberVenda(vendaId: string, data: string) {
  return supabase.rpc("receber_venda", { p_venda_id: vendaId, p_data: data });
}

export async function cancelarVenda(vendaId: string) {
  return supabase.rpc("cancelar_venda", { p_venda_id: vendaId });
}

export type TipoMovimentoManual = "entrada" | "perda" | "ajuste";

/**
 * Entrada, perda ou contagem feita à mão. quantidade é sempre positiva: na
 * contagem é quanto TEM na prateleira, e o banco calcula a diferença com a
 * variação travada (uma venda no meio não erra o saldo). Devolve o saldo novo.
 */
export async function movimentarEstoque(params: {
  skuId: string;
  tipo: TipoMovimentoManual;
  quantidade: number;
  motivo: string | null;
}) {
  return supabase.rpc("movimentar_estoque", {
    p_sku_id: params.skuId,
    p_tipo: params.tipo,
    p_quantidade: params.quantidade,
    p_motivo: params.motivo,
  });
}

export interface VariacaoParaSalvar {
  id: string | null;
  variacao: string | null;
  sku: string | null;
  minimo: number;
  inicial: number;
}

/** Liga/desliga o estoque e grava as variações numa transação só. */
export async function salvarEstoqueDoProduto(
  produtoId: string,
  controla: boolean,
  variacoes: VariacaoParaSalvar[],
) {
  return supabase.rpc("salvar_estoque_produto", {
    p_produto_id: produtoId,
    p_controla: controla,
    p_variacoes: variacoes as unknown as Json,
  });
}
