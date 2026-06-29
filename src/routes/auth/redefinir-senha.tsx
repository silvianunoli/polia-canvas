import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, CaveatEyebrow, SerifHeadline } from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";
import { PoliaButton } from "@/components/ui/PoliaButton";

export const Route = createFileRoute("/auth/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha · Pólia" },
      { name: "description", content: "Defina uma nova senha para sua conta Pólia." },
    ],
  }),
  component: RedefinirSenhaPage,
});

type Strength = { score: 0 | 1 | 2 | 3; label: string; color: string };

function computeStrength(pw: string): Strength {
  const hasLen = pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  if (pw.length === 0) return { score: 0, label: "", color: "transparent" };
  if (!hasLen) return { score: 1, label: "Senha fraca", color: "#C96B3E" };
  if (hasLen && hasLetter && hasNumber && hasSpecial)
    return { score: 3, label: "Senha forte", color: "#2D6A4F" };
  if (hasLen && hasLetter && hasNumber) return { score: 2, label: "Senha boa", color: "#C8A96E" };
  return { score: 1, label: "Senha fraca", color: "#C96B3E" };
}

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecovery(true);
    });

    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && !hasRecovery) {
        toast.error("Esse link expirou. Solicite um novo.");
        navigate({ to: "/auth/esqueci-senha" });
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate({ to: "/auth/login" }), 2000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const strength = computeStrength(senha);
  const mismatch = confirma.length > 0 && confirma !== senha;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("Sua senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (mismatch) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      toast.error("Não consegui salvar agora. Tenta de novo em alguns segundos.");
      return;
    }
    toast.success("Senha atualizada. Pode entrar agora.");
    setDone(true);
    await supabase.auth.signOut();
  }

  if (done) {
    return (
      <AuthShell maxWidth={480}>
        <div className="flex flex-col items-center text-center">
          <Star size={40} color="#C8A96E" />
          <h2 className="mt-5 font-serif text-[28px] text-[#FDF8F5]">Senha atualizada.</h2>
          <p className="mt-2 caveat-decorativo text-[#E89770]">você está pronta.</p>
          <p className="mt-3 font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.50)" }}>
            Redirecionando para o login...
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth={480}>
      <CaveatEyebrow size={20}>quase lá.</CaveatEyebrow>
      <SerifHeadline size={44}>Cria uma nova senha.</SerifHeadline>
      <p
        className="mt-3 text-center font-sans text-[16px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Escolhe algo que você vai lembrar.
      </p>

      <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-4" noValidate>
        <div>
          <CosmicInput
            label="Nova senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={loading}
          />
          {senha.length > 0 && (
            <div className="mt-2">
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full transition-colors"
                    style={{
                      backgroundColor:
                        i < strength.score ? strength.color : "rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
              </div>
              <p className="mt-1.5 font-sans text-[12px]" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        <div>
          <CosmicInput
            label="Confirmar nova senha"
            name="confirma"
            type="password"
            autoComplete="new-password"
            placeholder="Repete a nova senha"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            disabled={loading}
            error={mismatch ? "As senhas não coincidem" : undefined}
          />
        </div>

        <div className="mt-1">
          <PoliaButton type="submit" fullWidth disabled={loading || mismatch}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </PoliaButton>
        </div>
      </form>
    </AuthShell>
  );
}
