import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailPolia, enviarEmailResend } from "@/lib/email-template";

const SITE_URL = "https://usepolia.com.br";

// Chamada 1x no primeiro load do /onboarding — cobre os dois jeitos de criar
// conta (cadastro normal e compra pública) porque os dois redirecionam pra
// lá. Idempotente via boas_vindas_enviado_em: se já tem timestamp, não manda
// de novo. O timestamp só é gravado com o envio confirmado — ver abaixo.
export const garantirBoasVindas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("boas_vindas_enviado_em")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || (profile as { boas_vindas_enviado_em: string | null }).boas_vindas_enviado_em) {
      return { ok: true };
    }

    const email =
      typeof context.claims.email === "string" ? context.claims.email : undefined;
    if (!email) return { ok: false };

    const enviado = await enviarEmailResend({
      to: [email],
      subject: "Bem-vinda à Pólia",
      text: `Sua conta está pronta.\n\nO primeiro passo leva 3 minutos: a Pólia pergunta o preço e o custo de um produto seu e mostra quanto sobra em cada venda.\n\n${SITE_URL}/painel`,
      html: emailPolia({
        preheader: "Sua conta na Pólia está pronta.",
        headline: "Sua conta está pronta",
        paragrafos: [
          "O primeiro passo leva 3 minutos: a Pólia pergunta o preço e o custo de um produto seu e mostra quanto sobra em cada venda.",
        ],
        ctaLabel: "Entrar na Pólia",
        ctaUrl: `${SITE_URL}/painel`,
      }),
      contexto: "[BoasVindas]",
    });
    // Só marca depois de o Resend confirmar. Marcar antes transformava
    // qualquer falha em "essa conta já recebeu" pra sempre — foi o que
    // aconteceu com quem criou conta enquanto a RESEND_API_KEY não existia
    // no Worker de produção (descoberto em 12/08/2026 via erros_app).
    //
    // Sem trava de tentativa de propósito: com falha persistente a função
    // tenta de novo a cada load do /onboarding, e isso é aceitável porque
    // o /onboarding se auto-limita — o beforeLoad manda pra /painel ou
    // /assinar assim que onboarding_completed vira true, então são poucos
    // loads por conta, não um laço. Cada falha já vira linha em erros_app,
    // que tem tela no admin, e o retry é justamente o que faz o e-mail sair
    // sozinho quando a causa (chave, domínio, cota) for corrigida. Contador
    // ou intervalo mínimo exigiria coluna nova e estado extra pra resolver
    // um problema que o fluxo não tem.
    if (!enviado) return { ok: false };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ boas_vindas_enviado_em: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) console.error("[BoasVindas] Falha ao marcar enviado:", error);

    return { ok: true };
  });
