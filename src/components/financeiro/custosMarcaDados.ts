import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { custosDaLinha, mediaDePecas, type CustosMarca } from "@/lib/custosMarca";

// Leitura e gravação dos Custos da marca (ONE-258). A tabela custos_marca
// ainda não está nos tipos gerados (`as never`, mesmo padrão de avisos/dados).

export const CHAVE_CUSTOS_MARCA = "custos-marca";

const COLUNAS =
  "fixos_mes, fixos_detalhe, pecas_mes, imposto_pct, taxa_recebimento_pct, acrescimo_canais";

/** Custos da marca + pró-labore da Projeção. Sem linha ainda, tudo zerado. */
export function useCustosMarca(userId: string | undefined) {
  return useQuery({
    queryKey: [CHAVE_CUSTOS_MARCA, userId],
    enabled: !!userId,
    queryFn: async (): Promise<CustosMarca & { cadastrado: boolean }> => {
      const [linhaRes, perfilRes] = await Promise.all([
        supabase
          .from("custos_marca" as never)
          .select(COLUNAS)
          .eq("user_id" as never, userId! as never)
          .maybeSingle(),
        supabase.from("profiles").select("pro_labore_desejado").eq("id", userId!).maybeSingle(),
      ]);
      if (linhaRes.error) throw linhaRes.error;
      if (perfilRes.error) throw perfilRes.error;
      const linha = linhaRes.data as Parameters<typeof custosDaLinha>[0];
      const custos = custosDaLinha(linha, perfilRes.data?.pro_labore_desejado ?? null);
      return { ...custos, cadastrado: !!linha };
    },
  });
}

/** Grava os custos da marca (upsert) e o pró-labore em profiles. Devolve o erro, se houver. */
export async function salvarCustosMarca(
  userId: string,
  c: Omit<CustosMarca, "acrescimoCanais">,
): Promise<string | null> {
  const { error } = await supabase.from("custos_marca" as never).upsert(
    {
      user_id: userId,
      fixos_mes: Math.round(c.fixosMes * 100) / 100,
      fixos_detalhe: c.fixosDetalhe,
      pecas_mes: c.pecasMes,
      imposto_pct: c.impostoPct,
      taxa_recebimento_pct: c.taxaRecebimentoPct,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("custos_marca_salvar", error);
    return "A Pólia One não conseguiu salvar os custos da marca. Tenta de novo, os números continuam nos campos.";
  }
  const perfil = await supabase
    .from("profiles")
    .update({ pro_labore_desejado: c.proLabore > 0 ? c.proLabore : null })
    .eq("id", userId);
  if (perfil.error) {
    console.error("custos_marca_pro_labore", perfil.error);
    return "Os custos foram salvos, mas o pró-labore não. Tenta de novo.";
  }
  return null;
}

/** Grava só o acréscimo por marketplace (tela Marketplaces, ONE-259). */
export async function salvarAcrescimoCanais(
  userId: string,
  acrescimo: Record<string, number>,
): Promise<string | null> {
  const limpo: Record<string, number> = {};
  for (const [k, v] of Object.entries(acrescimo)) if (v > 0) limpo[k] = Math.round(v * 100) / 100;
  const { error } = await supabase
    .from("custos_marca" as never)
    .upsert(
      { user_id: userId, acrescimo_canais: limpo, updated_at: new Date().toISOString() } as never,
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("acrescimo_canais_salvar", error);
    return "A Pólia One não conseguiu salvar o acréscimo. Tenta de novo.";
  }
  return null;
}

/** Sugestão de peças por mês: itens vendidos nos últimos 90 dias ÷ 3 (sem canceladas). */
export function useSugestaoPecasMes(userId: string | undefined) {
  return useQuery({
    queryKey: ["custos-marca-sugestao-pecas", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number | null> => {
      const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: vendas, error } = await supabase
        .from("vendas")
        .select("id")
        .eq("user_id", userId!)
        .neq("status", "cancelada")
        .gte("data", desde)
        .limit(3000);
      if (error) throw error;
      const ids = (vendas ?? []).map((v) => v.id);
      let total = 0;
      for (let i = 0; i < ids.length; i += 200) {
        const { data: itens, error: erroItens } = await supabase
          .from("venda_itens")
          .select("quantidade")
          .in("venda_id", ids.slice(i, i + 200));
        if (erroItens) throw erroItens;
        total += (itens ?? []).reduce((s, it) => s + Number(it.quantidade || 0), 0);
      }
      return mediaDePecas(total, 3);
    },
  });
}
