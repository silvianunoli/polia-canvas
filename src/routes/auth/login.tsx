import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  Divider,
  SerifHeadline,
} from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";
import { PoliaButton } from "@/components/ui/PoliaButton";
import { Loader2 } from "lucide-react";
import { GoogleButton } from "@/components/cosmic/GoogleButton";
import { resolvePostLoginPath } from "@/hooks/useSupabaseSession";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Pólia" },
      { name: "description", content: "Entre na sua conta Pólia para continuar de onde parou." },
      { property: "og:title", content: "Entrar — Pólia" },
      {
        property: "og:description",
        content: "Entre na sua conta Pólia para continuar de onde parou.",
      },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Esse e-mail não parece certo. Confere o formato.").max(255),
  senha: z.string().min(1, "Coloca sua senha."),
});

function LoginPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", senha: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);

  function set<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setGeneralError(null);
    setUnverified(null);
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.senha,
      });
      if (error) {
        if (/confirm/i.test(error.message) || /verified/i.test(error.message)) {
          setUnverified(parsed.data.email);
        } else {
          setGeneralError("E-mail ou senha incorretos. Tenta de novo.");
        }
        return;
      }
      if (data.user) {
        const target = await resolvePostLoginPath(data.user.id);
        navigate({ to: target });
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

  async function handleResend() {
    if (!unverified) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: unverified });
    setResending(false);
    if (error) toast.error("Não consegui reenviar agora. Tenta em alguns segundos.");
    else toast.success("Enviei um novo link de confirmação para o seu e-mail.");
  }

  return (
    <AuthShell>
      <CaveatEyebrow>Que bom ter você de volta.</CaveatEyebrow>
      <SerifHeadline>Boas-vindas de volta.</SerifHeadline>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
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
        <CosmicInput
          label="Sua senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={values.senha}
          onChange={(e) => set("senha", e.target.value)}
          error={errors.senha}
          disabled={loading}
          hint={
            <Link
              to="/auth/esqueci"
              className="font-sans text-[13px] text-[#C96B3E] hover:underline"
            >
              Esqueci minha senha
            </Link>
          }
        />

        {generalError && (
          <p className="text-center font-sans text-[14px] text-[#E53E3E]">{generalError}</p>
        )}
        {unverified && (
          <p className="text-center font-sans text-[14px] text-[#D8D2CC]">
            Precisamos confirmar seu e-mail antes.{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[#C96B3E] underline underline-offset-2 disabled:opacity-60"
            >
              {resending ? "Enviando..." : "Reenviar confirmação"}
            </button>
          </p>
        )}

        <div className="mt-2">
          <PoliaButton type="submit" fullWidth disabled={loading}>
            {loading && <Loader2 size={20} className="animate-spin" />}
            {loading ? "Entrando..." : "Entrar →"}
          </PoliaButton>
        </div>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="mt-6 text-center font-sans text-[14px] text-[#D8D2CC]/70">
        Primeira vez aqui?{" "}
        <Link to="/auth/cadastro" className="text-[#C96B3E] underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
