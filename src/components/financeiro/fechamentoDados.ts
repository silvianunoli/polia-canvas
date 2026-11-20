// Leitura do fechamento do mês (ONE-207 Fase 3). As regras ficam em
// lib/fechamentoDoMes.ts; aqui só o que falta além dos lançamentos (que o
// Financeiro já tem): as contas pagas e recebidas do mês e as vendas cujas
// entradas caíram nele, pra saber valor original, fornecedor, cliente e taxa.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  limitesDoMesISO,
  type ContaPagaDoMes,
  type ContaRecebidaDoMes,
  type ExtrasDoFechamento,
  type VendaRecebidaDoMes,
} from "@/lib/fechamentoDoMes";

// custo_envio ainda não está nos tipos gerados (mesmo jeito de pedidos/dados.ts).
const COLUNAS_VENDA: string = "lancamento_id, cliente_nome, total, taxa_canal, custo_envio";

const LOTE = 200;
const n = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * `idsLancamentosDeVenda`: lançamentos do mês que vieram de venda
 * ("venda:<id>"). A venda é achada pelo lancamento_id, que é o que garante
 * que a entrada dela caiu neste mês (a venda pode ser de outro mês).
 */
export function useExtrasDoFechamento(
  userId: string | undefined,
  anoMes: string,
  idsLancamentosDeVenda: readonly string[],
  /**
   * Muda quando os lançamentos do mês mudam (ids juntos). Pagar, receber ou
   * desfazer cria ou apaga lançamento, e isso faz o fechamento ler de novo.
   */
  assinatura: string,
) {
  return useQuery({
    queryKey: ["fechamento-mes", userId, anoMes, assinatura],
    enabled: !!userId && /^\d{4}-\d{2}$/.test(anoMes),
    queryFn: async (): Promise<ExtrasDoFechamento> => {
      const { de, ate } = limitesDoMesISO(anoMes);
      const [pagasRes, recebidasRes] = await Promise.all([
        supabase
          .from("contas_pagar")
          .select("lancamento_id, fornecedor, documento, parcela, parcelas, valor, valor_pago")
          .eq("user_id", userId!)
          .eq("status", "paga")
          .gte("pago_em", de)
          .lte("pago_em", ate)
          .limit(1000),
        supabase
          .from("contas_receber")
          .select("lancamento_id, cliente, documento, parcela, parcelas, valor, valor_recebido")
          .eq("user_id", userId!)
          .eq("status", "recebida")
          .gte("recebido_em", de)
          .lte("recebido_em", ate)
          .limit(1000),
      ]);
      if (pagasRes.error) throw pagasRes.error;
      if (recebidasRes.error) throw recebidasRes.error;

      const vendas: VendaRecebidaDoMes[] = [];
      for (let i = 0; i < idsLancamentosDeVenda.length; i += LOTE) {
        const lote = idsLancamentosDeVenda.slice(i, i + LOTE);
        const { data, error } = await supabase
          .from("vendas")
          .select(COLUNAS_VENDA)
          .eq("user_id", userId!)
          .in("lancamento_id", lote);
        if (error) throw error;
        type VendaBanco = {
          lancamento_id: string | null;
          cliente_nome: string | null;
          total: number;
          taxa_canal: number;
          custo_envio: number | null;
        };
        for (const v of (data ?? []) as unknown as VendaBanco[])
          vendas.push({
            lancamentoId: v.lancamento_id,
            clienteNome: v.cliente_nome,
            total: n(v.total),
            taxaCanal: n(v.taxa_canal),
            custoEnvio: n(v.custo_envio),
          });
      }

      const contasPagas: ContaPagaDoMes[] = (pagasRes.data ?? []).map((c) => ({
        lancamentoId: c.lancamento_id,
        fornecedor: c.fornecedor,
        documento: c.documento,
        parcela: c.parcela,
        parcelas: c.parcelas,
        valor: n(c.valor),
        valorPago: c.valor_pago === null ? null : n(c.valor_pago),
      }));
      const contasRecebidas: ContaRecebidaDoMes[] = (recebidasRes.data ?? []).map((c) => ({
        lancamentoId: c.lancamento_id,
        cliente: c.cliente,
        documento: c.documento,
        parcela: c.parcela,
        parcelas: c.parcelas,
        valor: n(c.valor),
        valorRecebido: c.valor_recebido === null ? null : n(c.valor_recebido),
      }));
      return { contasPagas, contasRecebidas, vendas };
    },
  });
}
