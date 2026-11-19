import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { CONTAINER } from "@/components/site/Editorial";
import { INSTAGRAM_URL } from "@/lib/manual/conteudo";

// Casca das páginas de material gratuito (/materiais e /materiais/<slug>).
// Igual à do /manual: sem SiteHeader, sem link no wordmark. A página é destino
// de link do Direct e da bio, não tem rota de fuga pro resto do site. O rodapé
// é o mínimo que a LGPD pede: privacidade, termos e o perfil.
export function CascaMaterial({ children }: { children: ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className={`${CONTAINER} flex items-center py-4 md:py-5`}>
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-[var(--line)] py-8 text-[14px] text-[var(--ink-soft)] md:py-12">
        <div className={`${CONTAINER} flex flex-wrap items-start justify-between gap-6`}>
          <div>
            <PoliaWordmark className="h-5 w-auto" />
            <p className="mt-3 max-w-[38ch] leading-[1.5]">
              Pequenas marcas. Grandes sonhos. Um material gratuito da Pólia.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6" aria-label="Links do rodapé">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ink)] no-underline hover:underline"
            >
              @polialab
            </a>
            <Link to="/privacidade" className="text-[var(--ink)] no-underline hover:underline">
              Privacidade
            </Link>
            <Link to="/termos" className="text-[var(--ink)] no-underline hover:underline">
              Termos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
