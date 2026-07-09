import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mail, User } from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { verificarConvite, marcarConviteUsado } from "@/lib/convites.functions";
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
          toastErro("Tivemos um problema. Tenta de novo em alguns segundos.");
        }
        return;
      }
      // Best-effort: se falhar em marcar o convite como usado, a conta já foi criada
      // com sucesso mesmo assim — não bloqueamos o fluxo por causa disso.
      marcarConviteUsado({ data: { email } }).catch(() => {});
      if (!data.session) {
        navigate({ to: "/auth/verificacao", search: { email } });
      } else {
        navigate({ to: "/onboarding" });
      }
    } catch {
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
        <a href="#" className="text-[var(--ink-soft)] underline">
          Termos de Uso
        </a>{" "}
        e{" "}
        <a href="#" className="text-[var(--ink-soft)] underline">
          Política de Privacidade
        </a>
        .
      </p>
    </AuthShell>
  );
}
