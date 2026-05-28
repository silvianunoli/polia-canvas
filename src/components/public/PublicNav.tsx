import { Link } from "@tanstack/react-router";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#1A1A2E]/85 backdrop-blur-md border-b border-white/8">
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="font-serif text-[#FDF8F5] text-[22px] tracking-tight">
          Pólia
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/como-funciona" className="font-sans text-[#FDF8F5]/80 text-[14px] hover:text-[#FDF8F5] transition-colors">
            Como funciona
          </Link>
          <Link to="/manifesto" className="font-sans text-[#FDF8F5]/80 text-[14px] hover:text-[#FDF8F5] transition-colors">
            Manifesto
          </Link>
          <Link to="/precos" className="font-sans text-[#FDF8F5]/80 text-[14px] hover:text-[#FDF8F5] transition-colors">
            Preços
          </Link>
          <Link to="/blog" className="font-sans text-[#FDF8F5]/80 text-[14px] hover:text-[#FDF8F5] transition-colors">
            Blog
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/auth/login"
            className="hidden sm:inline-flex font-sans text-[#FDF8F5]/80 text-[14px] hover:text-[#FDF8F5] transition-colors px-3 py-2"
          >
            Entrar
          </Link>
          <Link
            to="/lista-de-espera"
            className="font-sans font-semibold text-[14px] bg-[#C96B3E] text-[#FDF8F5] px-4 py-2 rounded-lg hover:bg-[#B85A2D] transition-colors"
          >
            Entrar na lista
          </Link>
        </div>
      </nav>
    </header>
  );
}
