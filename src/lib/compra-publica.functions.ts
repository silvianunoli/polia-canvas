import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { stripeClient, precoParaPlano } from "@/lib/stripe.functions";
import { dispararAlerta } from "@/lib/alertas.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { HOST_CANONICO as SITE_URL } from "@/lib/seo";
import { lerOrigemCampanha, temOrigemCampanha } from "@/lib/origemCampanha";

const inputSchema = z.object({
  email: z.string().trim().email().max(255),
  // A chave interna (controle/projete) fica; o nome visível é Premium/Pro.
  plano: z.enum(["controle_mensal", "controle_anual", "projete_mensal", "projete_anual"]),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só um bot preenche.
  hp: z.string().optional(),
  // Origem de campanha (landing + UTMs) que a /planos recebeu na URL. Chega
  // como objeto solto de propósito: quem filtra é lerOrigemCampanha no handler,
  // que descarta o que não passa na allowlist em vez de derrubar a compra.
  origemCampanha: z.record(z.string(), z.unknown()).optional().catch(undefined),
});

const ERRO_CHECKOUT = "A Pólia One não conseguiu abrir o checkout agora. Tenta de novo.";

export const ERRO_JA_ASSINA =
  "Esse e-mail já tem uma assinatura ativa na Pólia One. Pra trocar de plano, entra na conta e abre Configurações.";

const STATUS_COM_ACESSO = ["active", "trialing", "past_due"];

// Quem já assina e compra de novo aqui ganhava uma segunda assinatura no
// Stripe: o webhook gravava a nova por cima e a antiga seguia cobrando sem
// aparecer no app (QA-04). Falha na leitura não trava a venda: o webhook
// também recusa sobrescrever uma assinatura vigente e alerta no Telegram.
async function emailJaAssina(email: string): Promise<boolean> {
  try {
    const { data: userId, error } = await supabaseAdmin.rpc(
      "buscar_user_id_por_email" as never,
      { p_email: email } as never,
    );
    if (error) throw error;
    if (!userId) return false;
    const { data, error: erroAssinatura } = await supabaseAdmin
      .from("assinaturas" as never)
      .select("status")
      .eq("user_id", userId as unknown as string)
      .maybeSingle();
    if (erroAssinatura) throw erroAssinatura;
    const status = (data as { status?: string } | null)?.status;
    return !!status && STATUS_COM_ACESSO.includes(status);
  } catch (err) {
    console.error("[CompraPublica] Falha ao conferir assinatura existente:", err);
    return false;
  }
}

// Checkout hospedado do Stripe, sem exigir conta prévia: quem compra aqui
// ainda não tem login. A conta é criada pelo webhook (checkout.session.completed)
// depois que o pagamento é confirmado — ver supabase/functions/stripe-webhook.
//
// O Turnstile é validado AQUI, no servidor, antes de tocar no Stripe: esta
// função é pública e cada chamada cria uma sessão de checkout na conta live.
export const iniciarCompraPublica = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    // Bot preencheu o honeypot: finge falha genérica e não cria nada.
    if (data.hp) return { url: null, error: ERRO_CHECKOUT, sessionId: null };

    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return {
        url: null,
        error: "Confirma que não é um robô e tenta de novo.",
        sessionId: null,
      };
    }

    if (await emailJaAssina(data.email)) {
      return { url: null, error: ERRO_JA_ASSINA, sessionId: null, jaAssina: true };
    }

    const stripe = stripeClient();
    const priceId = precoParaPlano(data.plano);
    // Revalidada aqui, no servidor: o navegador não é fonte confiável do que
    // vai parar nos metadados do Stripe.
    const origem = lerOrigemCampanha(data.origemCampanha ?? {});
    const comOrigem = temOrigemCampanha(origem);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: data.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${SITE_URL}/compra-confirmada`,
        cancel_url: `${SITE_URL}/planos`,
        allow_promotion_codes: true,
        // metadata.plano vai junto no evento do webhook (checkout.session.completed),
        // e session.id correlaciona o checkout_iniciado (client) com o
        // checkout_concluido/falhou (server) no funil de tagueamento. A origem
        // (landing + UTMs) vai junto quando existe, pra saber qual landing vendeu;
        // na assinatura ela fica visível no painel do Stripe.
        metadata: { plano: data.plano, ...origem },
        ...(comOrigem ? { subscription_data: { metadata: { ...origem } } } : {}),
      });

      if (!session.url) {
        console.error("[CompraPublica] Sessão criada sem URL de checkout.");
        return { url: null, error: ERRO_CHECKOUT, sessionId: null };
      }
      return { url: session.url, error: null, sessionId: session.id };
    } catch (err) {
      console.error("[CompraPublica] Erro ao criar checkout session:", err);
      void dispararAlerta("checkout_erro", "Erro ao criar checkout público (sem conta)", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
      return { url: null, error: ERRO_CHECKOUT, sessionId: null };
    }
  });
