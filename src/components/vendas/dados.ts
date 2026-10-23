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
  skus: SkuProduto[];
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

type VendaBanco = {
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
          "id, canal, data, status, cliente_id, cliente_nome, subtotal, desconto, frete, taxa_canal, total, observacao, venda_itens(produto_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)",
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
      const [produtos, saldos] = await Promise.all([
        supabase
          .from("produtos")
          .select("id, nome, tipo, preco_venda, preco_custo, controla_estoque")
          .eq("user_id", userId!)
          .eq("arquivado", false)
          .order("nome", { ascending: true }),
        supabase
          .from("estoque_saldos")
          .select("sku_id, produto_id, variacao, sku, estoque_minimo, saldo")
          .eq("user_id", userId!),
      ]);
      if (produtos.error) throw produtos.error;
      if (saldos.error) throw saldos.error;

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
        // Padrão (sem nome) primeiro, depois as variações em ordem alfabética.
        skus: (porProduto.get(p.id) ?? []).sort((a, b) =>
          (a.variacao ?? "").localeCompare(b.variacao ?? "", "pt-BR"),
        ),
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
}

export async function registrarVenda(v: NovaVenda) {
  return supabase.rpc("registrar_venda", {
    p_id: v.id,
    p_data: v.data,
    p_canal: v.canal,
    p_itens: v.itens.map((i) => ({
      produto_id: i.produtoId,
      sku_id: i.skuId,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    })) as unknown as Json,
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
