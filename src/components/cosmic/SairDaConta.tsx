import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { registrarEAguardar } from "@/lib/founder-eventos";
import { toastErro } from "@/lib/toast";

// Mesma chave do guard da área logada (_authenticated.tsx). Fica marcada
// enquanto houve sessão; se sobrar depois de um "Sair" de propósito, o
// próximo login abre com o aviso de "sessão expirada", que não é verdade.
const TEVE_SESSAO_KEY = "polia-teve-sessao";

/**
 * Encerra a sessão deste navegador. Se o servidor não responder, encerra pelo
 * menos a sessão local: quem clicou em Sair não pode continuar presa.
 */
async function sairDaConta(): Promise<void> {
  try {
    await registrarEAguardar("logout", { feature: "conta" });
  } catch {
    // evento de métrica não segura a saída
  }
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: "local" });
  try {
    localStorage.removeItem(TEVE_SESSAO_KEY);
  } catch {
    // modo privado sem storage: nada a limpar
  }
}

/**
 * Link discreto de saída pras telas sem barra lateral (onboarding, criar
 * senha): quem entrou com a conta Google errada precisa de uma porta.
 */
export function BotaoSair({ className = "" }: { className?: string }) {
  const [saindo, setSaindo] = useState(false);
  async function sair() {
    setSaindo(true);
    try {
      await sairDaConta();
      // Recarrega de propósito: limpa o cache de dados da conta que saiu.
      window.location.href = "/auth/login";
    } catch {
      setSaindo(false);
      toastErro("A Pólia One não conseguiu sair agora. Confere a internet e tenta de novo.");
    }
  }
  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      data-track="sair_clicado"
      className={`inline-flex min-h-11 items-center rounded-lg px-2 text-[14px] text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:text-[var(--muted)] disabled:no-underline ${className}`}
    >
      {saindo ? "Saindo..." : "Sair"}
    </button>
  );
}

/**
 * Aviso nas telas de entrar e de criar conta quando o navegador já tem uma
 * sessão aberta (de quem usou o computador antes, por exemplo). Lê a sessão
 * uma vez, na abertura: a sessão que nasce do próprio login desta tela não
 * deve fazer o aviso piscar antes de navegar.
 */
export function AvisoSessaoAberta() {
  const [email, setEmail] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo && data.session) setEmail(data.session.user.email ?? "outra conta");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setEmail(null);
    });
    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!email) return null;

  async function sair() {
    setSaindo(true);
    try {
      await sairDaConta();
      setEmail(null);
    } catch {
      toastErro("A Pólia One não conseguiu sair agora. Confere a internet e tenta de novo.");
    } finally {
      setSaindo(false);
    }
  }

  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-left"
    >
      <p className="text-[14px] text-[var(--ink)]">
        A sessão de <span className="font-semibold break-all">{email}</span> está aberta neste
        navegador.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4">
        <Link
          to="/painel"
          className="inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] underline underline-offset-2"
        >
          Ir pro Painel
        </Link>
        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="inline-flex min-h-11 items-center text-[14px] text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
        >
          {saindo ? "Saindo..." : "Sair"}
        </button>
      </div>
    </div>
  );
}
