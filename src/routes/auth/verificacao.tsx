import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  SerifHeadline,
} from "@/components/cosmic/AuthShell";

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/auth/verificacao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Confirma seu e-mail · Pólia" },
      {
        name: "description",
        content: "Confirme seu e-mail para começar a usar a Pólia.",
      },
      { property: "og:title", content: "Confirma seu e-mail · Pólia" },
      {
        property: "og:description",
        content: "Confirme seu e-mail para começar a usar a Pólia.",
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
      toast.error("Não consegui reenviar agora. Tenta de novo em alguns segundos.");
    } else {
      toast.success("Enviei um novo link de confirmação.");
      setCooldown(60);
    }
  }

  return (
    <AuthShell>
      <CaveatEyebrow>Só mais um passo.</CaveatEyebrow>
      <SerifHeadline>Confirma seu e-mail.</SerifHeadline>

      <div className="mt-8 flex flex-col items-center">
        <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl border border-dashed border-[rgba(201,107,62,0.4)] bg-[rgba(201,107,62,0.12)]">
          <Mail size={48} color="#C96B3E" strokeWidth={1.5} />
        </div>

        <p className="mt-7 text-center font-sans text-[17px] leading-relaxed text-[#D8D2CC]/90">
          Mandei um link de confirmação para{" "}
          <span className="font-semibold text-[#FDF8F5]">{email ?? "seu e-mail"}</span>. Clica
          nele para continuar.
        </p>
        <p className="mt-2 text-center font-sans text-[14px] text-[#D8D2CC]/60">
          Pode demorar alguns minutinhos. Não esquece de checar o spam.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || cooldown > 0 || resending}
          className="mt-6 font-sans text-[14px] text-[#C96B3E] underline underline-offset-2 disabled:opacity-50"
        >
          {cooldown > 0
            ? `Reenviar em ${cooldown}s`
            : resending
              ? "Enviando..."
              : "Não recebi o e-mail - reenviar"}
        </button>

        <p className="mt-10 text-center font-sans text-[14px] text-[#D8D2CC]/60">
          E-mail errado?{" "}
          <Link to="/auth/cadastro" className="text-[#C96B3E] underline underline-offset-2">
            Voltar e corrigir
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
