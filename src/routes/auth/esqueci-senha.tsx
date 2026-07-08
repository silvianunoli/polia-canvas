import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Mail, Check } from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthButton, SerifHeadline } from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";

export const Route = createFileRoute("/auth/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha · Pólia" },
      {
        name: "description",
        content:
          "Recuperação de acesso à conta Pólia. Um link pra criar uma nova senha, direto no e-mail.",
      },
    ],
  }),
  component: EsqueciSenhaPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido. Confere o @.").max(255),
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
      toastErro("Não consegui enviar agora. Tenta de novo em alguns segundos.");
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
    <AuthShell maxWidth={420}>
      {!sent ? (
        <>
          <SerifHeadline size={26}>Vamos recuperar.</SerifHeadline>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-[var(--ink-soft)]">
            É só informar o e-mail da conta que a gente manda o link.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
            <CosmicInput
              label="Seu e-mail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@seunegocio.com.br"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              reserveErrorSpace
              disabled={loading}
            />
            <div className="mt-1">
              <AuthButton type="submit" fullWidth loading={loading}>
                {loading ? "Enviando..." : "Enviar link →"}
              </AuthButton>
            </div>
          </form>

          <p className="mt-5 text-center text-[14px] text-[var(--muted)]">
            <Link to="/auth/login" className="text-[var(--ink-soft)] underline underline-offset-2">
              Lembrei a senha
            </Link>
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary-light)] text-[var(--secondary-ink)]">
            <Check size={22} aria-hidden="true" />
          </div>
          <h2 className="font-fraunces mt-3 text-[22px] leading-snug text-[var(--ink)]">
            Se esse e-mail tiver conta,
            <br />a gente manda o link.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Confira a caixa de entrada (e o spam). O link vale por 1 hora.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="mt-5 text-[13.5px] text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
          >
            {cooldown > 0 ? `Pode pedir outro em ${cooldown}s` : "Não chegou? Pedir de novo"}
          </button>
          <Link to="/auth/login" className="mt-6 text-[14px] text-[var(--muted)]">
            Voltar pra entrada
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
