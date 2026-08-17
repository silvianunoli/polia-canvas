import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthButton, SerifHeadline } from "@/components/cosmic/AuthShell";
import {
  CosmicInput,
  useCapsLockWarning,
  CapsLockHint,
  senhaCumpreRequisitos,
} from "@/components/cosmic/CosmicInput";
import { resolvePostLoginPath } from "@/hooks/useSupabaseSession";

export const Route = createFileRoute("/auth/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha · Pólia" },
      { name: "description", content: "Nova senha para a conta Pólia." },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [confirmaErro, setConfirmaErro] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const caps = useCapsLockWarning();

  useEffect(() => {
    // Detecção rápida: se o Supabase já voltou com o erro no hash da URL
    // (link vencido ou já usado), não precisa esperar o timeout de baixo.
    const hash = window.location.hash;
    if (hash.includes("otp_expired") || hash.includes("access_denied")) {
      navigate({ to: "/auth/link-expirado", search: { tipo: "redefinicao" } });
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecovery(true);
    });

    // Fallback: se depois de um tempo razoável ainda não chegou uma sessão de
    // recovery nem um erro explícito no hash, trata como vencido também.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && !hasRecovery) {
        navigate({ to: "/auth/link-expirado", search: { tipo: "redefinicao" } });
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validação só no submit (não a cada tecla) — pessoa cansada não precisa
  // de feedback ansioso enquanto ainda está digitando.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    setConfirmaErro(undefined);
    // Mesma régua do cadastro (senhaCumpreRequisitos): a regra é dita antes,
    // não descoberta errando.
    if (!senhaCumpreRequisitos(senha)) {
      setErro("A senha precisa de 8 caracteres, com pelo menos 1 número e 1 letra maiúscula.");
      return;
    }
    if (senha !== confirma) {
      setConfirmaErro("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setLoading(false);
      toastErro("Não conseguimos salvar agora. Tenta de novo em alguns segundos.");
      return;
    }
    setSalvo(true);
    const { data } = await supabase.auth.getUser();
    const target = data.user ? await resolvePostLoginPath(data.user.id) : "/painel";
    window.setTimeout(() => navigate({ to: target }), 900);
  }

  return (
    <AuthShell maxWidth={420}>
      <SerifHeadline size={26}>Hora de escolher a nova senha.</SerifHeadline>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <div>
          <CosmicInput
            label="Nova senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            placeholder="8 caracteres, 1 número, 1 maiúscula"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              if (erro) setErro(undefined);
            }}
            onKeyUp={caps.onKeyUp}
            error={erro}
            reserveErrorSpace
            disabled={loading || salvo}
          />
          <CapsLockHint ligado={caps.ligado} />
        </div>

        <CosmicInput
          label="Confirme a nova senha"
          name="confirma"
          type="password"
          autoComplete="new-password"
          placeholder="a mesma senha"
          value={confirma}
          onChange={(e) => {
            setConfirma(e.target.value);
            if (confirmaErro) setConfirmaErro(undefined);
          }}
          error={confirmaErro}
          reserveErrorSpace
          disabled={loading || salvo}
        />

        {salvo && (
          <p className="text-center text-[14px] text-[var(--ink-soft)]">
            Senha trocada. Levando pro seu painel...
          </p>
        )}

        <div className="mt-1">
          <AuthButton type="submit" fullWidth loading={loading} disabled={salvo}>
            {loading ? (
              "Salvando..."
            ) : (
              <>
                Salvar nova senha <span aria-hidden="true">→</span>
              </>
            )}
          </AuthButton>
        </div>
      </form>
    </AuthShell>
  );
}
