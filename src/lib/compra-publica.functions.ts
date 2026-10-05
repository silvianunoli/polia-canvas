import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { stripeClient, precoParaPlano } from "@/lib/stripe.functions";
import { dispararAlerta } from "@/lib/alertas.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { HOST_CANONICO as SITE_URL } from "@/lib/seo";

const inputSchema = z.object({
  email: z.string().trim().email().max(255),
  // A chave interna (controle/projete) fica; o nome visível é Premium/Pro.
  plano: z.enum(["controle_mensal", "controle_anual", "projete_mensal", "projete_anual"]),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só um bot preenche.
  hp: z.string().optional(),
});

const ERRO_CHECKOUT = "A Pólia One não conseguiu abrir o checkout agora. Tenta de novo.";

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

    const stripe = stripeClient();
    const priceId = precoParaPlano(data.plano);

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
        // checkout_concluido/falhou (server) no funil de tagueamento.
        metadata: { plano: data.plano },
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
