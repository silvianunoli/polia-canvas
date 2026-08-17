import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso · Pólia" },
      {
        name: "description",
        content:
          "Termos de uso da Pólia. Em linguagem clara, sem letra miúda escondendo pegadinha.",
      },
    ],
  }),
  component: TermosPage,
});

const TOC = [
  ["aceitacao", "1. Aceitação"],
  ["servico", "2. O que é a Pólia"],
  ["conta", "3. A conta"],
  ["planos", "4. Planos e pagamento"],
  ["uso", "5. Uso aceitável"],
  ["conteudo", "6. O conteúdo"],
  ["propriedade", "7. Propriedade da Pólia"],
  ["cancelamento", "8. Cancelamento"],
  ["garantias", "9. Garantias e responsabilidade"],
  ["mudancas", "10. Mudanças nos termos"],
  ["lei", "11. Lei e foro"],
  ["contato", "12. Contato"],
] as const;

// Link dentro do texto corrido: sublinhado turquesa, texto em tinta (o turquesa
// puro reprova AA em texto pequeno).
const LINK =
  "rounded-sm text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

// O corpo do documento é texto corrido com links inline, então o estilo das
// tags mora aqui em vez de repetir classe em cada um dos 12 blocos.
const CORPO = [
  "[&>h2]:mt-[clamp(40px,5vw,56px)] [&>h2]:scroll-mt-28 [&>h2]:text-[clamp(1.2rem,2.2vw,1.5rem)] [&>h2]:font-bold [&>h2]:leading-[1.2] [&>h2]:tracking-[-0.02em] [&>h2]:text-balance [&>h2]:text-[var(--ink)]",
  "[&>p]:mt-4 [&>p]:text-[17px] [&>p]:leading-[1.7] [&>p]:text-[var(--ink-soft)]",
  "[&>ul]:mt-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:text-[17px] [&>ul]:leading-[1.7] [&>ul]:text-[var(--ink-soft)] [&>ul>li]:mt-2",
].join(" ");

