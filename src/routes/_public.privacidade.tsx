import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade · Pólia" },
      { name: "description", content: "Como a Pólia coleta, usa e protege seus dados." },
    ],
  }),
  component: Privacidade,
});

const SECOES = [
  { titulo: "1. Dados coletados", texto: "Coletamos nome, email e as respostas que você fornece dentro da plataforma. Também coletamos dados de uso para melhorar a experiência (páginas visitadas, tempo por etapa)." },
  { titulo: "2. Como usamos os dados", texto: "Seus dados são usados exclusivamente para fornecer o serviço da Pólia: gerar seus entregáveis, salvar seu progresso e personalizar sua experiência. Não vendemos nem compartilhamos dados com terceiros para fins comerciais." },
  { titulo: "3. IA e dados pessoais", texto: "As respostas que você fornece são enviadas para o modelo de IA para geração dos entregáveis. Elas não são usadas para treinar modelos de inteligência artificial." },
  { titulo: "4. Armazenamento", texto: "Seus dados são armazenados de forma segura via Supabase, com criptografia em trânsito e em repouso. Os servidores estão localizados na região Americas." },
  { titulo: "5. Seus direitos (LGPD)", texto: "Você tem direito a acessar, corrigir e excluir seus dados a qualquer momento. Solicite pelo email: privacidade@polia.app" },
  { titulo: "6. Cookies", texto: "A Pólia usa cookies essenciais para manter a sessão de login ativa. Não utilizamos cookies de rastreamento ou publicidade." },
  { titulo: "7. Contato", texto: "Para exercer seus direitos ou tirar dúvidas sobre privacidade: privacidade@polia.app" },
];

function Privacidade() {
  return (
    <section className="bg-[#FDF8F5] py-20">
      <div className="max-w-2xl mx-auto px-6">
        <p className="font-sans font-semibold text-[#C96B3E] text-[12px] uppercase tracking-[0.18em] mb-4">
          Legal
        </p>
        <h1 className="font-serif text-[#1A1A2E] text-[40px] md:text-[48px] mb-2">Política de privacidade</h1>
        <p className="font-sans text-[#1A1A2E]/55 text-[14px] mb-12">Última atualização: maio de 2026</p>

        <div className="space-y-8">
          {SECOES.map((item) => (
            <div key={item.titulo}>
              <h2 className="font-serif text-[#1A1A2E] text-[22px] mb-3">{item.titulo}</h2>
              <p className="font-sans text-[#1A1A2E]/75 text-[16px] leading-relaxed">{item.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
