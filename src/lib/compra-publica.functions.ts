import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { stripeClient, precoParaPlano } from "@/lib/stripe.functions";
import { dispararAlerta } from "@/lib/alertas.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { HOST_CANONICO as SITE_URL } from "@/lib/seo";
import { lerOrigemCampanha, temOrigemCampanha } from "@/lib/origemCampanha";

const inputSchema = z.object({
  // Minúsculo desde 08/10/2026: o hook de cadastro compara o convite com
  // lower(trim(email)) e o webhook grava o convite com o e-mail que o Stripe
  // devolve. "Ana@..." aqui virava convite "Ana@..." lá, que o hook não acha:
  // a conta da compra paga não nascia.
  email: z.string().trim().toLowerCase().email().max(255),
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

// Na URL o plano usa o nome visível (premium/pro), igual ao que a /planos lê.
const PLANO_NA_URL: Record<string, "premium" | "pro"> = {
  controle: "premium",
  projete: "pro",
};

async function emailJaAssinaNoBanco(email: string): Promise<boolean> {
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
}

// O banco só sabe da compra depois que o webhook dela chega. Se a 1ª compra
// acabou de ser paga e o webhook atrasou, a 2ª passava aqui e virava uma
// segunda assinatura cobrando (08/10/2026). O Stripe já sabe na hora: procura
// os customers com esse e-mail e as assinaturas com acesso deles.
// O filtro de e-mail do customers.list diferencia maiúscula: o e-mail chega
// minúsculo (schema acima) e é o mesmo que vira customer_email no checkout.
async function emailJaAssinaNoStripe(email: string): Promise<boolean> {
  const stripe = stripeClient();
  const clientes = await stripe.customers.list({ email, limit: 10 });
  for (const cliente of clientes.data) {
    const assinaturas = await stripe.subscriptions.list({
      customer: cliente.id,
      status: "all",
      limit: 20,
    });
    if (assinaturas.data.some((s) => STATUS_COM_ACESSO.includes(s.status))) return true;
  }
  return false;
}

// Quem já assina e compra de novo aqui ganhava uma segunda assinatura no
// Stripe: o webhook gravava a nova por cima e a antiga seguia cobrando sem
// aparecer no app (QA-04). Falha na leitura não trava a venda: o webhook
// também detecta a duplicada, cancela e estorna, e alerta no Telegram.
async function emailJaAssina(email: string): Promise<boolean> {
  try {
    if (await emailJaAssinaNoBanco(email)) return true;
  } catch (err) {
    console.error("[CompraPublica] Falha ao conferir assinatura existente no banco:", err);
  }
  try {
    return await emailJaAssinaNoStripe(email);
  } catch (err) {
    console.error("[CompraPublica] Falha ao conferir assinatura existente no Stripe:", err);
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

    // Revalidada aqui, no servidor: o navegador não é fonte confiável do que
    // vai parar nos metadados do Stripe.
    const origem = lerOrigemCampanha(data.origemCampanha ?? {});
    const comOrigem = temOrigemCampanha(origem);

    // Quem desiste no Stripe volta pra /planos com o mesmo plano escolhido e a
    // mesma origem de campanha (antes voltava pra /planos limpa e a landing de
    // origem se perdia no funil).
    const voltar = new URLSearchParams();
    const [tierDoPlano, cicloDoPlano] = data.plano.split("_");
    if (PLANO_NA_URL[tierDoPlano]) voltar.set("plano", PLANO_NA_URL[tierDoPlano]);
    if (cicloDoPlano === "mensal" || cicloDoPlano === "anual") voltar.set("ciclo", cicloDoPlano);
    for (const [chave, valor] of Object.entries(origem)) {
      if (valor) voltar.set(chave, valor);
    }

    try {
      // stripeClient()/precoParaPlano() jogam quando falta segredo no ambiente:
      // dentro do try viram a mensagem da Pólia One + alerta, não erro técnico.
      const stripe = stripeClient();
      const priceId = precoParaPlano(data.plano);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: data.email,
        line_items: [{ price: priceId, quantity: 1 }],
        // plano + id da sessão voltam na URL pro purchase do GA4 (FUN-09); o
        // Stripe troca {CHECKOUT_SESSION_ID} pelo id real no redirecionamento.
        success_url: `${SITE_URL}/compra-confirmada?plano=${data.plano}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/planos?${voltar.toString()}`,
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
