import { Link } from "@tanstack/react-router";

export function PublicFooter() {
  return (
    <footer className="bg-[#1A1A2E] border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <p className="font-serif text-[#FDF8F5] text-[24px] mb-3">Pólia</p>
            <p className="font-sans text-[#FDF8F5]/60 text-[13px] leading-relaxed">
              Para a mulher que constrói algo com as próprias mãos e quer que o mundo saiba.
            </p>
          </div>

          <div>
            <p className="font-sans font-semibold text-[#FDF8F5] text-[13px] uppercase tracking-wider mb-4">
              Produto
            </p>
            <ul className="space-y-2">
              <li><Link to="/como-funciona" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Como funciona</Link></li>
              <li><Link to="/precos" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Preços</Link></li>
              <li><Link to="/lista-de-espera" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Lista de espera</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-sans font-semibold text-[#FDF8F5] text-[13px] uppercase tracking-wider mb-4">
              Conteúdo
            </p>
            <ul className="space-y-2">
              <li><Link to="/manifesto" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Manifesto</Link></li>
              <li><Link to="/sobre" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Sobre</Link></li>
              <li><Link to="/blog" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Blog</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-sans font-semibold text-[#FDF8F5] text-[13px] uppercase tracking-wider mb-4">
              Legal
            </p>
            <ul className="space-y-2">
              <li><Link to="/termos" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Termos de uso</Link></li>
              <li><Link to="/privacidade" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Privacidade</Link></li>
              <li><Link to="/contato" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Contato</Link></li>
              <li><Link to="/ajuda" className="font-sans text-[#FDF8F5]/60 text-[14px] hover:text-[#FDF8F5] transition-colors">Central de ajuda</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-sans text-[#FDF8F5]/40 text-[12px]">
            2026 Pólia. Feito com carinho para mulheres que constroem.
          </p>
          <p className="font-handwritten text-[#C96B3E] text-[18px]">
            voar é um ato de coragem.
          </p>
        </div>
      </div>
    </footer>
  );
}
