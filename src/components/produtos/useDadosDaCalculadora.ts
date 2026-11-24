import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserMeta } from "@/hooks/useUserMeta";
import { temNumerosDoMes } from "@/lib/planos";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { custosFixosPorItem } from "@/lib/custosFixos.functions";
import { resumoEquipamentos } from "@/lib/equipamentos";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";
import { useEquipamentos } from "./equipamentosDados";

/**
 * O que a Calculadora lê da conta, fora os campos: valor-hora padrão, Meta do
 * mês, custos fixos do Financeiro e reserva dos equipamentos. Saiu da rota
 * /calculadora em 24/11/2026 pra a mesma calculadora abrir dentro do cadastro
 * de produto (ONE-254) com os mesmos atalhos.
 */
export function useDadosDaCalculadora(userId: string | undefined) {
  const meta = useUserMeta();

  // Valor-hora padrão: persistido em profiles pra reaproveitar entre os modos
  // Produto, Serviço e Encomenda e entre sessões.
  const valorHoraPadraoQuery = useQuery({
    queryKey: ["produtos-valor-hora-padrao", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("valor_hora_padrao")
        .eq("id", userId!)
        .maybeSingle();
      return (data?.valor_hora_padrao as number | null) ?? null;
    },
  });

  // Meta do mês: mesma fonte que Painel e Financeiro (tabela `metas`).
  const metaBoaQuery = useQuery({
    queryKey: ["meta-do-mes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await buscarMetaDoMes(supabase, userId!);
      return data?.valor_alvo || null;
    },
  });

  // Saídas do mês corrente no Financeiro, pro "Puxar do Financeiro" dos custos
  // fixos. Mesmo recorte da Projeção (mês filtrado no banco, lido página por
  // página). Leitura opcional: se falhar, o botão só não aparece.
  const fixosFinanceiroQuery = useQuery({
    queryKey: ["calculadora-fixos-financeiro", userId],
    enabled: !!userId,
    queryFn: async () => {
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();
      const intervalo = intervaloDoMes(ano, mes);
      const lancamentos = await lerTodasAsPaginas<LancamentoResumo>((de, ate) =>
        supabase
          .from("lancamentos")
          .select("id, tipo, valor, data, descricao, categoria")
          .eq("user_id", userId!)
          .eq("tipo", "saida")
          .gte("data", intervalo.inicio)
          .lt("data", intervalo.fimExclusivo)
          .order("data", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate)
          .then((r) => ({
            data: r.data as unknown as LancamentoResumo[] | null,
            error: r.error,
          })),
      );
      return custosFixosPorItem(lancamentos, mes, ano);
    },
  });

  // Reserva da aba Equipamentos (ONE-193). Leitura opcional, como a de cima.
  const equipamentosQuery = useEquipamentos(userId);

  return {
    carregando: valorHoraPadraoQuery.isLoading || metaBoaQuery.isLoading,
    valorHoraPadrao: valorHoraPadraoQuery.data ?? null,
    valorHoraPadraoCarregando: valorHoraPadraoQuery.isLoading,
    metaBoa: metaBoaQuery.data ?? null,
    fixosDoFinanceiro: fixosFinanceiroQuery.data ?? null,
    reservaEquipamentos: resumoEquipamentos(equipamentosQuery.data ?? []).reservaDoMes,
    ehProjete: temNumerosDoMes(meta.plano),
  };
}
