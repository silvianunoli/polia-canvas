import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mail, User } from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { verificarConvite } from "@/lib/convites.functions";
import { track } from "@/lib/analytics";
import {
  AuthShell,
  AuthButton,
  Divider,
  SerifHeadline,
  SubText,
} from "@/components/cosmic/AuthShell";
import {
  CosmicInput,
  PasswordRequirements,
  senhaCumpreRequisitos,
  useCapsLockWarning,
  CapsLockHint,
} from "@/components/cosmic/CosmicInput";
import { GoogleButton } from "@/components/cosmic/GoogleButton";

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/auth/cadastro")({
  validateSearch: (search) => searchSchema.parse(search),
  // Pré-lançamento: autocadastro público fica fechado. Quem chega com
  // ?email= veio de um link de convite (allowlist) — deixa passar, a
  // checagem de convite de verdade acontece no submit (verificarConvite).
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined" || search.email) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/lista-de-espera" });
  },
  head: () => ({
    meta: [
      { title: "Criar conta · Pólia" },
      {
        name: "description",
        content:
          "A conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      { property: "og:title", content: "Criar conta · Pólia" },
      {
        property: "og:description",
        content:
          "A conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { email: emailConvite } = Route.useSearch();
  const [values, setValues] = useState({ nome: "", email: emailConvite ?? "", senha: "" });
  const [errors, setErrors] = useState<{ nome?: string; email?: ReactNode }>({});
  const [senhaInvalida, setSenhaInvalida] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      if (!senhaOk) senhaRef.current?.focus();
      return;
    }

    setErrors({});
    setSenhaInvalida(false);
    setLoading(true);
    try {
      const { permitido } = await verificarConvite({ data: { email } });
      if (!permitido) {
        track("cadastro_falhou", { motivo: "sem_convite" });
        setErrors({
          email: (
            <>
              Esse e-mail ainda não tem convite pra Pólia.{" "}
              <Link
                to="/lista-de-espera"
                className="text-[var(--danger)] underline underline-offset-2"
              >
                Entra na lista de espera
              </Link>
            </>
          ),
        });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.senha,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { full_name: nome },
        },
      });
      if (error) {
        if (/already/i.test(error.message) || /registered/i.test(error.message)) {
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
              </>
            ),
          });
        } else {
          track("cadastro_falhou", { motivo: "erro_signup" });
          toastErro("Tivemos um problema. Tenta de novo em alguns segundos.");
        }
        return;
      }
      // O convite é marcado como usado no servidor (trigger AFTER INSERT em
      // auth.users), não daqui — ver migração 20260709170100.
      track("cadastro_concluido", { via_convite: !!emailConvite, precisa_verificacao: !data.session });
      if (!data.session) {
        navigate({ to: "/auth/verificacao", search: { email } });
      } else {
        navigate({ to: "/onboarding" });
      }
    } catch {
      track("cadastro_falhou", { motivo: "excecao_client" });
      toastErro("Tivemos um problema. Tenta de novo em alguns segundos.");
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
      toastErro("Não deu pra entrar por aí. Tenta de novo ou usa o e-mail.");
    }
  }

  return (
    <AuthShell>
      <SerifHeadline size={28}>Tudo começa pelo comecinho.</SerifHeadline>
      <SubText>Sua conta em menos de um minuto.</SubText>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <CosmicInput
          label="Seu nome"
          name="nome"
          autoComplete="name"
          placeholder="como prefere ser chamada"
          icon={<User size={18} />}
          value={values.nome}
          onChange={(e) => set("nome", e.target.value)}
          error={errors.nome}
          disabled={loading}
        />
        <CosmicInput
          label="Seu e-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@seunegocio.com.br"
          icon={<Mail size={18} />}
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
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
            disabled={loading}
          />
          <CapsLockHint ligado={caps.ligado} />
          <PasswordRequirements password={values.senha} />
        </div>

        <div className="mt-1">
          <AuthButton type="submit" fullWidth loading={loading}>
            {loading ? "Criando..." : "Criar conta →"}
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
        Ao criar a conta, a usuária concorda com os nossos{" "}
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
