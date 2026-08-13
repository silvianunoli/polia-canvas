import { Link } from "@tanstack/react-router";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

/**
 * Rodapé de todas as páginas públicas. `semMargemTopo` é pra quando a seção
 * anterior já encosta nele (a home fecha assim).
 */
export function SiteFooter({ semMargemTopo = false }: { semMargemTopo?: boolean } = {}) {
  return (
    <footer
      className={`polia-v3 bg-[var(--ink)] pb-8 pt-[clamp(48px,6vw,64px)] text-[14px] text-[var(--bg)]/75 ${
        semMargemTopo ? "" : "mt-[clamp(48px,6vw,64px)]"
      }`}
    >
      <div className="mx-auto w-full max-w-[1200px] px-[clamp(20px,4vw,48px)]">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <PoliaWordmark className="h-6 w-auto text-[var(--bg)]" />
            <p className="mt-3">Clareza sobre o negócio gera lucro.</p>
          </div>
          <nav className="flex flex-wrap gap-6" aria-label="Links do rodapé">
            <Link to="/sobre" className="no-underline hover:text-[var(--bg)]">
              Sobre
            </Link>
            <Link to="/blog" className="no-underline hover:text-[var(--bg)]">
              Blog
            </Link>
            <Link to="/ajuda" className="no-underline hover:text-[var(--bg)]">
              Ajuda
            </Link>
            <Link to="/termos" className="no-underline hover:text-[var(--bg)]">
              Termos
            </Link>
            <Link to="/privacidade" className="no-underline hover:text-[var(--bg)]">
              Privacidade
            </Link>
          </nav>
        </div>
        <div className="mt-[clamp(48px,6vw,64px)] flex flex-wrap justify-between gap-4 border-t border-white/15 pt-6 text-[12px]">
          <span>usepolia.com.br · feita no Brasil · CNPJ 18.305.925/0001-06</span>
          <span>Desenvolvido por Prismia Soluções Digitais</span>
        </div>
      </div>
    </footer>
  );
}