function TermosPage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        <section className={SECAO}>
          <div className={`${CONTAINER} max-w-[68ch]`}>
            {/* CABEÇALHO */}
            <Reveal>
              <Eyebrow>Jurídico</Eyebrow>
              <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Termos de uso
              </h1>
              <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                Última atualização: 16/07/2026
              </p>

              <p className="mt-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Bem-vinda à Pólia. Estes termos explicam as regras de uso do site e do aplicativo.
                Nós escrevemos do jeito mais direto possível. Ao criar uma conta ou usar o site, a
                usuária concorda com o que está aqui.
              </p>
              <p className="mt-4 text-[15px] leading-[1.7] text-[var(--ink-soft)]">
                A Pólia é operada por Silvia Nunoli Soluções Digitais ME, CNPJ 18.305.925/0001-06,
                com sede na Rua Kenkiti Shimomoto, São Paulo/SP (“Pólia”, “nós”). Contato:{" "}
                <a href="mailto:oi@usepolia.com.br" className={LINK}>
                  oi@usepolia.com.br
                </a>
                .
              </p>
            </Reveal>

            {/* SUMÁRIO */}
            <nav
              aria-label="Nesta página"
              className="mt-[clamp(40px,5vw,56px)] rounded-2xl border border-[var(--line)] bg-white p-8"
            >
              <Eyebrow>Nesta página</Eyebrow>
              <ul className="mt-4 list-none columns-2 gap-6 p-0">
                {TOC.map(([id, label]) => (
                  <li key={id} className="mb-2 break-inside-avoid">
                    <a
                      href={`#${id}`}
                      className="rounded-sm text-[15px] text-[var(--ink)] no-underline hover:underline hover:decoration-[var(--secondary)] hover:decoration-2 hover:underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* CORPO */}
            <div className={CORPO}>
              <h2 id="aceitacao">1. Aceitação</h2>
              <p>
                Ao usar a Pólia, a usuária declara ter pelo menos 18 anos e capacidade para aceitar
                estes termos. Se usa a Pólia em nome de uma empresa, declara ter poderes para isso.
              </p>

              <h2 id="servico">2. O que é a Pólia</h2>
              <p>
                A Pólia é um ambiente digital que organiza a operação da marca em módulos e tarefas,
                com registro de clientes, números e progresso. A Pólia é uma ferramenta de apoio: as
                decisões sobre o negócio são sempre da usuária. Nós não prestamos consultoria
                contábil, jurídica ou financeira.
              </p>

              <h2 id="conta">3. A conta</h2>
              <p>
                A usuária é responsável por manter os dados de acesso em segurança e por tudo que
                acontece na conta. Deve nos avisar se notar uso indevido. Os dados informados devem
                ser verdadeiros e atualizados.
              </p>

              <h2 id="planos">4. Planos e pagamento</h2>
              <ul>
                <li>
                  Os valores e ciclos de cobrança vigentes são os informados na seção de{" "}
                  <Link to="/" hash="planos" className={LINK}>
                    Planos
                  </Link>
                  .
                </li>
                <li>A cobrança é recorrente e renova automaticamente até ser cancelada.</li>
                <li>
                  Não há reembolso de valores já pagos nem período de teste do plano pago. Quem quer
                  experimentar a Pólia antes de assinar pode usar o plano Confere, gratuito.
                </li>
                <li>Impostos aplicáveis podem incidir conforme a legislação brasileira.</li>
              </ul>

              <h2 id="uso">5. Uso aceitável</h2>
              <p>
                A usuária concorda em não usar a Pólia para: violar leis, infringir direitos de
                terceiros, tentar burlar segurança, revender o acesso sem autorização, ou
                sobrecarregar a plataforma de forma indevida. Nós podemos suspender contas que
                quebrem estas regras.
              </p>

              <h2 id="conteudo">6. O conteúdo</h2>
              <p>
                Tudo que é cadastrado na Pólia (dados da marca, clientes, números) continua sendo da
                usuária. Ela nos dá apenas a permissão necessária para operar o serviço: armazenar,
                processar e mostrar esse conteúdo de volta. Nós não vendemos esse conteúdo. O
                tratamento de dados pessoais segue a{" "}
                <Link to="/privacidade" className={LINK}>
                  Política de Privacidade
                </Link>
                .
              </p>

              <h2 id="propriedade">7. Propriedade da Pólia</h2>
              <p>
                A marca Pólia, o software, o design e os textos são nossos ou licenciados para nós.
                Estes termos não transferem esses direitos para a usuária, além do uso normal do
                serviço.
              </p>

              <h2 id="cancelamento">8. Cancelamento</h2>
              <p>
                O cancelamento pode ser feito quando quiser, direto no aplicativo, sem precisar
                ligar ou justificar. O acesso continua até o fim do ciclo já pago. Nós podemos
                encerrar contas que violem estes termos, avisando quando for possível.
              </p>

              <h2 id="garantias">9. Garantias e responsabilidade</h2>
              <p>
                Nós nos esforçamos para manter a Pólia no ar e funcionando, mas o serviço é
                fornecido “como está”, sem garantia de disponibilidade ininterrupta. Na medida
                permitida pela lei, a responsabilidade da Pólia se limita ao valor pago nos últimos
                12 meses, sem prejuízo dos direitos garantidos pelo Código de Defesa do Consumidor.
              </p>

              <h2 id="mudancas">10. Mudanças nos termos</h2>
              <p>
                Nós podemos atualizar estes termos. Quando a mudança for relevante, avisamos por
                e-mail ou dentro do aplicativo, com antecedência razoável. Continuar usando a Pólia
                depois disso significa aceitar a nova versão.
              </p>

              <h2 id="lei">11. Lei e foro</h2>
              <p>
                Estes termos seguem as leis do Brasil. Fica eleito o foro da comarca de São Paulo/SP
                para resolver questões, sem prejuízo dos direitos que a legislação de consumo
                garante à usuária.
              </p>

              <h2 id="contato">12. Contato</h2>
              <p>
                Dúvidas sobre estes termos? O contato é{" "}
                <a href="mailto:oi@usepolia.com.br" className={LINK}>
                  oi@usepolia.com.br
                </a>{" "}
                ou pela nossa{" "}
                <Link to="/ajuda" hash="contato" className={LINK}>
                  Central de Ajuda
                </Link>
                .
              </p>
            </div>

            {/* PRÓXIMO PASSO */}
            <div className="mt-[clamp(48px,6vw,72px)] rounded-2xl border border-[var(--line)] bg-white p-8">
              <Eyebrow>Documentos</Eyebrow>
              <p className="mt-4 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                A Política de Privacidade explica o tratamento dos dados pessoais. Para qualquer
                dúvida sobre estes termos, o contato é direto.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="mailto:oi@usepolia.com.br" className={BTN_PRIMARIO}>
                  Falar com a gente
                </a>
                <Link to="/privacidade" className={BTN_CONTORNO}>
                  Ler a Política de Privacidade
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
