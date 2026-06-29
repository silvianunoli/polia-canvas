import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso · Pólia" },
      { name: "description", content: "Termos de uso da plataforma Pólia." },
    ],
  }),
  component: Termos,
});

const SECOES = [
  {
    titulo: "1. Aceitação dos termos",
    texto:
      "Ao criar uma conta na Pólia, você concorda com estes termos de uso. Se você não concordar com qualquer parte deste documento, não utilize a plataforma.",
  },
  {
    titulo: "2. Descrição do serviço",
    texto:
      "A Pólia é uma plataforma de apoio ao empreendedorismo feminino que oferece ferramentas guiadas, inteligência artificial e entregáveis personalizados para estruturação de negócios.",
  },
  {
    titulo: "3. Conta de usuário",
    texto:
      "Você é responsável por manter a confidencialidade dos dados de acesso da sua conta. Notifique imediatamente a Pólia em caso de uso não autorizado.",
  },
  {
    titulo: "4. Propriedade intelectual dos entregáveis",
    texto:
      "Os entregáveis gerados a partir das suas respostas são de sua propriedade. A Pólia não reivindica direitos sobre o conteúdo que você produz dentro da plataforma.",
  },
  {
    titulo: "5. Limitação de responsabilidade",
    texto:
      "A Pólia oferece ferramentas de apoio, não substituindo assessoria jurídica, contábil ou financeira profissional. O uso das informações geradas é de exclusiva responsabilidade da usuária.",
  },
  {
    titulo: "6. Cancelamento",
    texto:
      "Você pode cancelar sua assinatura a qualquer momento. O acesso permanece ativo até o fim do período pago.",
  },
  {
    titulo: "7. Modificações",
    texto:
      "A Pólia pode atualizar estes termos periodicamente. Usuárias serão notificadas por email em caso de alterações relevantes.",
  },
  {
    titulo: "8. Contato",
    texto: "Para dúvidas sobre estes termos, entre em contato em: contato@polia.app",
  },
];

function Termos() {
  return (
    <section className="bg-[#FDF8F5] py-20">
      <div className="max-w-2xl mx-auto px-6">
        <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4">
          Legal
        </p>
        <h1 className="font-serif text-[#1A1A2E] text-[40px] md:text-[48px] mb-2">Termos de uso</h1>
        <p className="font-sans text-[#1A1A2E]/55 text-[14px] mb-12">
          Última atualização: maio de 2026
        </p>

        <div className="space-y-8">
          {SECOES.map((item) => (
            <div key={item.titulo}>
              <h2 className="font-serif text-[#1A1A2E] text-[22px] mb-3">{item.titulo}</h2>
              <p className="font-sans text-[#1A1A2E]/75 text-[16px] leading-relaxed">
                {item.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
