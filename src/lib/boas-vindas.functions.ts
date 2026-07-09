import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailPolia, enviarEmailResend } from "@/lib/email-template";

const SITE_URL = "https://usepolia.com.br";

// Chamada 1x no primeiro load do /onboarding — cobre os dois jeitos de criar
// conta (cadastro normal e compra pública) porque os dois redirecionam pra
// lá. Idempotente via boas_vindas_enviado_em: se já tem timestamp, não manda
// de novo.
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

    await enviarEmailResend({
      to: [email],
      subject: "Bem-vinda à Pólia",
      text: `Sua conta está pronta.\n\nA Pólia é sua: um plano por vez, no seu ritmo. Comece organizando o que sua marca precisa agora.\n\n${SITE_URL}/painel`,
      html: emailPolia({
        preheader: "Sua conta na Pólia está pronta.",
        headline: "Sua conta está pronta",
        paragrafos: [
          "A Pólia é sua: um plano por vez, no seu ritmo. Comece organizando o que sua marca precisa agora.",
        ],
        ctaLabel: "Entrar na Pólia",
        ctaUrl: `${SITE_URL}/painel`,
      }),
      contexto: "[BoasVindas]",
    });

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ boas_vindas_enviado_em: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) console.error("[BoasVindas] Falha ao marcar enviado:", error);

    return { ok: true };
  });
