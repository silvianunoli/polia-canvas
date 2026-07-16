import { Link } from "@tanstack/react-router";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

export function SiteFooter() {
  return (
    <footer className="polia-v3 mt-24 bg-[var(--ink)] pb-8 pt-16 text-[var(--bg)]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <PoliaWordmark className="h-7 w-auto" />
            <p className="mt-3 max-w-[34ch] opacity-80">
              A clareza sobre a sua marca é o que faz ela faturar mais. A Pólia é onde tudo isso
              se decide.
            </p>
            <Link
              to="/auth/login"
              className="mt-6 inline-flex rounded-lg border border-[var(--secondary)] bg-[var(--secondary)] px-6 py-3 text-[16px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
            >
              Já é assinante?
            </Link>
          </div>
          <div>
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] opacity-60">
              Produto
            </h4>
            <ul className="grid gap-3">
              <li><Link to="/sobre" className="no-underline opacity-80 hover:opacity-100 hover:underline">Sobre</Link></li>
              <li><Link to="/blog" className="no-underline opacity-80 hover:opacity-100 hover:underline">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] opacity-60">
              A gente
            </h4>
            <ul className="grid gap-3">
              <li><Link to="/ajuda" className="no-underline opacity-80 hover:opacity-100 hover:underline">Ajuda</Link></li>
              <li><Link to="/termos" className="no-underline opacity-80 hover:opacity-100 hover:underline">Termos</Link></li>
              <li><Link to="/privacidade" className="no-underline opacity-80 hover:opacity-100 hover:underline">Privacidade</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-6 text-[13px] opacity-70">
          <span>© 2026 Pólia · CNPJ: 18.305.925/0001-06</span>
          <span>Desenvolvido por Prismia Soluções Digitais</span>
        </div>
      </div>
    </footer>
  );
}
