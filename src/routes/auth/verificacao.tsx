import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { z } from "zod";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, SerifHeadline } from "@/components/cosmic/AuthShell";
import { ehErroDeCaptcha, MSG_CAPTCHA, tokenCaptcha } from "@/lib/captcha";
import { TurnstileCampo, useCaptcha } from "@/components/TurnstileCampo";
import { useCaptchaPronto } from "@/hooks/useCaptchaPronto";
import { sessaoEhDoEmail } from "@/lib/signup";

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/auth/verificacao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Confirmação de e-mail · Pólia" },
      {
        name: "description",
        content: "Confirmação de e-mail para começar a usar a Pólia.",
      },
      { property: "og:title", content: "Confirmação de e-mail · Pólia" },
      {
        property: "og:description",
        content: "Confirmação de e-mail para começar a usar a Pólia.",
      },
    ],
  }),
  component: VerificacaoPage,
});

function VerificacaoPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const captcha = useCaptcha();
  const captchaPronto = useCaptchaPronto(captcha);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Confirmou o e-mail em outra aba: esta segue sozinha. Só com a sessão de
  // QUEM está nesta tela: com A logada no mesmo navegador, voltar pra aba
  // dispara SIGNED_IN com a sessão de A, e a tela levava B pra conta de A.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && sessaoEhDoEmail(session.user.email, email)) {
        navigate({ to: "/onboarding" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, email]);

  async function handleResend() {
    if (!email || cooldown > 0 || !captchaPronto) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { captchaToken: tokenCaptcha(captcha.token) },
    });
    setResending(false);
    captcha.resetar();
    if (ehErroDeCaptcha(error)) {
      toastErro(MSG_CAPTCHA);
    } else if (error) {
      toastErro("A Pólia não conseguiu reenviar agora. Tenta de novo em alguns segundos.");
    } else {
      toastSucesso("Link reenviado. Confere seu e-mail (e o spam).");
      setCooldown(60);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary-light)] text-[var(--secondary-ink)]">
          <Mail size={22} aria-hidden="true" />
        </div>
        <SerifHeadline size={26}>Quase lá.</SerifHeadline>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-[var(--ink-soft)]">
          A Pólia mandou um link pra{" "}
          <span className="font-semibold text-[var(--ink)]">{email ?? "seu e-mail"}</span>.
          <br />
          Confirma pra entrar.
        </p>

        <p className="mt-5 text-center text-[13.5px] text-[var(--muted)]">
          Não chegou?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={!email || cooldown > 0 || resending || !captchaPronto}
            className="inline-flex min-h-11 items-center px-1 text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
          >
            {cooldown > 0
              ? `Pode pedir outro em ${cooldown}s`
              : resending
                ? "Enviando..."
                : email && !captchaPronto
                  ? "Conferindo..."
                  : "Reenviar o link"}
          </button>
        </p>
        <div className="mt-2 flex justify-center">
          <TurnstileCampo captcha={captcha} />
        </div>

        <p className="mt-4 text-center text-[14px] text-[var(--muted)]">
          <Link
            to="/auth/login"
            className="inline-block py-2 px-1 text-[var(--ink-soft)] underline underline-offset-2"
          >
            Voltar pra entrada
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
