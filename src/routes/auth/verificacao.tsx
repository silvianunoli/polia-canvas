import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { z } from "zod";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, SerifHeadline } from "@/components/cosmic/AuthShell";

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/auth/verificacao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate({ to: "/onboarding" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      toastErro("Não conseguimos reenviar agora. Tenta de novo em alguns segundos.");
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
          A gente mandou um link pra{" "}
          <span className="font-semibold text-[var(--ink)]">{email ?? "seu e-mail"}</span>.
          <br />
          Confirma pra entrar.
        </p>

        <p className="mt-5 text-center text-[13.5px] text-[var(--muted)]">
          Não chegou?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={!email || cooldown > 0 || resending}
            className="text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
          >
            {cooldown > 0
              ? `Pode pedir outro em ${cooldown}s`
              : resending
                ? "Enviando..."
                : "Reenviar o link"}
          </button>
        </p>

        <p className="mt-6 text-center text-[14px] text-[var(--muted)]">
          <Link to="/auth/login" className="text-[var(--ink-soft)] underline underline-offset-2">
            Voltar pra entrada
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
