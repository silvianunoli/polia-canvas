import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_public/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de ajuda · Pólia" },
      { name: "description", content: "Respostas pras perguntas mais comuns sobre a Pólia." },
      { property: "og:title", content: "Central de ajuda · Pólia" },
      { property: "og:description", content: "Tudo o que você precisa saber pra começar." },
    ],
  }),
  component: Ajuda,
});

const FAQ = [
  {
    pergunta: "O que é a Pólia?",
    resposta:
      "A Pólia é uma plataforma guiada pra mulheres empreendedoras que querem estruturar seu negócio. São 11 etapas com perguntas, IA de apoio e entregáveis reais que ficam com você pra usar sempre que precisar.",
  },
  {
    pergunta: "Preciso ter experiência com tecnologia?",
    resposta:
      "Não. A Pólia foi feita pra ser simples. Se você sabe digitar uma mensagem de WhatsApp, você consegue usar a Pólia.",
  },
  {
    pergunta: "Quanto tempo leva pra completar as etapas?",
    resposta:
      "Cada etapa leva entre 20 e 40 minutos. Você pode fazer no seu ritmo, pausar e voltar quando quiser. O progresso fica salvo.",
  },
  {
    pergunta: "Os entregáveis gerados pela IA são meus?",
    resposta:
      "Sim. Tudo que a Pólia gera a partir das suas respostas é seu — você pode editar, exportar e usar como quiser.",
  },
  {
    pergunta: "Quando a Pólia vai lançar?",
    resposta:
      "O lançamento está previsto pra maio de 2026. Quem entrar na lista de espera recebe o aviso primeiro e com condições especiais.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Sim. Não tem fidelidade, não tem multa. Você cancela quando quiser direto nas configurações da conta.",
  },
  {
    pergunta: "Como a IA funciona dentro da Pólia?",
    resposta:
      "A IA processa as suas respostas e gera entregáveis estruturados — como um pitch, uma ficha de produto ou um roteiro de vendas. Ela não substitui você: ela organiza o que você já sabe sobre o seu negócio.",
  },
];

function Ajuda() {
  return (
    <>
      <section className="bg-[#1A1A2E] py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Central de ajuda
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[52px] leading-tight">
            Como podemos ajudar?
          </h1>
        </div>
      </section>

      <section className="bg-[#FDF8F5] py-20">
        <div className="max-w-2xl mx-auto px-6">
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-white rounded-xl border border-[#1A1A2E]/8 px-6 !border-b"
              >
                <AccordionTrigger className="font-serif text-[#1A1A2E] text-[18px] hover:no-underline">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="font-sans text-[#1A1A2E]/70 text-[15px] leading-relaxed">
                  {item.resposta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="font-sans text-[#1A1A2E]/60 text-[15px] mb-3">
              Não encontrou o que precisava?
            </p>
            <Link to="/contato" className="font-sans text-[#C96B3E] text-[15px] hover:underline">
              Falar com a gente →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
