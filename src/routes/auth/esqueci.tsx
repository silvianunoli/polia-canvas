import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  SerifHeadline,
  SubText,
} from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";
import { CosmicButton } from "@/components/cosmic/CosmicButton";

export const Route = createFileRoute("/auth/esqueci")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha · Pólia" },
      {
        name: "description",
        content: "Recupere o acesso à sua conta Pólia. Vamos te enviar um link para criar uma nova senha.",
      },
      { property: "og:title", content: "Esqueci minha senha · Pólia" },
      {
        property: "og:description",
        content: "Recupere o acesso à sua conta Pólia. Vamos te enviar um link para criar uma nova senha.",
      },
    ],
  }),
  component: EsqueciPage,
});

const schema = z.object({
  email: z.string().trim().email("Esse e-mail não parece certo. Confere o formato.").max(255),
});

function EsqueciPage() {
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
      redirectTo: `${window.location.origin}/auth/redefinir`,
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
    <AuthShell maxWidth={400}>
      {!sent ? (
        <>
          <CaveatEyebrow size={26}>Acontece com todo mundo.</CaveatEyebrow>
          <SerifHeadline size={48}>Vamos recuperar sua conta.</SerifHeadline>
          <div className="mt-6 mb-8">
            <SubText>
              Coloca seu e-mail aqui. Vou te mandar um link para criar uma senha nova.
            </SubText>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <CosmicInput
              label="Seu e-mail"
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
            <div className="mt-2">
              <CosmicButton type="submit" loading={loading}>
                {loading ? "Enviando..." : "Enviar o link →"}
              </CosmicButton>
            </div>
          </form>

          <p className="mt-6 text-center font-sans text-[14px] text-[#D8D2CC]/70">
            Lembrei a senha!{" "}
            <Link to="/auth/login" className="text-[#C96B3E] underline underline-offset-2">
              Voltar para o login
            </Link>
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#2D6A4F] bg-[rgba(45,106,79,0.2)]">
            <Check size={28} color="#2D6A4F" />
          </div>
          <h2 className="mt-6 font-serif text-[36px] text-[#FDF8F5]">Link enviado.</h2>
          <p className="mt-3 font-sans text-[16px] text-[#D8D2CC]/80">
            Mandei para <span className="font-medium text-[#FDF8F5]">{sent}</span>. Pode demorar
            uns minutinhos. Não esquece de checar o spam.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="mt-6 font-sans text-[14px] text-[#C96B3E] underline underline-offset-2 disabled:opacity-50"
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Não recebi o e-mail"}
          </button>
          <Link
            to="/auth/login"
            className="mt-8 font-sans text-[14px] text-[#D8D2CC]/70 hover:text-[#FDF8F5]"
          >
            Voltar para o login
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
