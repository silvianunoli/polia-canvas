import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mail, User } from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { marcarLoginPendente, registrar } from "@/lib/founder-eventos";
import { gtagEvent } from "@/lib/gtag";
import {
  AuthShell,
  AuthButton,
  Divider,
  SerifHeadline,
  SubText,
} from "@/components/cosmic/AuthShell";
import { CosmicInput, PasswordRequirements, CapsLockHint } from "@/components/cosmic/CosmicInput";
import { GoogleButton } from "@/components/cosmic/GoogleButton";
import { AvisoSessaoAberta } from "@/components/cosmic/SairDaConta";
import { senhaCumpreRequisitos } from "@/lib/senha";
import { emailJaTemConta } from "@/lib/signup";
import { ehErroDeCaptcha, MSG_CAPTCHA, tokenCaptcha } from "@/lib/captcha";
import { TurnstileCampo, useCaptcha } from "@/components/TurnstileCampo";
import { useCaptchaPronto } from "@/hooks/useCaptchaPronto";
import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import {
  campoDeBusca,
  guardarOrigemParaOAuth,
  lerOrigemCampanha,
  temOrigemCampanha,
} from "@/lib/origemCampanha";

// origem e utm_* chegam das landings de campanha (/landing-a, /landing-b). Aqui
// só entram como texto opcional e tolerante (o router faz JSON.parse da URL, e
// ?utm_content=123 viraria number e derrubaria a rota); a allowlist de verdade
// é lerOrigemCampanha. E-mail inválido na URL só deixa de pré-preencher.
const searchSchema = z.object({
  email: z.string().email().optional().catch(undefined),
  origem: campoDeBusca,
  utm_source: campoDeBusca,
  utm_medium: campoDeBusca,
  utm_campaign: campoDeBusca,
  utm_content: campoDeBusca,
  utm_term: campoDeBusca,
});

