import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dentroDoPrazoFundadora } from "@/lib/fundadora";

/**
 * A conta recebeu a promessa do preço antigo e ainda está no prazo? Joga se a
 * leitura falhar: o checkout não pode decidir o preço sem saber.
 */
export async function contaTemPrecoHonrado(
  userId: string,
  agora: number = Date.now(),
): Promise<boolean> {
  if (!dentroDoPrazoFundadora(agora)) return false;
  const { data, error } = await supabaseAdmin
    .from("precos_honrados" as never)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Leitura de precos_honrados falhou: ${error.message}`);
  return !!data;
}

/** Pra tela de assinatura. Falhou: mostra o preço público, e o checkout confere de novo. */
export const precoHonradoDaConta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ honrado: boolean }> => {
    try {
      return { honrado: await contaTemPrecoHonrado(context.userId) };
    } catch (err) {
      console.error("[fundadora]", err);
      return { honrado: false };
    }
  });
