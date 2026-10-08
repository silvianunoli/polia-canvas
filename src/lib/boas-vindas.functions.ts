import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailPolia, enviarEmailResend } from "@/lib/email-template";
import { HOST_CANONICO as SITE_URL } from "@/lib/seo";

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

    const email = typeof context.claims.email === "string" ? context.claims.email : undefined;
    if (!email) return { ok: false };

    const enviado = await enviarEmailResend({
      to: [email],
      subject: "Bem-vinda à Pólia One",
      // "Você" não é sujeito de capacidade (trava de 17/08/2026): quem promete
      // é a Pólia One.
      text: `Sua conta está pronta.\n\nA partir de agora, a Pólia One faz parte do seu negócio.\n\nA Pólia One organiza os números do negócio e mostra o que eles dizem. A decisão sobre o que fazer com eles continua sua.\n\n${SITE_URL}/painel`,
      html: emailPolia({
        preheader: "A Pólia One já está pronta pra organizar os números do seu negócio.",
        headline: "Sua conta está pronta",
        paragrafos: [
          "A partir de agora, a Pólia One faz parte do seu negócio.",
          "A Pólia One organiza os números do negócio e mostra o que eles dizem. A decisão sobre o que fazer com eles continua sua.",
        ],
        ctaLabel: "Acessar",
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
