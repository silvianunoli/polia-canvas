import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, User } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  Divider,
  SerifHeadline,
} from "@/components/cosmic/AuthShell";
import { CosmicInput, PasswordStrength, passwordScore } from "@/components/cosmic/CosmicInput";
import { CosmicButton } from "@/components/cosmic/CosmicButton";
import { GoogleButton } from "@/components/cosmic/GoogleButton";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta · Pólia" },
      {
        name: "description",
        content: "Crie sua conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      { property: "og:title", content: "Criar conta · Pólia" },
      {
        property: "og:description",
        content: "Crie sua conta na Pólia, a plataforma guiada para mulheres empreendedoras brasileiras.",
      },
    ],
  }),
  component: CadastroPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Coloca pelo menos 2 letras no seu nome.").max(120),
  email: z.string().trim().email("Esse e-mail não parece certo. Confere o formato.").max(255),
  senha: z
    .string()
    .min(8, "Sua senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um número.")
    .refine(
      (v) => /[A-Z]/.test(v) && /\d/.test(v),
      "Sua senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um número.",
    ),
});

function CadastroPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ nome: "", email: "", senha: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function set<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof values;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.senha,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { full_name: parsed.data.nome },
        },
      });
      if (error) {
        if (/already/i.test(error.message) || /registered/i.test(error.message)) {
          setErrors({ email: "Esse e-mail já tem uma conta aqui. Quer entrar?" });
        } else {
          toast.error("Tivemos um problema. Tenta de novo em alguns segundos.");
        }
        return;
      }
      if (!data.session) {
        navigate({ to: "/auth/verificacao", search: { email: parsed.data.email } });
      } else {
        navigate({ to: "/onboarding" });
      }
    } catch {
      toast.error("Tivemos um problema. Tenta de novo em alguns segundos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error("Não consegui conectar com o Google agora. Tenta de novo.");
    }
  }

  return (
    <AuthShell>
      <CaveatEyebrow>Oi. Vamos montar o seu começo.</CaveatEyebrow>
      <SerifHeadline>Cria a sua conta.</SerifHeadline>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <CosmicInput
          label="Como você se chama?"
          name="nome"
          autoComplete="name"
          placeholder="Ana"
          icon={<User size={18} />}
          value={values.nome}
          onChange={(e) => set("nome", e.target.value)}
          error={errors.nome}
          disabled={loading}
        />
        <CosmicInput
          label="Qual é o seu e-mail?"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ana@seunegocio.com.br"
          icon={<Mail size={18} />}
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          disabled={loading}
        />
        <div>
          <CosmicInput
            label="Cria uma senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={values.senha}
            onChange={(e) => set("senha", e.target.value)}
            error={errors.senha}
            disabled={loading}
          />
          {values.senha.length > 0 && <PasswordStrength password={values.senha} />}
        </div>

        <div className="mt-2">
          <CosmicButton type="submit" loading={loading}>
            {loading ? "Criando..." : "Criar minha conta →"}
          </CosmicButton>
        </div>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="mt-5 text-center font-sans text-[14px] text-[#D8D2CC]/70">
        Já tem conta?{" "}
        <Link to="/auth/login" className="text-[#C96B3E] underline underline-offset-2">
          Entrar
        </Link>
      </p>
      <p className="mt-3 text-center font-sans text-[12px] text-[#D8D2CC]/50">
        Ao criar sua conta, você concorda com os nossos{" "}
        <a href="#" className="text-[#C96B3E]">
          Termos de Uso
        </a>{" "}
        e{" "}
        <a href="#" className="text-[#C96B3E]">
          Política de Privacidade
        </a>
        .
      </p>

      <span className="sr-only">{passwordScore(values.senha)}</span>
    </AuthShell>
  );
}
