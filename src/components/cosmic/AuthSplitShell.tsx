import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
    <div className="polia-v3 flex min-h-screen w-full flex-wrap">
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
    </div>
  );
}

const ABAS = [
  { to: "/auth/login", label: "Entrar" },
  { to: "/auth/cadastro", label: "Criar conta" },
  { to: "/auth/esqueci-senha", label: "Recuperar acesso" },
] as const;

/** Navegação entre as 3 rotas de auth — não é um switcher client-side. */
export function AuthTabs({ ativo }: { ativo: (typeof ABAS)[number]["to"] }) {
  return (
    <nav className="mb-6 flex gap-1 rounded-xl bg-[var(--line)] p-1" aria-label="Sessões de acesso">
      {ABAS.map((aba) => {
        const ativa = aba.to === ativo;
        return (
          <Link
            key={aba.to}
            to={aba.to}
            aria-current={ativa ? "page" : undefined}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-[13.5px] font-semibold transition-colors ${
              ativa
                ? "border-[1.5px] border-[var(--ink)] bg-white text-[var(--ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink-soft)]"
            }`}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
