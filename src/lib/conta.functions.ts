import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripeClient } from "@/lib/stripe.functions";
import { sanitizarMensagemErro } from "@/lib/error-sanitize";

const STATUS_ATIVOS = new Set(["active", "past_due", "trialing"]);

// Falha de exclusão morria em console.error no Worker, que ninguém lê: a tela
// mostrava "não conseguimos apagar seus dados" e o motivo real (um 23502 vindo
// de admin_audit_log) não ficava registrado em lugar nenhum. Aqui a falha vira
// linha em erros_app, que já tem tela no admin, com o código do Postgres junto.
// Mensagem passa por sanitizarMensagemErro antes de gravar (LGPD-03).
async function registrarFalhaDeExclusao(etapa: string, detalhe: string, userId: string | null) {
  try {
    await supabaseAdmin.from("erros_app").insert({
      origem: "server",
      mensagem: sanitizarMensagemErro(`[Conta] Exclusão de conta falhou em ${etapa}: ${detalhe}`),
      pagina: "/configuracoes",
      user_id: userId,
    });
  } catch {
    // O log do erro nunca pode virar um erro.
  }
}

// Junta o que o PostgREST devolve num texto só. `code` é o que importa: é o
// SQLSTATE do Postgres (23502 = coluna NOT NULL, 23503 = chave estrangeira,
// 42P01 = tabela que não existe mais), e cada um desses aponta pra um conserto
// diferente.
function detalharErroDeBanco(erro: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): string {
  return [erro.code, erro.message, erro.details, erro.hint].filter(Boolean).join(" | ");
}

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
        await registrarFalhaDeExclusao(
          "cancelamento da assinatura no Stripe",
          err instanceof Error ? err.message : String(err),
          userId,
        );
        return {
          ok: false,
          error:
            "Não conseguimos cancelar sua assinatura agora. Tenta de novo em instantes ou fala com a gente em oi@usepolia.com.br antes de excluir.",
        };
      }
    }

    // 2) Apaga todos os dados da usuária numa transação (roda como a própria
    //    usuária via auth.uid() — ver migração 20260915150000, que varre o
    //    schema em vez de depender de uma lista de tabelas escrita à mão).
    const { error: rpcError } = await context.supabase.rpc("excluir_dados_do_usuario" as never);
    if (rpcError) {
      const detalhe = detalharErroDeBanco(rpcError);
      console.error("[Conta] Falha ao apagar dados da usuária:", detalhe);
      await registrarFalhaDeExclusao("excluir_dados_do_usuario", detalhe, userId);
      return {
        ok: false,
        error:
          "Não conseguimos apagar seus dados agora. Tenta de novo em instantes. Se continuar assim, fala com a gente em oi@usepolia.com.br que a gente apaga pra você.",
      };
    }

    // 3) Remove o usuário do Auth (login, sessões, e-mail). Se falhar aqui, os
    //    dados pessoais já se foram — sobra só a casca de login, sem PII de conteúdo.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[Conta] Dados apagados, mas falha ao remover usuário do Auth:", authError);
      // user_id vai nulo de propósito: o perfil já foi apagado acima, e
      // erros_app.user_id aponta pra profiles(id) — gravar o id aqui quebraria
      // o próprio log por chave estrangeira, além de guardar quem já pediu
      // pra ser esquecida.
      await registrarFalhaDeExclusao("auth.admin.deleteUser", authError.message, null);
      // Até 17/09/2026 esta etapa caía direto no `return { ok: true }` abaixo: o
      // login continuava de pé e a tela dizia que a conta tinha sido excluída.
      // Foi assim que a exclusão de 15/09 virou uma casca de login órfã sem
      // ninguém perceber. Falha de verdade devolve falha, mesmo com o passo 2
      // já feito — o texto conta as duas metades, porque os dados não voltam.
      return {
        ok: false,
        error:
          "Seus dados foram apagados, mas o login ainda não saiu do ar. A gente termina isso pra você: escreve pra oi@usepolia.com.br que resolvemos hoje mesmo.",
      };
    }

    return { ok: true, error: null };
  });
