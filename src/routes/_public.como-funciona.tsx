import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Pólia" },
      { name: "description", content: "11 etapas em 4 fases. Perguntas guiadas, IA de apoio e entregáveis que ficam com você." },
      { property: "og:title", content: "Como funciona — Pólia" },
      { property: "og:description", content: "Uma jornada estruturada para o seu negócio, no seu ritmo." },
    ],
  }),
  component: ComoFunciona,
});

const ETAPAS = [
  { n: 1, fase: "SONHO", cor: "#C9407A", nome: "Quem é você", entregavel: "Mini-pitch" },
  { n: 2, fase: "SONHO", cor: "#C9407A", nome: "Sua voz", entregavel: "Voz de marca" },
  { n: 3, fase: "SONHO", cor: "#C9407A", nome: "Seu lugar no mercado", entregavel: "Mapa de posicionamento" },
  { n: 4, fase: "CONSTRUÇÃO", cor: "#1A7FAD", nome: "Seu produto", entregavel: "Ficha de produto" },
  { n: 5, fase: "CONSTRUÇÃO", cor: "#1A7FAD", nome: "Sua presença", entregavel: "Guia de primeira impressão" },
  { n: 6, fase: "CONSTRUÇÃO", cor: "#1A7FAD", nome: "Seu controle", entregavel: "Sistema de controle" },
  { n: 7, fase: "VENDA", cor: "#1A8F5C", nome: "Sua cliente", entregavel: "Roteiro de fechamento" },
  { n: 8, fase: "VENDA", cor: "#1A8F5C", nome: "Seu cuidado", entregavel: "Protocolo de cuidado" },
  { n: 9, fase: "VENDA", cor: "#1A8F5C", nome: "Seu conteúdo", entregavel: "Plano de conteúdo" },
  { n: 10, fase: "EVOLUÇÃO", cor: "#6B50CC", nome: "Seus números", entregavel: "Painel de 3 números" },
  { n: 11, fase: "EVOLUÇÃO", cor: "#6B50CC", nome: "Sua rede", entregavel: "Plano de crescimento" },
];

function ComoFunciona() {
  return (
    <>
      <section className="bg-[#1A1A2E] py-24 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Como funciona
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[56px] leading-tight mb-6">
            Uma jornada guiada. No seu ritmo. Com resultado real.
          </h1>
          <p className="font-sans text-[#FDF8F5]/70 text-[17px] leading-relaxed">
            A Pólia estrutura seu negócio em 11 etapas organizadas em 4 fases. Cada etapa tem perguntas guiadas, IA de apoio e um entregável que fica na sua biblioteca.
          </p>
        </div>
      </section>

      <section className="bg-[#FDF8F5] py-24">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { num: "01", titulo: "Perguntas certas", texto: "Cada etapa traz perguntas pensadas pra quem está começando — sem jargão, sem enrolação. Você pensa, você responde." },
            { num: "02", titulo: "IA que processa", texto: "Suas respostas viram entregáveis concretos: um pitch, uma ficha de produto, um roteiro de vendas. Gerados com o que você mesma escreveu." },
            { num: "03", titulo: "Ferramentas vivas", texto: "Os entregáveis se organizam em 4 ferramentas vivas — hubs que crescem com você e ficam acessíveis pra sempre." },
          ].map((item) => (
            <div key={item.num}>
              <p className="font-serif text-[#C96B3E] text-[48px] mb-4">{item.num}</p>
              <h3 className="font-serif text-[#1A1A2E] text-[24px] mb-3">{item.titulo}</h3>
              <p className="font-sans text-[#1A1A2E]/65 text-[15px] leading-relaxed">{item.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F5F5FA] py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-serif text-[#1A1A2E] text-[32px] md:text-[40px] text-center mb-16">
            As 11 etapas
          </h2>
          <div className="space-y-2">
            {ETAPAS.map((item, i) => (
              <div key={item.n} className="flex gap-6 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-serif text-white text-[18px] shrink-0"
                    style={{ backgroundColor: item.cor }}
                  >
                    {item.n}
                  </div>
                  {i < ETAPAS.length - 1 && <div className="w-px flex-1 bg-[#1A1A2E]/15 min-h-[40px]" />}
                </div>
                <div className="pb-6 flex-1">
                  <p className="font-sans font-semibold text-[11px] uppercase tracking-wider mb-1" style={{ color: item.cor }}>
                    {item.fase}
                  </p>
                  <p className="font-serif text-[#1A1A2E] text-[20px]">{item.nome}</p>
                  <p className="font-sans text-[#1A1A2E]/55 text-[14px] mt-1">
                    entregável: {item.entregavel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1A1A2E] py-24 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-serif text-[#FDF8F5] text-[36px] md:text-[44px] mb-10">
            Pronta pra começar?
          </h2>
          <Link to="/lista-de-espera" className="inline-block bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] px-7 py-4 rounded-xl hover:bg-[#B85A2D] transition-colors">
            Entrar na lista de espera
          </Link>
        </div>
      </section>
    </>
  );
}
