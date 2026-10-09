import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { marcarLoginPendente, registrar } from "@/lib/founder-eventos";
import { Mail, Check } from "lucide-react";
import { z } from "zod";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthButton, Divider } from "@/components/cosmic/AuthShell";
import { AuthSplitShell, AuthTabs, type ModoAuth } from "@/components/cosmic/AuthSplitShell";
import { CosmicInput, CapsLockHint } from "@/components/cosmic/CosmicInput";
import { GoogleButton } from "@/components/cosmic/GoogleButton";
import { resolvePostLoginPath } from "@/hooks/useSupabaseSession";
import { useRecuperarSenha } from "@/hooks/useRecuperarSenha";
import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import { ERROR_COPY } from "@/lib/errorCopy";
import { ehErroDeCaptcha, MSG_CAPTCHA, tokenCaptcha } from "@/lib/captcha";
import { classificarErroLogin, MSG_LOGIN_LIMITE, MSG_LOGIN_REDE } from "@/lib/signup";
import { TurnstileCampo, useCaptcha } from "@/components/TurnstileCampo";
import { useCaptchaPronto } from "@/hooks/useCaptchaPronto";
import { AvisoSessaoAberta } from "@/components/cosmic/SairDaConta";
import {
  gravarBloqueioLogin,
  lerBloqueioLogin,
  limparBloqueioLogin,
  segundosRestantes,
  somarFalha,
} from "@/lib/bloqueioLogin";

const searchSchema = z.object({
  email: z.string().email().optional(),
  next: z.string().optional(),
  // entrada-cancelada: voltou do Google sem concluir (desistiu na tela de
  // escolher conta). Vem do __root, que lê o erro access_denied da URL.
  motivo: z.enum(["sessao-expirada", "entrada-cancelada"]).optional(),
});

