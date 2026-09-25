import type { ReactNode } from "react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

interface AuthSplitShellProps {
  headline: ReactNode;
  subtext: ReactNode;
  rodape: string[];
  children: ReactNode;
}

/**
 * Variante de duas colunas do AuthShell — só usada em /auth/login. Painel de
 * marca (turquesa) à esquerda + card do formulário à direita. As demais
 * rotas de auth (cadastro, esqueci-senha etc.) seguem no AuthShell compacto;
 * esse layout ainda não foi estendido pra elas.
 */
export function AuthSplitShell({ headline, subtext, rodape, children }: AuthSplitShellProps) {
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="conteudo" className="polia-v3 flex min-h-screen w-full flex-wrap">
        <div className="flex min-h-[320px] flex-1 basis-[480px] flex-col justify-between gap-12 bg-[var(--secondary)] px-6 py-10 text-[var(--secondary-ink)] sm:px-12 sm:py-14">
          <PoliaWordmark className="h-11 w-auto" />

          <div className="max-w-[460px]">
            <h1 className="text-balance text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
              {headline}
            </h1>
            <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-[var(--ink-soft)]">
              {subtext}
            </p>
          </div>

          <p
            className="font-accent text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--secondary-text)]"
            aria-hidden="true"
          >
            {rodape.join(" · ")}
          </p>
        </div>

        <div className="flex flex-1 basis-[420px] items-center justify-center bg-[var(--bg)] px-6 py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </>
  );
}

export type ModoAuth = "entrar" | "recuperar";

function classeAba(ativa: boolean) {
  return `flex-1 rounded-lg px-2 py-2 text-center text-[13.5px] font-semibold transition-colors ${
    ativa
      ? "border-[1.5px] border-[var(--ink)] bg-white text-[var(--ink)]"
      : "text-[var(--muted)] hover:text-[var(--ink-soft)]"
  }`;
}

/** Entrar/Recuperar trocam o formulário no lugar (mesma tela, mesma URL). */
export function AuthTabs({
  modo,
  onModoChange,
}: {
  modo: ModoAuth;
  onModoChange: (modo: ModoAuth) => void;
}) {
  return (
    <nav className="mb-6 flex gap-1 rounded-xl bg-[var(--line)] p-1" aria-label="Sessões de acesso">
      <button
        type="button"
        onClick={() => onModoChange("entrar")}
        aria-current={modo === "entrar" ? "page" : undefined}
        className={classeAba(modo === "entrar")}
      >
        Entrar
      </button>
      <button
        type="button"
        onClick={() => onModoChange("recuperar")}
        aria-current={modo === "recuperar" ? "page" : undefined}
        className={classeAba(modo === "recuperar")}
      >
        Recuperar acesso
      </button>
    </nav>
  );
}
