import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="polia-v3 mt-24 bg-[var(--ink)] pb-8 pt-16 text-[var(--bg)]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="font-fraunces text-[28px]">Pólia</div>
            <p className="mt-3 max-w-[34ch] opacity-80">
              A Pólia te ajuda a construir a sua marca, uma etapa de cada vez, no seu tempo.
            </p>
            <Link
              to="/auth/cadastro"
              className="mt-6 inline-flex rounded-lg border border-[var(--secondary)] bg-[var(--secondary)] px-6 py-3 text-[16px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
            >
              Começar
            </Link>
          </div>
          <div>
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] opacity-60">
              Produto
            </h4>
            <ul className="grid gap-3">
              <li><Link to="/sobre" className="no-underline opacity-80 hover:opacity-100 hover:underline">Sobre</Link></li>
              <li><Link to="/como-funciona" className="no-underline opacity-80 hover:opacity-100 hover:underline">Como funciona</Link></li>
              <li><Link to="/precos" className="no-underline opacity-80 hover:opacity-100 hover:underline">Preços</Link></li>
              <li><Link to="/manifesto" className="no-underline opacity-80 hover:opacity-100 hover:underline">Manifesto</Link></li>
              <li><Link to="/blog" className="no-underline opacity-80 hover:opacity-100 hover:underline">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] opacity-60">
              A gente
            </h4>
            <ul className="grid gap-3">
              <li><Link to="/ajuda" className="no-underline opacity-80 hover:opacity-100 hover:underline">Ajuda</Link></li>
              <li><Link to="/contato" className="no-underline opacity-80 hover:opacity-100 hover:underline">Contato</Link></li>
              <li><Link to="/termos" className="no-underline opacity-80 hover:opacity-100 hover:underline">Termos</Link></li>
              <li><Link to="/privacidade" className="no-underline opacity-80 hover:opacity-100 hover:underline">Privacidade</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-6 text-[13px] opacity-70">
          <span>© 2026 Pólia · usepolia.com.br</span>
          <span>Feito no Brasil, no seu tempo.</span>
        </div>
      </div>
    </footer>
  );
}
