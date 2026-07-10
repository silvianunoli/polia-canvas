import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { stripeClient, precoParaPlano } from "@/lib/stripe.functions";
import { dispararAlerta } from "@/lib/alertas.server";

const SITE_URL = "https://usepolia.com.br";

const inputSchema = z.object({
  email: z.string().trim().email().max(255),
  plano: z.enum(["mensal", "anual"]),
});

// Checkout hospedado do Stripe, sem exigir conta prévia: quem compra aqui
// ainda não tem login. A conta é criada pelo webhook (checkout.session.completed)
// depois que o pagamento é confirmado — ver supabase/functions/stripe-webhook.
export const iniciarCompraPublica = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const stripe = stripeClient();
    const priceId = precoParaPlano(data.plano);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: data.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${SITE_URL}/compra-confirmada`,
        cancel_url: `${SITE_URL}/precos`,
        allow_promotion_codes: true,
      });

      if (!session.url) {
        console.error("[CompraPublica] Sessão criada sem URL de checkout.");
        return { url: null, error: "Não consegui abrir o checkout agora. Tenta de novo." };
      }
      return { url: session.url, error: null };
    } catch (err) {
      console.error("[CompraPublica] Erro ao criar checkout session:", err);
      void dispararAlerta("checkout_erro", "Erro ao criar checkout público (sem conta)", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
      return { url: null, error: "Não consegui abrir o checkout agora. Tenta de novo." };
    }
  });
