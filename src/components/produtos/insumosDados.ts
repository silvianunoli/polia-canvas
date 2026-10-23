// Leitura e escrita de insumos, receitas e produções (ONE-133). Escrita só por
// RPC (migration 20261023280000); as tabelas são só de leitura pela API.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import type { InsumoComSaldo, LinhaReceita } from "@/lib/producao";

export const chaveInsumos = (userId: string | undefined) => ["insumos", userId] as const;

const n = (v: unknown) => Number(v ?? 0);

/** Insumos ativos com o saldo de cada um, em ordem de nome. */
export function useInsumos(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveInsumos(userId), "lista"],
    enabled: !!userId,
    queryFn: async (): Promise<InsumoComSaldo[]> => {
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase
          .from("insumo_saldos")
          .select("id, nome, unidade, custo_unitario, estoque_minimo, saldo, created_at")
          .eq("user_id", userId!)
          .order("nome")
          .order("id")
          .range(de, ate),
      );
      return linhas.flatMap((i) =>
        i.id
          ? [
              {
                id: i.id,
                nome: i.nome ?? "",
                unidade: i.unidade ?? "",
                custoUnitario: i.custo_unitario == null ? null : Number(i.custo_unitario),
                minimo: n(i.estoque_minimo),
                saldo: n(i.saldo),
                criadoEm: i.created_at,
              },
            ]
          : [],
      );
    },
  });
}

/** Receita de cada produto: produto_id → linhas. */
export function useReceitas(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveInsumos(userId), "receitas"],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, LinhaReceita[]>> => {
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase
          .from("produto_insumos")
          .select("id, produto_id, insumo_id, quantidade")
          .eq("user_id", userId!)
          .order("created_at")
          .order("id")
          .range(de, ate),
      );
      const porProduto = new Map<string, LinhaReceita[]>();
      for (const l of linhas) {
        const lista = porProduto.get(l.produto_id) ?? [];
        lista.push({ insumoId: l.insumo_id, quantidade: n(l.quantidade) });
        porProduto.set(l.produto_id, lista);
      }
      return porProduto;
    },
  });
}

export interface Producao {
  id: string;
  produtoNome: string;
  variacao: string | null;
  quantidade: number;
  data: string;
  observacao: string | null;
  desfeita: boolean;
}

/** As 20 produções mais recentes, pra conferir e desfazer. */
export function useProducoesRecentes(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveInsumos(userId), "producoes"],
    enabled: !!userId,
    queryFn: async (): Promise<Producao[]> => {
      const { data, error } = await supabase
        .from("producoes")
        .select("id, produto_nome, variacao, quantidade, data, observacao, desfeita_em")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        produtoNome: p.produto_nome,
        variacao: p.variacao,
        quantidade: n(p.quantidade),
        data: p.data,
        observacao: p.observacao,
        desfeita: !!p.desfeita_em,
      }));
    },
  });
}

export interface MovimentoInsumo {
  id: string;
  tipo: "entrada" | "producao" | "perda" | "ajuste" | "estorno";
  quantidade: number;
  motivo: string | null;
  createdAt: string;
}

export function useMovimentosInsumo(insumoId: string | null) {
  return useQuery({
    queryKey: ["insumo-movimentos", insumoId],
    enabled: !!insumoId,
    queryFn: async (): Promise<MovimentoInsumo[]> => {
      const { data, error } = await supabase
        .from("insumo_movimentos")
        .select("id, tipo, quantidade, motivo, created_at")
        .eq("insumo_id", insumoId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id,
        tipo: m.tipo as MovimentoInsumo["tipo"],
        quantidade: n(m.quantidade),
        motivo: m.motivo,
        createdAt: m.created_at,
      }));
    },
  });
}

export function salvarInsumo(p: {
  id: string | null;
  nome: string;
  unidade: string;
  custo: number | null;
  minimo: number;
  inicial: number;
}) {
  return supabase.rpc("salvar_insumo", {
    p_id: p.id,
    p_nome: p.nome,
    p_unidade: p.unidade,
    p_custo: p.custo,
    p_minimo: p.minimo,
    p_inicial: p.inicial,
  });
}

export function arquivarInsumo(id: string) {
  return supabase.rpc("arquivar_insumo", { p_id: id });
}

export type TipoMovimentoInsumo = "entrada" | "perda" | "ajuste";

export function movimentarInsumo(p: {
  insumoId: string;
  tipo: TipoMovimentoInsumo;
  quantidade: number;
  motivo: string | null;
}) {
  return supabase.rpc("movimentar_insumo", {
    p_insumo_id: p.insumoId,
    p_tipo: p.tipo,
    p_quantidade: p.quantidade,
    p_motivo: p.motivo,
  });
}

export function salvarReceita(produtoId: string, receita: readonly LinhaReceita[]) {
  return supabase.rpc("salvar_receita", {
    p_produto_id: produtoId,
    p_itens: receita.map((l) => ({ insumo_id: l.insumoId, quantidade: l.quantidade })),
  });
}

export function registrarProducao(p: {
  id: string;
  produtoId: string;
  skuId: string | null;
  quantidade: number;
  data: string;
  observacao: string | null;
}) {
  return supabase.rpc("registrar_producao", {
    p_id: p.id,
    p_produto_id: p.produtoId,
    p_sku_id: p.skuId,
    p_quantidade: p.quantidade,
    p_data: p.data,
    p_observacao: p.observacao,
  });
}

export function desfazerProducao(id: string) {
  return supabase.rpc("desfazer_producao", { p_id: id });
}
