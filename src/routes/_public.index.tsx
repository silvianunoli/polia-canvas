import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/")({
  head: () => ({
    meta: [
      { title: "Pólia — Para mulheres que constroem" },
      { name: "description", content: "Plataforma guiada com 11 etapas para mulheres empreendedoras brasileiras estruturarem seu negócio com base sólida." },
      { property: "og:title", content: "Pólia — Para mulheres que constroem" },
      { property: "og:description", content: "11 etapas guiadas para estruturar seu negócio. Lançamento maio/2026." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-[#1A1A2E] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C96B3E]/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#C9407A]/15 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-[#6B50CC]/15 rounded-full blur-[110px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 py-32 md:py-40 text-center">
          <p className="font-handwritten text-[#E89770] text-[22px] mb-6">
            Chegou para mulheres que criam
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[44px] md:text-[64px] leading-[1.05] mb-8 tracking-tight">
            Seu negócio merece uma base tão sólida quanto o seu trabalho.
          </h1>
          <p className="font-sans text-[#FDF8F5]/70 text-[17px] md:text-[19px] leading-relaxed max-w-2xl mx-auto mb-12">
            A Pólia reúne as 11 etapas que toda empreendedora criativa precisa percorrer pra construir um negócio que dura e cresce.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link to="/lista-de-espera" className="bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] px-7 py-4 rounded-xl hover:bg-[#B85A2D] transition-colors">
              Entrar na lista de espera
            </Link>
            <Link to="/como-funciona" className="text-[#FDF8F5] font-sans text-[15px] px-7 py-4 hover:text-[#E89770] transition-colors">
              Como funciona →
            </Link>
          </div>
          <p className="font-sans text-[#FDF8F5]/40 text-[13px]">lançamento mai/2026.</p>
        </div>
      </section>

      {/* Para quem é */}
      <section className="bg-[#FDF8F5] py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4 text-center">
            Para quem é
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[32px] md:text-[44px] leading-tight text-center mb-16 max-w-3xl mx-auto">
            Pra quem faz algo com as próprias mãos e quer viver disso de verdade.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { tipo: "Artesanato e criação", descricao: "Bordado, costura, bijuteria, crochê, pintura, cerâmica. Seu produto tem alma e merece uma estratégia à altura." },
              { tipo: "Alimentação artesanal", descricao: "Confeitaria, conservas, fermentados, chocolates. Você produz com amor e quer transformar isso em renda consistente." },
              { tipo: "Serviços criativos", descricao: "Fotografia, papelaria, design, ilustração. Seu talento é seu produto. A Pólia ajuda a precificar e posicionar." },
            ].map((item) => (
              <div key={item.tipo} className="bg-white rounded-2xl p-8 border border-[#1A1A2E]/8">
                <h3 className="font-serif text-[#1A1A2E] text-[22px] mb-3">{item.tipo}</h3>
                <p className="font-sans text-[#1A1A2E]/65 text-[15px] leading-relaxed">{item.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 fases */}
      <section className="bg-[#F5F5FA] py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4 text-center">
            A jornada
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[32px] md:text-[44px] leading-tight text-center mb-16 max-w-3xl mx-auto">
            11 etapas. 4 fases. Um negócio que é seu.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { fase: "Sonho", cor: "#C9407A", etapas: "E1 a E3", desc: "Identidade, voz e posicionamento." },
              { fase: "Construção", cor: "#1A7FAD", etapas: "E4 a E6", desc: "Produto, presença e controle." },
              { fase: "Venda", cor: "#1A8F5C", etapas: "E7 a E9", desc: "Clientes, cuidado e conteúdo." },
              { fase: "Evolução", cor: "#6B50CC", etapas: "E10 a E11", desc: "Números, crescimento e rede." },
            ].map((item) => (
              <div key={item.fase} className="bg-white rounded-2xl p-8 border border-[#1A1A2E]/8">
                <span
                  className="inline-block font-sans font-semibold text-[11px] uppercase tracking-wider text-white px-3 py-1 rounded-full mb-4"
                  style={{ backgroundColor: item.cor }}
                >
                  {item.etapas}
                </span>
                <h3 className="font-serif text-[#1A1A2E] text-[24px] mb-2">{item.fase}</h3>
                <p className="font-sans text-[#1A1A2E]/65 text-[15px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/como-funciona" className="font-sans text-[#C96B3E] text-[15px] hover:underline">
              Ver como cada etapa funciona →
            </Link>
          </div>
        </div>
      </section>

      {/* Ferramentas */}
      <section className="bg-[#FDF8F5] py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4 text-center">
            As ferramentas
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[32px] md:text-[44px] leading-tight text-center mb-4 max-w-3xl mx-auto">
            O que você constrói fica com você pra sempre.
          </h2>
          <p className="font-sans text-[#1A1A2E]/60 text-[16px] text-center max-w-2xl mx-auto mb-16">
            Cada etapa gera um entregável real — guardado na sua biblioteca e atualizado conforme você evolui.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { nome: "Sua Marca Viva", desc: "Pitch, voz e posicionamento reunidos." },
              { nome: "Sua Vitrine", desc: "Produto, presença e controle num lugar só." },
              { nome: "Suas Vendas", desc: "Clientes, roteiro e protocolo de cuidado." },
              { nome: "Financeiro", desc: "Números, meta e plano de crescimento." },
            ].map((item) => (
              <div key={item.nome} className="bg-white rounded-2xl p-8 border border-[#1A1A2E]/8">
                <h3 className="font-serif text-[#1A1A2E] text-[20px] mb-2">{item.nome}</h3>
                <p className="font-sans text-[#1A1A2E]/65 text-[14px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#1A1A2E] py-24 text-center">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Comece agora
          </p>
          <h2 className="font-serif text-[#FDF8F5] text-[36px] md:text-[48px] leading-tight mb-6">
            Você não precisa ter tudo resolvido pra começar.
          </h2>
          <p className="font-sans text-[#FDF8F5]/70 text-[17px] mb-10">
            A Pólia começa onde você está. Etapa por etapa, no seu tempo.
          </p>
          <Link to="/lista-de-espera" className="inline-block bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] px-7 py-4 rounded-xl hover:bg-[#B85A2D] transition-colors">
            Entrar na lista de espera
          </Link>
          <p className="font-sans text-[#FDF8F5]/40 text-[13px] mt-6">gratuito durante o beta.</p>
        </div>
      </section>
    </>
  );
}
