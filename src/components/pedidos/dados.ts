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
}

export const chavePedidos = (userId: string | undefined) => ["pedidos", userId] as const;

const SELECT =
  "id, canal, data, status, cliente_id, cliente_nome, subtotal, desconto, frete, taxa_canal, custo_envio, total, observacao, andamento, entrega_em, venda_itens(produto_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)";

/**
 * Pedidos do quadro: abertos de qualquer data e entregues com entrega
 * combinada nos últimos 7 dias. Cancelado não vem.
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
        .or(`andamento.neq.entregue,entrega_em.gte.${desde}`)
        .order("entrega_em", { ascending: true })
        .limit(500);
      // Leitura que falha não pode virar "nenhum pedido": a tela mostra o erro.
      if (error) throw error;
      return ((data ?? []) as unknown as (VendaBanco & { andamento: string; entrega_em: string })[])
        .filter((v) => ehAndamento(v.andamento) && !!v.entrega_em)
        .map((v) => ({
          ...vendaDoBanco(v),
          andamento: v.andamento as AndamentoPedido,
          entregaEm: v.entrega_em,
        }));
    },
  });
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
}
