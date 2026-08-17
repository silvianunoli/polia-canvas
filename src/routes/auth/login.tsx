import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { z } from "zod";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthButton, Divider, SerifHeadline } from "@/components/cosmic/AuthShell";
import { CosmicInput, useCapsLockWarning, CapsLockHint } from "@/components/cosmic/CosmicInput";
import { GoogleButton } from "@/components/cosmic/GoogleButton";
import { resolvePostLoginPath } from "@/hooks/useSupabaseSession";
import { ERROR_COPY } from "@/components/layout/ErrorPage";

const searchSchema = z.object({
  email: z.string().email().optional(),
  next: z.string().optional(),
  motivo: z.enum(["sessao-expirada"]).optional(),
});

// Só aceita destino relativo (começa com "/") — bloqueia redirect pra domínio
// externo caso alguém manipule o parâmetro da URL.
function destinoSeguro(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const MAX_TENTATIVAS = 5;
const LOCKOUT_SEGUNDOS = 60;
const RESEND_COOLDOWN_SEGUNDOS = 60;

export const Route = createFileRoute("/auth/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Entrar · Pólia" },
      { name: "description", content: "A conta Pólia continua de onde parou." },
      { property: "og:title", content: "Entrar · Pólia" },
      {
        property: "og:description",
        content: "A conta Pólia continua de onde parou.",
      },
    ],
  }),
  component: LoginPage,
});

function validarEmailFormato(v: string): string | undefined {
  if (!v.trim()) return "Falta o seu e-mail.";
  if (!z.string().email().safeParse(v.trim()).success) {
    return "E-mail inválido. Confere o @.";
  }
  return undefined;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [values, setValues] = useState({ email: search.email ?? "", senha: "" });
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  // Erro de "e-mail ou senha não conferem" fica separado dos erros de campo
  // de propósito — não pode ficar embaixo do e-mail nem da senha, senão dá
  // pra deduzir qual dos dois errou só de olhar onde a mensagem apareceu.
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tentativas, setTentativas] = useState(0);
  const [lockoutCooldown, setLockoutCooldown] = useState(0);
  const caps = useCapsLockWarning();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.email) setValues((s) => ({ ...s, email: search.email! }));
  }, [search.email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (lockoutCooldown <= 0) return;
    const t = setTimeout(() => {
      setLockoutCooldown((c) => c - 1);
      if (lockoutCooldown - 1 <= 0) setTentativas(0);
    }, 1000);
    return () => clearTimeout(t);
  }, [lockoutCooldown]);

  function set<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setUnverified(null);
    setLoginErro(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lockoutCooldown > 0) return;
    const emailErro = validarEmailFormato(values.email);
    const senhaErro = !values.senha ? "Falta a sua senha." : undefined;
    if (emailErro || senhaErro) {
      setErrors({ email: emailErro, senha: senhaErro });
      return;
    }
    setErrors({});
    setLoginErro(null);
    setUnverified(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.senha,
      });
      if (error) {
        if (/confirm/i.test(error.message) || /verified/i.test(error.message)) {
          setUnverified(values.email.trim());
        } else {
          const proximaTentativa = tentativas + 1;
          setTentativas(proximaTentativa);
          if (proximaTentativa >= MAX_TENTATIVAS) {
            setLockoutCooldown(LOCKOUT_SEGUNDOS);
            setLoginErro("Muitas tentativas. Vale esperar um minuto e tentar de novo.");
          } else {
            setLoginErro("E-mail ou senha não conferem. Vale conferir de novo.");
          }
          // O campo ainda está `disabled` (loading só vira false no finally
          // logo abaixo) — um input desabilitado não aceita foco, por isso
          // adia pro próximo tick, depois que o re-render já tirou o disabled.
          setTimeout(() => emailRef.current?.focus(), 50);
        }
        return;
      }
      setTentativas(0);
      if (data.user) {
        const target = destinoSeguro(search.next) ?? (await resolvePostLoginPath(data.user.id));
        navigate({ to: target });
      }
    } catch {
      toastErro("Não conseguimos entrar agora. Tenta de novo, o seu e-mail continua preenchido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/painel` },
    });
    if (error) {
      setGoogleLoading(false);
      toastErro("O Google não respondeu agora. Tenta de novo ou entra com e-mail e senha.");
    }
  }

  async function handleResend() {
    if (!unverified || resendCooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: unverified });
    setResending(false);
    if (error) {
      toastErro("Não conseguimos reenviar agora. Tenta em alguns segundos.");
    } else {
      toastSucesso("Link reenviado. Confere seu e-mail (e o spam).");
      setResendCooldown(RESEND_COOLDOWN_SEGUNDOS);
    }
  }

  return (
    <AuthShell>
      <SerifHeadline size={30}>Boas-vindas de volta.</SerifHeadline>

      {search.motivo === "sessao-expirada" ? (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
          <p className="text-[14px] font-semibold text-[var(--ink)]">
            {ERROR_COPY["sessao-expirada"].title}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            {ERROR_COPY["sessao-expirada"].subtitle}
          </p>
        </div>
      ) : (
        search.next && (
          <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
            <p className="text-[14px] font-semibold text-[var(--ink)]">
              Isso fica logo depois de entrar.
            </p>
          </div>
        )
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <CosmicInput
          ref={emailRef}
          label="Seu e-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@seunegocio.com.br"
          icon={<Mail size={18} />}
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          reserveErrorSpace
          disabled={loading}
        />
        <div>
          <CosmicInput
            label="Sua senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={values.senha}
            onChange={(e) => set("senha", e.target.value)}
            onKeyUp={caps.onKeyUp}
            error={errors.senha}
            reserveErrorSpace
            disabled={loading}
          />
          <CapsLockHint ligado={caps.ligado} />
          <div className="-mt-1 text-right">
            <Link
              to="/auth/esqueci-senha"
              className="text-[13px] text-[var(--muted)] hover:text-[var(--ink-soft)]"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {loginErro && (
          <p className="text-center text-[13px] text-[var(--danger)]" role="alert">
            {loginErro}
          </p>
        )}

        {unverified && (
          <p className="text-center text-[14px] text-[var(--ink-soft)]">
            Confirma seu e-mail pra entrar.{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="text-[var(--secondary-text)] underline underline-offset-2 disabled:opacity-60"
            >
              {resending
                ? "Enviando..."
                : resendCooldown > 0
                  ? `Pode pedir outro em ${resendCooldown}s`
                  : "Reenviar o link"}
            </button>
          </p>
        )}

        <div className="mt-1">
          <AuthButton type="submit" fullWidth loading={loading} disabled={lockoutCooldown > 0}>
            {lockoutCooldown > 0 ? (
              `Tenta de novo em ${lockoutCooldown}s`
            ) : loading ? (
              "Entrando..."
            ) : (
              <>
                Entrar <span aria-hidden="true">→</span>
              </>
            )}
          </AuthButton>
        </div>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="mt-4 text-center text-[14px] text-[var(--muted)]">
        Primeira vez aqui?{" "}
        <Link to="/auth/cadastro" className="text-[var(--ink-soft)] underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
