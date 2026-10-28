import { supabase } from "@/integrations/supabase/client";
import { gtagEvent } from "@/lib/gtag";

// Ativação no GA4 (ONE-65): o primeiro produto salvo a partir da Calculadora é
// o momento em que ela viu quanto sobra. Saiu do onboarding com o passo de
// preço (ONE-50) e volta aqui. Conta depois do insert: 1 produto = o primeiro.
// Chamada pelo modal do catálogo e pelo primeiro preço guardado sozinho (GRW-90).
export async function avisarAtivacaoNoGA(userId: string, comCusto: boolean) {
  const { count, error } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error || count !== 1) return;
  gtagEvent("ativacao_viu_quanto_sobra", { com_custo: comCusto });
}
