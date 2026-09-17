import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bucketDaUsuaria, decidirFlag, type Ambiente, type FlagRegistro } from "@/lib/flags-regra";

// Leitor de feature flags no servidor (Worker), mesma regra do client.
// Sem cache: a server function já é uma chamada por ação, e o kill-switch
// precisa valer na hora em que a Sil desliga.
function ambienteServidor(): Ambiente {
  return process.env.FOUNDER_AMBIENTE === "preview" ? "preview" : "prod";
}

export async function flagAtivaServidor(
  key: string,
  userId: string | null,
  padrao = true,
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("founder_flags")
      .select("estado, rollout_pct, beta_user_ids")
      .eq("key", key)
      .eq("ambiente", ambienteServidor())
      .maybeSingle();
    const flag = (data as FlagRegistro | null) ?? null;
    const bucket = userId ? await bucketDaUsuaria(userId, key) : null;
    return decidirFlag(flag, userId, bucket, padrao);
  } catch {
    return padrao;
  }
}
