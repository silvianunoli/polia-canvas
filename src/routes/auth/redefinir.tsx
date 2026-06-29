import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  CaveatEyebrow,
  SerifHeadline,
} from "@/components/cosmic/AuthShell";
import { CosmicInput, PasswordStrength } from "@/components/cosmic/CosmicInput";
import { CosmicButton } from "@/components/cosmic/CosmicButton";

export const Route = createFileRoute("/auth/redefinir")({
  head: () => ({
    meta: [
      { title: "Nova senha · Pólia" },
      { name: "description", content: "Defina uma nova senha para sua conta Pólia." },
      { property: "og:title", content: "Nova senha · Pólia" },
      { property: "og:description", content: "Defina uma nova senha para sua conta Pólia." },
    ],
  }),
  component: RedefinirPage,
});

const schema = z
  .object({
    senha: z
      .string()
      .min(8, "Sua senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um número.")
      .refine(
        (v) => /[A-Z]/.test(v) && /\d/.test(v),
        "Sua senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um número.",
      ),
    confirma: z.string(),
  })
  .refine((d) => d.senha === d.confirma, {
    message: "As senhas não são iguais. Confere de novo.",
    path: ["confirma"],
  });

function RedefinirPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ senha: "", confirma: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  // Supabase parses recovery hash automatically on load and emits PASSWORD_RECOVERY.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setTokenError(false);
    });
    // After a short delay, check if there's a session from recovery
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const hasHash = typeof window !== "undefined" && window.location.hash.includes("error");
      if (!data.session && hasHash) setTokenError(true);
    }, 600);
    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

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
    const { error } = await supabase.auth.updateUser({ password: parsed.data.senha });
    setLoading(false);
    if (error) {
      if (/expired|invalid|token/i.test(error.message)) {
        setTokenError(true);
      } else {
        toast.error("Não consegui salvar agora. Tenta de novo em alguns segundos.");
      }
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
  }

  const senhasIguais =
    values.confirma.length > 0 && values.senha === values.confirma && !errors.confirma;

  if (tokenError) {
    return (
      <AuthShell maxWidth={420}>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#C96B3E] bg-[rgba(201,107,62,0.15)]">
            <AlertTriangle size={28} color="#C96B3E" />
          </div>
          <h2 className="mt-6 font-serif text-[36px] text-[#FDF8F5]">Link expirado.</h2>
          <p className="mt-3 font-sans text-[16px] text-[#D8D2CC]/80">
            Links de redefinição têm validade de 1 hora. Pede um novo.
          </p>
          <div className="mt-7 w-full">
            <CosmicButton onClick={() => navigate({ to: "/auth/esqueci" })}>
              Pedir novo link →
            </CosmicButton>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell maxWidth={420}>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#2D6A4F] bg-[rgba(45,106,79,0.2)]">
            <Check size={28} color="#2D6A4F" />
          </div>
          <h2 className="mt-6 font-serif text-[36px] text-[#FDF8F5]">Senha atualizada.</h2>
          <p className="mt-3 font-sans text-[16px] text-[#D8D2CC]/80">
            Agora é só entrar com a nova senha.
          </p>
          <div className="mt-7 w-full">
            <CosmicButton onClick={() => navigate({ to: "/auth/login" })}>
              Ir para o login →
            </CosmicButton>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <CaveatEyebrow size={26}>Quase lá.</CaveatEyebrow>
      <SerifHeadline size={48}>Cria uma senha nova.</SerifHeadline>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <div>
          <CosmicInput
            label="Nova senha"
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
        <CosmicInput
          label="Confirma a senha"
          name="confirma"
          type="password"
          autoComplete="new-password"
          placeholder="Repete a senha nova"
          value={values.confirma}
          onChange={(e) => set("confirma", e.target.value)}
          error={errors.confirma}
          disabled={loading}
          rightSlot={
            senhasIguais ? <Check size={18} className="text-[#2D6A4F]" /> : undefined
          }
        />

        <div className="mt-2">
          <CosmicButton type="submit" loading={loading}>
            {loading ? "Salvando..." : "Salvar nova senha →"}
          </CosmicButton>
        </div>
      </form>

      <p className="mt-6 text-center font-sans text-[14px] text-[#D8D2CC]/70">
        Lembrei a senha.{" "}
        <Link to="/auth/login" className="text-[#C96B3E] underline underline-offset-2">
          Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
