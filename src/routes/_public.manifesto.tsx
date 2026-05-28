import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto — Pólia" },
      { name: "description", content: "Para a mulher que constrói algo com as próprias mãos. O manifesto da Pólia." },
      { property: "og:title", content: "Manifesto — Pólia" },
      { property: "og:description", content: "Voar é um ato de coragem." },
    ],
  }),
  component: Manifesto,
});

function Manifesto() {
  const paragrafos = [
    "Tem uma mulher no Brasil que faz algo com as próprias mãos.",
    "Ela costura, ela molda, ela confecciona, ela cria. Ela acorda cedo, dorme tarde, e carrega no corpo o peso de quem não para.",
    "O problema não é o trabalho. Nunca foi. O problema é que ninguém ensinou ela a cobrar pelo que vale. A dizer pra quem é. A aparecer sem pedir desculpa.",
    "A Pólia nasceu pra isso.",
    "Não é uma ferramenta de marketing. Não é um curso. É uma jornada estruturada, guiada por inteligência artificial, feita pra acompanhar cada passo da mulher que quer viver do que faz.",
    "Ela não precisa ter diploma. Não precisa de investidor. Não precisa de empresa aberta. Ela precisa de um lugar que acredite que o que ela faz importa — e que ajude ela a provar isso pro mundo.",
    "Esse lugar é a Pólia.",
    "Polo, em física, é o ponto de maior intensidade magnética de um campo. E essa mulher — a que cria, a que persiste, a que entrega com as mãos sujas de tinta — é um polo. Ela atrai. Ela transforma. Ela tem uma força que só precisa de estrutura pra se tornar imparável.",
  ];

  return (
    <section className="relative bg-[#1A1A2E] py-24 md:py-32 overflow-hidden min-h-screen">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#C96B3E]/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#C9407A]/12 rounded-full blur-[120px]" />
      </div>
      <div className="relative max-w-3xl mx-auto px-6">
        <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-6 text-center">
          Manifesto
        </p>
        <div className="space-y-8">
          {paragrafos.map((p, i) => (
            <p
              key={i}
              className="font-serif text-[#FDF8F5] text-[24px] md:text-[30px] leading-snug text-center"
            >
              {p}
            </p>
          ))}
          <p className="font-handwritten text-[#E89770] text-[32px] md:text-[40px] text-center pt-8">
            voar é um ato de coragem.
          </p>
        </div>
      </div>
    </section>
  );
}
