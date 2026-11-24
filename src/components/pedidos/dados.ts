// Leitura e escrita do quadro de Pedidos (GRW-93). Pedido é venda com andamento e
// dia de entrega: a escrita passa pelas RPCs registrar_pedido e
// atualizar_pedido (migration 20261028140443_pedidos_quadro.sql), e receber ou
// cancelar usam as mesmas RPCs de Vendas. Regras em lib/pedidos.ts.

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { somarDias } from "@/lib/data.functions";
import { DIAS_ENTREGUE_NO_QUADRO, ehAndamento, type AndamentoPedido } from "@/lib/pedidos";
import {
  chaveEstoque,
  chaveVendas,
  vendaDoBanco,
  type VendaBanco,
  type VendaLinha,
} from "@/components/vendas/dados";

export interface PedidoLinha extends VendaLinha {
  andamento: AndamentoPedido;
  entregaEm: string;
  /** Quando virou entregue (gatilho no banco); null fora de Entregue. */
  entregueEm: string | null;
  /** Forma de pagamento gravada; null = a definir (marketplace mostra o nome dele). */
  forma?: string | null;
  /** Cupom da Vitrine online que a cliente usou (ONE-239); null sem cupom. */
  cupomCodigo?: string | null;
}

export const chavePedidos = (userId: string | undefined) => ["pedidos", userId] as const;

const SELECT =
  "id, canal, data, status, cliente_id, cliente_nome, subtotal, desconto, frete, taxa_canal, custo_envio, total, observacao, forma, cupom_codigo, andamento, entrega_em, entregue_em, venda_itens(produto_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)";

/**
 * Pedidos do quadro: abertos de qualquer data e entregues com entrega
 * combinada ou finalizados nos últimos 7 dias. Cancelado não vem.
 */
export function usePedidos(userId: string | undefined, hoje: string) {
  return useQuery({
    queryKey: [...chavePedidos(userId), hoje],
    enabled: !!userId,
    queryFn: async (): Promise<PedidoLinha[]> => {
      const desde = somarDias(hoje, -DIAS_ENTREGUE_NO_QUADRO);
      const { data, error } = await supabase
        .from("vendas")
        .select(SELECT)
        .eq("user_id", userId!)
        .not("andamento", "is", null)
        .neq("status", "cancelada")
        .or(`andamento.neq.entregue,entrega_em.gte.${desde},entregue_em.gte.${desde}`)
        .order("entrega_em", { ascending: true })
        .limit(500);
      // Leitura que falha não pode virar "nenhum pedido": a tela mostra o erro.
      if (error) throw error;
      return paraPedidos(data);
    },
  });
}

/**
 * Pedidos com entrega entre `de` e `ate` (AAAA-MM-DD, inclusivas), de qualquer
 * andamento, sem os cancelados. É o que o Calendário mostra como entregas.
 */
export function usePedidosDoPeriodo(
  userId: string | undefined,
  de: string,
  ate: string,
  ativo = true,
) {
  return useQuery({
    queryKey: [...chavePedidos(userId), "periodo", de, ate],
    enabled: !!userId && ativo,
    queryFn: async (): Promise<PedidoLinha[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select(SELECT)
        .eq("user_id", userId!)
        .not("andamento", "is", null)
        .neq("status", "cancelada")
        .gte("entrega_em", de)
        .lte("entrega_em", ate)
        .order("entrega_em", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return paraPedidos(data);
    },
  });
}

function paraPedidos(data: unknown): PedidoLinha[] {
  return (
    (data ?? []) as (VendaBanco & {
      andamento: string;
      entrega_em: string;
      entregue_em?: string | null;
      forma?: string | null;
      cupom_codigo?: string | null;
    })[]
  )
    .filter((v) => ehAndamento(v.andamento) && !!v.entrega_em)
    .map((v) => ({
      ...vendaDoBanco(v),
      andamento: v.andamento as AndamentoPedido,
      entregaEm: v.entrega_em,
      entregueEm: v.entregue_em ?? null,
      forma: v.forma ?? null,
      cupomCodigo: v.cupom_codigo ?? null,
    }));
}

export interface NovoPedido {
  /** Nasce com o modal: repetir o envio devolve o mesmo pedido, sem duplicar. */
  id: string;
  entregaEm: string;
  clienteId: string | null;
  clienteNome: string | null;
  itens: { produtoId: string; skuId: string | null; quantidade: number; precoUnitario: number }[];
  recebida: boolean;
  observacao: string | null;
  /** Onde vendeu (23/11/2026). Sem ele, a RPC grava "encomenda", como antes. */
  canal?: string;
  /** Forma de pagamento; null = a definir (e sempre null em marketplace). */
  forma?: string | null;
  taxaCanal?: number;
}

export async function registrarPedido(p: NovoPedido) {
  return supabase.rpc("registrar_pedido", {
    p_id: p.id,
    p_entrega_em: p.entregaEm,
    p_itens: p.itens.map((i) => ({
      produto_id: i.produtoId,
      sku_id: i.skuId,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    })) as unknown as Json,
    p_cliente_id: p.clienteId,
    p_cliente_nome: p.clienteNome,
    p_recebida: p.recebida,
    p_observacao: p.observacao,
    ...(p.canal ? { p_canal: p.canal } : {}),
    p_forma: p.forma ?? null,
    p_taxa_canal: p.taxaCanal ?? 0,
  });
}

/** Troca forma e taxa de um pedido anotado à mão ou da Vitrine (definir_pagamento_pedido). */
export async function definirPagamentoPedido(vendaId: string, forma: string | null, taxa: number) {
  return supabase.rpc("definir_pagamento_pedido", {
    p_venda_id: vendaId,
    p_forma: forma,
    p_taxa: taxa,
  });
}

export async function moverPedido(vendaId: string, andamento: AndamentoPedido) {
  return supabase.rpc("atualizar_pedido", { p_venda_id: vendaId, p_andamento: andamento });
}

export async function remarcarPedido(vendaId: string, entregaEm: string) {
  return supabase.rpc("atualizar_pedido", { p_venda_id: vendaId, p_entrega_em: entregaEm });
}

/** O pedido mexe na venda, no estoque, no Financeiro e no Painel. */
export function recarregarDepoisDoPedido(qc: QueryClient, userId: string | undefined) {
  void qc.invalidateQueries({ queryKey: chavePedidos(userId) });
  void qc.invalidateQueries({ queryKey: chaveVendas(userId) });
  void qc.invalidateQueries({ queryKey: chaveEstoque(userId) });
  void qc.invalidateQueries({ queryKey: ["financeiro", userId] });
  void qc.invalidateQueries({ queryKey: ["painel-dados", userId] });
  // Lançar e entregar o pedido são dois dos Primeiros passos (31/10/2026).
  void qc.invalidateQueries({ queryKey: ["primeiros-passos", userId] });
}