export const Route = createFileRoute("/auth/cadastro")({
  // Cadastro aberto ao público (05/10/2026). ?email= ainda pré-preenche o campo
  // pra quem chega por link de convite, mas não é mais exigido.
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Criar conta · Pólia" },
      {
        name: "description",
        content: "A conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      { property: "og:title", content: "Criar conta · Pólia" },
      {
        property: "og:description",
        content: "A conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { email: emailConvite, ...buscaCampanha } = Route.useSearch();
  const origemCampanha = lerOrigemCampanha(buscaCampanha);
  const [values, setValues] = useState({ nome: "", email: emailConvite ?? "", senha: "" });
  const [errors, setErrors] = useState<{ nome?: string; email?: ReactNode }>({});
  const [senhaInvalida, setSenhaInvalida] = useState(false);
  const [loading, setLoading] = useState(false);
  const captcha = useCaptcha();
  // Botão só libera com o token do Turnstile (ou depois da espera máxima).
  const captchaPronto = useCaptchaPronto(captcha);
  const [googleLoading, setGoogleLoading] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const caps = useCapsLockWarning();

  function set<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key as "nome" | "email"]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === "senha") setSenhaInvalida(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nome = values.nome.trim();
    const email = values.email.trim();

    const fieldErrors: typeof errors = {};
    if (nome.length < 2) fieldErrors.nome = "Falta o seu nome.";
    if (!email) fieldErrors.email = "Falta o seu e-mail.";
    else if (!z.string().email().safeParse(email).success) {
      fieldErrors.email = "E-mail inválido. Confere o @.";
    }
    const senhaOk = senhaCumpreRequisitos(values.senha);
    if (!senhaOk) setSenhaInvalida(true);
    if (Object.keys(fieldErrors).length || !senhaOk) {
      setErrors(fieldErrors);
      // Foca sempre o primeiro campo com erro, na ordem visual: nome → e-mail → senha.
      if (fieldErrors.nome) nomeRef.current?.focus();
      else if (fieldErrors.email) emailRef.current?.focus();
      else if (!senhaOk) senhaRef.current?.focus();
      return;
    }

    setErrors({});
    setSenhaInvalida(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.senha,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          captchaToken: tokenCaptcha(captcha.token),
          // origem_campanha só entra quando veio de landing com tag válida.
          data: temOrigemCampanha(origemCampanha)
            ? { full_name: nome, origem_campanha: origemCampanha }
            : { full_name: nome },
        },
      });
      if (emailJaTemConta(data, error)) {
        track("cadastro_falhou", { motivo: "email_ja_cadastrado" });
        setErrors({
          email: (
            <>
              Esse e-mail já tem conta.{" "}
              <Link
                to="/auth/login"
                search={{ email }}
                className="text-[var(--danger)] underline underline-offset-2"
              >
                Entrar
              </Link>
              . Se a conta foi criada com o Google, é só entrar com o Google.
            </>
          ),
        });
        emailRef.current?.focus();
        return;
      }
      if (ehErroDeCaptcha(error)) {
        track("cadastro_falhou", { motivo: "captcha" });
        toastErro(MSG_CAPTCHA);
        return;
      }
      if (error) {
        track("cadastro_falhou", { motivo: "erro_signup" });
        toastErro(
          "A Pólia não conseguiu criar a conta agora. Tenta de novo, o que você preencheu continua aqui.",
        );
        return;
      }
      // O convite é marcado como usado no servidor (trigger AFTER INSERT em
      // auth.users), não daqui — ver migração 20260709170100.
      track("cadastro_concluido", {
        via_convite: !!emailConvite,
        precisa_verificacao: !data.session,
        ...origemCampanha,
      });
      void registrar("signup", {
        feature: "conta",
        propriedades: { metodo: "email", via_convite: !!emailConvite, ...origemCampanha },
      });
      // Conversão principal do Google Ads (FUN-09), importada do GA4.
      gtagEvent("sign_up", { method: "email" });
      if (!data.session) {
        navigate({ to: "/auth/verificacao", search: { email } });
      } else {
        navigate({ to: "/onboarding" });
      }
    } catch {
      track("cadastro_falhou", { motivo: "excecao_client" });
      toastErro(
        "A Pólia não conseguiu criar a conta agora. Tenta de novo, o que você preencheu continua aqui.",
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
    // O OAuth sai do site e volta em /painel: a origem espera no sessionStorage
    // da aba e é gravada na conta pelo _authenticated (gravarOrigemDoOAuth).
    guardarOrigemParaOAuth(origemCampanha);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/painel` },
    });
    if (error) {
      setGoogleLoading(false);
      toastErro("O Google não respondeu agora. Tenta de novo ou cria a conta com e-mail e senha.");
    }
  }

  return (
    <AuthShell>
      <SerifHeadline size={28}>Vamos começar.</SerifHeadline>
      <SubText>Sua conta em menos de um minuto.</SubText>
      <AvisoSessaoAberta />

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <CosmicInput
          ref={nomeRef}
          label="Seu nome"
          name="nome"
          autoComplete="name"
          placeholder="como prefere ser chamada"
          icon={<User size={18} />}
          value={values.nome}
          onChange={(e) => set("nome", e.target.value)}
          error={errors.nome}
          reserveErrorSpace
          disabled={loading}
        />
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
            label="Crie uma senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            placeholder="crie uma senha segura"
            value={values.senha}
            onChange={(e) => set("senha", e.target.value)}
            onKeyUp={caps.onKeyUp}
            invalid={senhaInvalida}
            aria-describedby="senha-requisitos"
            disabled={loading}
          />
          <CapsLockHint ligado={caps.ligado} />
          <PasswordRequirements id="senha-requisitos" password={values.senha} />
        </div>

        <TurnstileCampo captcha={captcha} />
        <div className="mt-1">
          <AuthButton type="submit" fullWidth loading={loading} disabled={!captchaPronto}>
            {!captchaPronto ? (
              "Verificando que não é um robô..."
            ) : loading ? (
              "Criando..."
            ) : (
              <>
                Criar conta <span aria-hidden="true">→</span>
              </>
            )}
          </AuthButton>
        </div>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="mt-4 text-center text-[14px] text-[var(--muted)]">
        Já tem conta?{" "}
        <Link to="/auth/login" className="text-[var(--ink-soft)] underline underline-offset-2">
          Entrar
        </Link>
      </p>
      <p className="mt-2 text-center text-[12px] text-[var(--muted)]">
        Ao criar a conta, você concorda com os nossos{" "}
        <Link to="/termos" className="text-[var(--ink-soft)] underline">
          Termos de Uso
        </Link>{" "}
        e{" "}
        <Link to="/privacidade" className="text-[var(--ink-soft)] underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </AuthShell>
  );
}
