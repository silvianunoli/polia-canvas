import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

const ITENS: { texto: string; to: string; hash?: string }[] = [
  { hash: "como-funciona", texto: "Como funciona", to: "/" },
  { hash: "produto", texto: "O produto", to: "/" },
  { hash: "planos", texto: "Planos", to: "/" },
  { hash: "perguntas", texto: "Perguntas", to: "/" },
  { texto: "Blog", to: "/blog" },
];

/** Rota atual bate com o destino (a própria rota ou uma sub-rota dela). */
function rotaAtiva(pathname: string, alvo: string) {
  return pathname === alvo || pathname.startsWith(`${alvo}/`);
}

/** Ativo pela rota, ou pela âncora da home quando o item aponta pra uma seção. */
function itemAtivo(item: { to: string; hash?: string }, pathname: string, hash: string) {
  if (item.hash) return pathname === "/" && hash === `#${item.hash}`;
  return rotaAtiva(pathname, item.to);
}

const classeDesktop = (ativo: boolean) =>
  `border-b-2 py-1.5 text-[15px] font-medium no-underline transition-colors hover:border-[var(--secondary)] hover:text-[var(--ink)] ${
    ativo
      ? "border-[var(--secondary)] text-[var(--secondary-text)]"
      : "border-transparent text-[var(--ink-soft)]"
  }`;

const classeMobile = (ativo: boolean) =>
  `border-b border-[var(--line)] py-3.5 text-[17px] no-underline ${
    ativo ? "font-semibold text-[var(--secondary-text)]" : "text-[var(--ink)]"
  }`;

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
  const reduzirMovimento = useReducedMotion();
  const location = useRouterState({ select: (s) => s.location });
  const ajudaAtiva = rotaAtiva(location.pathname, "/ajuda");
  const sobreAtiva = rotaAtiva(location.pathname, "/sobre");

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header
        className={`polia-v3 sticky top-0 z-50 transition-colors ${
          rolou
            ? "border-b border-[var(--line)] bg-[var(--bg)]"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-8 px-[clamp(20px,4vw,48px)]">
          <Link
            to="/"
            aria-label="Pólia, página inicial"
            className="text-[var(--ink)] no-underline"
          >
            <PoliaWordmark className="h-6 w-auto" />
          </Link>

          {!semLogin && (
            <>
              <nav className="mx-auto hidden gap-6 md:flex" aria-label="Navegação principal">
                {ITENS.map((i) => {
                  const ativo = itemAtivo(i, location.pathname, location.hash);
                  return (
                    <Link
                      key={i.texto}
                      to={i.to}
                      hash={i.hash}
                      aria-current={ativo ? "page" : undefined}
                      className={classeDesktop(ativo)}
                    >
                      {i.texto}
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-auto flex items-center gap-3 md:ml-0">
                <Link
                  to="/auth/login"
                  className="hidden px-3.5 text-[15px] font-medium text-[var(--ink-soft)] no-underline transition-colors hover:text-[var(--ink)] md:inline-flex"
                >
                  Entrar
                </Link>
                {/* DEC-16 (07/10/2026): o cabeçalho leva direto pro cadastro
                    Grátis, como a copy da home pedia. A origem segue até a
                    conta (FUN-06), igual às landings. */}
                <Link
                  to="/auth/cadastro"
                  search={{ origem: "cabecalho" }}
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"header"}'
                  className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--secondary-ink)] no-underline transition-transform duration-150 ease-out active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  Quero começar grátis
                </Link>
                <button
                  type="button"
                  aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
                  aria-expanded={menuAberto}
                  onClick={() => setMenuAberto((v) => !v)}
                  className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--line)] text-[var(--ink)] md:hidden"
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

        <AnimatePresence>
          {menuAberto && !semLogin && (
            <motion.nav
              initial={{
                opacity: 0,
                transform: reduzirMovimento ? "translateY(0px)" : "translateY(-8px)",
              }}
              animate={{
                opacity: 1,
                transform: "translateY(0px)",
                transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
              }}
              exit={{
                opacity: 0,
                transform: reduzirMovimento ? "translateY(0px)" : "translateY(-8px)",
                transition: { duration: 0.13, ease: [0.16, 1, 0.3, 1] },
              }}
              className="mx-auto flex w-full max-w-[1200px] flex-col border-t border-[var(--line)] px-[clamp(20px,4vw,48px)] pb-6 md:hidden"
              aria-label="Navegação principal"
            >
              {ITENS.map((i) => {
                const ativo = itemAtivo(i, location.pathname, location.hash);
                return (
                  <Link
                    key={i.texto}
                    to={i.to}
                    hash={i.hash}
                    onClick={() => setMenuAberto(false)}
                    aria-current={ativo ? "page" : undefined}
                    className={classeMobile(ativo)}
                  >
                    {i.texto}
                  </Link>
                );
              })}
              <Link
                to="/ajuda"
                onClick={() => setMenuAberto(false)}
                aria-current={ajudaAtiva ? "page" : undefined}
                className={classeMobile(ajudaAtiva)}
              >
                Ajuda
              </Link>
              <Link
                to="/sobre"
                onClick={() => setMenuAberto(false)}
                aria-current={sobreAtiva ? "page" : undefined}
                className={classeMobile(sobreAtiva)}
              >
                Sobre
              </Link>
              <Link to="/auth/login" className="py-3.5 text-[17px] text-[var(--ink)] no-underline">
                Entrar
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
