import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripeClient } from "@/lib/stripe.functions";

const STATUS_ATIVOS = new Set(["active", "past_due", "trialing"]);

// Exclusão de conta (LGPD art. 18). Deriva a usuária do próprio token — nunca
// recebe id de fora — então só dá pra excluir a própria conta. Ordem importa:
// cancela o Stripe ANTES de apagar (senão o cartão seguiria sendo cobrado), só
// então apaga os dados e o login.
export const excluirMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    // 1) Cancela a assinatura no Stripe se estiver ativa. Se falhar, aborta a
    //    exclusão — não dá pra apagar a conta deixando uma cobrança viva.
    const { data: assinatura } = await supabaseAdmin
      .from("assinaturas" as never)
      .select("stripe_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    const sub = assinatura as { stripe_subscription_id: string | null; status: string } | null;
    if (sub?.stripe_subscription_id && STATUS_ATIVOS.has(sub.status)) {
      try {
        await stripeClient().subscriptions.cancel(sub.stripe_subscription_id);
      } catch (err) {
        console.error("[Conta] Falha ao cancelar assinatura na exclusão:", err);
        return {
          ok: false,
          error:
            "Não consegui cancelar sua assinatura agora. Tenta de novo em instantes ou fala com a gente em oi@usepolia.com.br antes de excluir.",
        };
      }
    }

    // 2) Apaga todos os dados da usuária numa transação (roda como a própria
    //    usuária via auth.uid() — ver migração 20260709170500).
    const { error: rpcError } = await context.supabase.rpc(
      "excluir_dados_do_usuario" as never,
    );
    if (rpcError) {
      console.error("[Conta] Falha ao apagar dados da usuária:", rpcError);
      return { ok: false, error: "Não consegui apagar seus dados agora. Tenta de novo." };
    }

    // 3) Remove o usuário do Auth (login, sessões, e-mail). Se falhar aqui, os
    //    dados pessoais já se foram — sobra só a casca de login, sem PII de conteúdo.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[Conta] Dados apagados, mas falha ao remover usuário do Auth:", authError);
    }

    return { ok: true, error: null };
  });
