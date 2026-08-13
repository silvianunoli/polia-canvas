import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

const ITENS = [
  { hash: "como-funciona", texto: "Como funciona" },
  { hash: "produto", texto: "O produto" },
  { hash: "planos", texto: "Planos" },
  { hash: "perguntas", texto: "Perguntas" },
] as const;

/**
 * Cabeçalho de todas as páginas públicas. A navegação aponta pras seções da
 * home, então funciona igual estando na home ou em qualquer página interna.
 *
 * `semLogin` é o modo squeeze: esconde navegação E login, pra página que não
 * pode ter rota de fuga (lista de espera). Não basta esconder só o login.
 */
export function SiteHeader({ semLogin = false }: { semLogin?: boolean } = {}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`polia-v3 sticky top-0 z-50 bg-[var(--bg)]/90 backdrop-blur-[12px] transition-colors ${
        rolou ? "border-b border-[var(--line)]" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-8 px-[clamp(20px,4vw,48px)]">
        <Link to="/" aria-label="Pólia, página inicial" className="text-[var(--ink)] no-underline">
          <PoliaWordmark className="h-6 w-auto" />
        </Link>

        {!semLogin && (
          <>
            <nav className="mx-auto hidden gap-6 md:flex" aria-label="Navegação principal">
              {ITENS.map((i) => (
                <Link
                  key={i.hash}
                  to="/"
                  hash={i.hash}
                  className="border-b-2 border-transparent py-1.5 text-[15px] font-medium text-[var(--ink-soft)] no-underline transition-colors hover:border-[var(--secondary)] hover:text-[var(--ink)]"
                >
                  {i.texto}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3 md:ml-0">
              <Link
                to="/auth/login"
                className="hidden px-3.5 text-[15px] font-medium text-[var(--ink-soft)] no-underline transition-colors hover:text-[var(--ink)] md:inline-flex"
              >
                Entrar
              </Link>
              <Link
                to="/"
                hash="planos"
                data-track="cadastro_cta_clicado"
                data-track-props='{"contexto":"header"}'
                className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--secondary-ink)] no-underline transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                Criar conta grátis
              </Link>
              <button
                type="button"
                aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuAberto}
                onClick={() => setMenuAberto((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--line)] text-[var(--ink)] md:hidden"
              >
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
                  <path
                    d="M1 1h16M1 7h16M1 13h16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {menuAberto && !semLogin && (
        <nav
          className="mx-auto flex w-full max-w-[1200px] flex-col border-t border-[var(--line)] px-[clamp(20px,4vw,48px)] pb-6 md:hidden"
          aria-label="Navegação principal"
        >
          {ITENS.map((i) => (
            <Link
              key={i.hash}
              to="/"
              hash={i.hash}
              onClick={() => setMenuAberto(false)}
              className="border-b border-[var(--line)] py-3.5 text-[17px] text-[var(--ink)] no-underline"
            >
              {i.texto}
            </Link>
          ))}
          <Link
            to="/sobre"
            className="border-b border-[var(--line)] py-3.5 text-[17px] text-[var(--ink)] no-underline"
          >
            Sobre
          </Link>
          <Link to="/auth/login" className="py-3.5 text-[17px] text-[var(--ink)] no-underline">
            Entrar
          </Link>
        </nav>
      )}
    </header>
  );
}
