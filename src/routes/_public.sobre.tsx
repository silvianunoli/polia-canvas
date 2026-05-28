import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Pólia" },
      { name: "description", content: "Construída por uma empreendedora, pra empreendedoras. Conheça a história e a mascote da Pólia." },
      { property: "og:title", content: "Sobre — Pólia" },
      { property: "og:description", content: "Por que a Pólia existe." },
    ],
  }),
  component: Sobre,
});

function Sobre() {
  return (
    <section className="bg-[#FDF8F5] py-24">
      <div className="max-w-3xl mx-auto px-6">
        <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4 text-center">
          Sobre
        </p>
        <h1 className="font-serif text-[#1A1A2E] text-[40px] md:text-[52px] leading-tight text-center mb-16">
          Construída por uma empreendedora, pra empreendedoras.
        </h1>

        <div className="space-y-6 mb-16">
          <p className="font-sans text-[#1A1A2E]/80 text-[17px] leading-relaxed">
            A Pólia nasceu da frustração de ver mulheres incríveis subestimando o próprio trabalho. Mulheres que criam produtos lindos, entregam com cuidado, mas não sabem dizer quem são, pra quem servem ou quanto cobrar.
          </p>
          <p className="font-sans text-[#1A1A2E]/80 text-[17px] leading-relaxed">
            Existe muito conteúdo sobre empreendedorismo. Mas pouco que seja feito pra quem está no começo, que faz tudo sozinha, que não tem tempo pra curso de 40 horas.
          </p>
          <p className="font-sans text-[#1A1A2E]/80 text-[17px] leading-relaxed">
            A proposta da Pólia é simples: perguntas certas, IA que processa, entregáveis reais. Sem enrolação. Sem jargão. Com respeito pelo tempo e pela inteligência de quem usa.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-10 border border-[#1A1A2E]/8 mb-12">
          <p className="font-sans font-semibold text-[#C96B3E] text-[11px] uppercase tracking-[0.18em] mb-3">
            A mascote
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] mb-4">A Raposa Pólia Fox</h2>
          <p className="font-sans text-[#1A1A2E]/70 text-[16px] leading-relaxed">
            A raposa é curiosa, estrategista e não tem medo de terreno novo. Assim como você. A Pólia Fox acompanha a jornada e aparece nos momentos que importam.
          </p>
        </div>

        <div className="text-center">
          <Link to="/lista-de-espera" className="inline-block bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] px-7 py-4 rounded-xl hover:bg-[#B85A2D] transition-colors">
            Entrar na lista de espera
          </Link>
        </div>
      </div>
    </section>
  );
}