// Só aceita destino relativo (começa com "/") — bloqueia redirect pra domínio
// externo caso alguém manipule o parâmetro da URL.
function destinoSeguro(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

// Tentativas e bloqueio de 60 s: src/lib/bloqueioLogin.ts (guardados no
// navegador, pra um F5 não zerar o bloqueio; QA-10).
const RESEND_COOLDOWN_SEGUNDOS = 60;

export const Route = createFileRoute("/auth/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
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
  const captcha = useCaptcha();
  // "Reenviar o link" logo depois do erro saía com o token já gasto.
  const captchaPronto = useCaptchaPronto(captcha);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tentativas, setTentativas] = useState(0);
  const [lockoutCooldown, setLockoutCooldown] = useState(0);
  const caps = useCapsLockWarning();
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<ModoAuth>("entrar");
  const recuperar = useRecuperarSenha();

  function selecionarModo(novo: ModoAuth) {
    recuperar.reset();
    setModo(novo);
  }

  useEffect(() => {
    if (search.email) setValues((s) => ({ ...s, email: search.email! }));
  }, [search.email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Retoma o bloqueio que estava valendo antes do F5.
  useEffect(() => {
    const guardado = lerBloqueioLogin();
    setTentativas(guardado.tentativas);
    const restante = segundosRestantes(guardado, Date.now());
    if (restante > 0) {
      setLockoutCooldown(restante);
      setLoginErro("Muitas tentativas. Vale esperar um minuto e tentar de novo.");
    }
  }, []);

  useEffect(() => {
    if (lockoutCooldown <= 0) return;
    const t = setTimeout(() => {
      setLockoutCooldown((c) => c - 1);
      if (lockoutCooldown - 1 <= 0) {
        setTentativas(0);
        limparBloqueioLogin();
      }
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
      // Foca o primeiro campo inválido, na ordem visual (e-mail antes de senha).
      if (emailErro) emailRef.current?.focus();
      else senhaRef.current?.focus();
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
        options: { captchaToken: tokenCaptcha(captcha.token) },
      });
      // Captcha recusado não é senha errada: não conta tentativa (FUN-03).
      if (ehErroDeCaptcha(error)) {
        setLoginErro(MSG_CAPTCHA);
        return;
      }
      if (error) {
        const motivo = classificarErroLogin(error);
        // Rede caída e limite do servidor também não são senha errada: antes
        // viravam "não conferem" e contavam pro bloqueio de 60s.
        if (motivo === "rede") {
          setLoginErro(MSG_LOGIN_REDE);
        } else if (motivo === "limite") {
          setLoginErro(MSG_LOGIN_LIMITE);
        } else if (motivo === "email_nao_confirmado") {
          setUnverified(values.email.trim());
        } else {
          const agora = Date.now();
          const proximo = somarFalha({ tentativas, ate: null }, agora);
          gravarBloqueioLogin(proximo);
          setTentativas(proximo.tentativas);
          if (proximo.ate !== null) {
            setLockoutCooldown(segundosRestantes(proximo, agora));
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
      limparBloqueioLogin();
      if (data.user) {
        void registrar("login", { feature: "conta", propriedades: { metodo: "email" } });
        const target = destinoSeguro(search.next) ?? (await resolvePostLoginPath(data.user.id));
        navigate({ to: target });
      }
    } catch {
      toastErro(
        "A Pólia não conseguiu entrar agora. Tenta de novo, o seu e-mail continua preenchido.",
      );
    } finally {
      setLoading(false);
      // Token do Turnstile é de uso único: cada tentativa pede um novo.
      captcha.resetar();
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    marcarLoginPendente("google");
    // Mesmo destino calculado do login por e-mail (search.next validado por
    // destinoSeguro). Sem next, cai em /painel — que já redireciona sozinho
    // pro /onboarding via guard de _authenticated quando falta concluir.
    const destino = destinoSeguro(search.next) ?? "/painel";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${destino}` },
    });
    if (error) {
      setGoogleLoading(false);
      toastErro("O Google não respondeu agora. Tenta de novo ou entra com e-mail e senha.");
    }
  }

  async function handleResend() {
    if (!unverified || resendCooldown > 0 || !captchaPronto) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unverified,
      options: { captchaToken: tokenCaptcha(captcha.token) },
    });
    setResending(false);
    captcha.resetar();
    if (ehErroDeCaptcha(error)) {
      toastErro(MSG_CAPTCHA);
    } else if (error) {
      toastErro("A Pólia não conseguiu reenviar agora. Tenta em alguns segundos.");
    } else {
      toastSucesso("Link reenviado. Confere seu e-mail (e o spam).");
      setResendCooldown(RESEND_COOLDOWN_SEGUNDOS);
    }
  }

  return (
    <AuthSplitShell
      headline="Sua marca no centro, com os números no lugar."
      subtext="A Pólia liga o planejamento da marca a preço, lucro e meta, pra cada decisão ter chão."
      rodape={["Marca", "Números", "Decisão"]}
    >
      <AuthTabs modo={modo} onModoChange={selecionarModo} />

      {modo === "entrar" ? (
        <>
          <h2 className="text-[clamp(22px,3vw,28px)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">
            Que bom ter você de volta.
          </h2>
          <p className="mt-1.5 text-[14px] text-[var(--muted)]">
            Entra com o e-mail e a senha da sua conta Pólia.
          </p>

          <AvisoSessaoAberta />

          {search.motivo === "entrada-cancelada" ? (
            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[14px] font-semibold text-[var(--ink)]">
                A entrada com o Google não terminou.
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                Dá pra tentar de novo com o Google ou entrar com e-mail e senha.
              </p>
            </div>
          ) : search.motivo === "sessao-expirada" ? (
            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[14px] font-semibold text-[var(--ink)]">
                {ERROR_COPY["sessao-expirada"].title}
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                {ERROR_COPY["sessao-expirada"].subtitle}
              </p>
            </div>
          ) : (
            search.next && (
              <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <p className="text-[14px] font-semibold text-[var(--ink)]">
                  Isso fica logo depois de entrar.
                </p>
              </div>
            )
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-[15px]" noValidate>
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
                ref={senhaRef}
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
            </div>

            {loginErro && (
              <p className="text-[13px] text-[var(--danger)]" role="alert">
                {loginErro}
              </p>
            )}

            {unverified && (
              <p className="text-[14px] text-[var(--ink-soft)]">
                Confirma seu e-mail pra entrar.{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0 || !captchaPronto}
                  className="inline-flex min-h-11 items-center text-[var(--secondary-text)] underline underline-offset-2 disabled:opacity-60"
                >
                  {resending
                    ? "Enviando..."
                    : resendCooldown > 0
                      ? `Pode pedir outro em ${resendCooldown}s`
                      : !captchaPronto
                        ? "Conferindo..."
                        : "Reenviar o link"}
                </button>
              </p>
            )}

            <TurnstileCampo captcha={captcha} />
            {/* Sem esperar o token, o clique saía sem captcha e o Supabase
                recusava (captcha_failed, visto nos logs do teste de 09/10). */}
            <AuthButton
              type="submit"
              fullWidth
              loading={loading}
              disabled={lockoutCooldown > 0 || !captchaPronto}
            >
              {lockoutCooldown > 0 ? (
                `Tenta de novo em ${lockoutCooldown}s`
              ) : !captchaPronto ? (
                "Verificando que não é um robô..."
              ) : loading ? (
                "Entrando..."
              ) : (
                <>
                  Entrar <span aria-hidden="true">→</span>
                </>
              )}
            </AuthButton>
          </form>

          <Divider />
          <GoogleButton onClick={handleGoogle} loading={googleLoading} label="Entrar com Google" />

          <p className="mt-4 text-center text-[14px] text-[var(--muted)]">
            Primeira vez aqui?{" "}
            <Link
              to="/auth/cadastro"
              className="text-[var(--ink-soft)] underline underline-offset-2"
            >
              Criar conta
            </Link>
          </p>
        </>
      ) : !recuperar.sent ? (
        <>
          <h2 className="text-[clamp(22px,3vw,28px)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">
            Vamos recuperar.
          </h2>
          <p className="mt-1.5 text-[14px] text-[var(--muted)]">
            É só informar o e-mail da conta que a Pólia manda o link.
          </p>

          <form
            onSubmit={recuperar.handleSubmit}
            className="mt-5 flex flex-col gap-[15px]"
            noValidate
          >
            <CosmicInput
              label="Seu e-mail"
              name="email-recuperar"
              type="email"
              autoComplete="email"
              placeholder="voce@seunegocio.com.br"
              icon={<Mail size={18} />}
              value={recuperar.email}
              onChange={(e) => {
                recuperar.setEmail(e.target.value);
                if (recuperar.error) recuperar.setError(undefined);
              }}
              error={recuperar.error}
              reserveErrorSpace
              disabled={recuperar.loading}
            />
            <TurnstileCampo captcha={recuperar.captcha} />
            <AuthButton
              type="submit"
              fullWidth
              loading={recuperar.loading}
              disabled={!recuperar.captchaPronto}
            >
              {!recuperar.captchaPronto ? (
                "Verificando que não é um robô..."
              ) : recuperar.loading ? (
                "Enviando..."
              ) : (
                <>
                  Enviar link <span aria-hidden="true">→</span>
                </>
              )}
            </AuthButton>
          </form>
        </>
      ) : (
        <div className="flex flex-col items-start">
          <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary-light)] text-[var(--secondary-ink)]">
            <Check size={22} aria-hidden="true" />
          </div>
          <h2 className="font-cabinet mt-3 text-[22px] leading-snug text-[var(--ink)]">
            Se esse e-mail tiver conta,
            <br />a Pólia manda o link.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Confira a caixa de entrada (e o spam). O link vale por pouco tempo.
          </p>
          <button
            type="button"
            onClick={recuperar.handleResend}
            disabled={recuperar.cooldown > 0 || recuperar.loading || !recuperar.captchaPronto}
            className="mt-5 inline-flex min-h-11 items-center text-[13.5px] text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
          >
            {recuperar.cooldown > 0
              ? `Pode pedir outro em ${recuperar.cooldown}s`
              : recuperar.loading
                ? "Enviando..."
                : !recuperar.captchaPronto
                  ? "Conferindo..."
                  : "Não chegou? Pedir de novo"}
          </button>
          <TurnstileCampo captcha={recuperar.captcha} />
          <button
            type="button"
            onClick={() => selecionarModo("entrar")}
            className="mt-6 text-[14px] text-[var(--muted)]"
          >
            Voltar pra entrada
          </button>
        </div>
      )}
    </AuthSplitShell>
  );
}
