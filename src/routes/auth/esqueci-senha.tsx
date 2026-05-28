import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  SerifHeadline,
} from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";
import { PoliaButton } from "@/components/ui/PoliaButton";

export const Route = createFileRoute("/auth/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha — Pólia" },
      {
        name: "description",
        content:
          "Recupere o acesso à sua conta Pólia. Te enviamos um link para criar uma nova senha.",
      },
    ],
  }),
  component: EsqueciSenhaPage,
});

const schema = z.object({
  email: z
    .string()
    .trim()
    .email("Esse e-mail não parece certo. Confere o formato.")
    .max(255),
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink(target: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    });
    if (error) {
      toast.error("Não consegui enviar agora. Tenta de novo em alguns segundos.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setLoading(true);
    const ok = await sendLink(parsed.data.email);
    setLoading(false);
    if (ok) {
      setSent(parsed.data.email);
      setCooldown(60);
    }
  }

  async function handleResend() {
    if (!sent || cooldown > 0) return;
    setLoading(true);
    const ok = await sendLink(sent);
    setLoading(false);
    if (ok) setCooldown(60);
  }

  return (
    <AuthShell maxWidth={480}>
      {!sent ? (
        <>
          <CaveatEyebrow size={20}>sem estresse.</CaveatEyebrow>
          <SerifHeadline size={44}>Vamos recuperar o seu acesso.</SerifHeadline>
          <p
            className="mt-3 text-center font-sans text-[16px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Digite o seu e-mail e a gente te manda um link pra criar uma nova senha.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-4" noValidate>
            <CosmicInput
              label="Qual é o seu e-mail?"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ana@seunegocio.com.br"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              disabled={loading}
            />
            <div className="mt-1">
              <PoliaButton type="submit" fullWidth disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </PoliaButton>
            </div>
          </form>

          <p
            className="mt-8 text-center font-sans text-[14px]"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            Lembrei a senha.{" "}
            <Link
              to="/auth/login"
              className="transition-colors hover:text-[rgba(255,255,255,0.70)]"
            >
              Voltar ao login
            </Link>
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center text-center">
          <CheckCircle size={40} color="#2D6A4F" />
          <h2 className="mt-5 font-serif text-[28px] text-[#FDF8F5]">Link enviado.</h2>
          <p className="mt-2 font-handwritten text-[20px] text-[#E89770]">
            olha sua caixa de entrada.
          </p>
          <p
            className="mt-3 font-sans text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Enviamos um link pro seu e-mail. Ele expira em 1 hora.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="mt-6 font-sans text-[14px] text-[#C96B3E] underline underline-offset-2 disabled:opacity-50"
          >
            {cooldown > 0
              ? `Tentar novamente em ${cooldown}s`
              : "Não chegou? Tentar novamente"}
          </button>
          <Link
            to="/auth/login"
            className="mt-8 font-sans text-[14px]"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            Lembrei a senha. Voltar ao login
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
