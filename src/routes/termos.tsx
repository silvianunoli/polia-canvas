import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso · Pólia" },
      {
        name: "description",
        content: "Termos de uso da Pólia. Em linguagem clara, sem letra miúda escondendo pegadinha.",
      },
    ],
  }),
  component: TermosPage,
});

function Ph({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[3px] bg-[var(--highlight)] px-1.5 font-semibold text-[var(--highlight-ink)]">
      {children}
    </span>
  );
}

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

function TermosPage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        <section className="pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-[760px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Jurídico
            </p>
            <h1 className="font-cabinet mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[48px]">
              Termos de uso
            </h1>
            <p className="mt-3 text-[14px] text-[var(--muted)]">
              Última atualização: <Ph>[DD/MM/AAAA]</Ph>
            </p>

            <div className="mt-6 flex gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
              <span aria-hidden="true" className="text-[var(--danger)]">•</span>
              <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">
                <strong className="text-[var(--ink)]">Rascunho, não revisado por advogado.</strong>{" "}
                Este texto é uma base em linguagem clara, feita pra não começar do zero. Antes de ir
                ao ar, precisa passar por um advogado e ter os campos marcados em <Ph>amarelo</Ph>{" "}
                preenchidos com os dados reais da empresa.
              </p>
            </div>

            <p className="mt-6 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              Bem-vinda à Pólia. Estes termos explicam as regras de uso do site e do aplicativo. A
              gente escreveu do jeito mais direto possível. Ao criar uma conta ou usar o site, a usuária
              concorda com o que está aqui.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-soft)]">
              A Pólia é operada por <Ph>[Razão social]</Ph>, CNPJ <Ph>[00.000.000/0001-00]</Ph>, com
              sede em <Ph>[endereço]</Ph> (“Pólia”, “a gente”). Contato:{" "}
              <a href="mailto:oi@usepolia.com.br" className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]">
                oi@usepolia.com.br
              </a>
              .
            </p>

            <hr className="my-8 border-t border-[var(--line)]" />
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Nesta página
            </p>
            <ul className="mt-4 list-none columns-2 gap-6 p-0">
              {TOC.map(([id, label]) => (
                <li key={id} className="mb-2 break-inside-avoid">
                  <a
                    href={`#${id}`}
                    className="text-[var(--ink)] no-underline hover:underline hover:decoration-[var(--secondary)] hover:decoration-2 hover:underline-offset-[3px]"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="[&>h2]:mt-12 [&>h2]:scroll-mt-24 [&>h2]:text-[22px] [&>h2]:text-[var(--ink)] [&>p]:mt-3 [&>p]:leading-relaxed [&>p]:text-[var(--ink-soft)] [&>ul]:mt-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:text-[var(--ink-soft)] [&>ul>li]:mt-2">
              <h2 id="aceitacao">1. Aceitação</h2>
              <p>
                Ao usar a Pólia, a usuária declara ter pelo menos 18 anos e capacidade para aceitar
                estes termos. Se usa a Pólia em nome de uma empresa, declara ter poderes para
                isso.
              </p>

              <h2 id="servico">2. O que é a Pólia</h2>
              <p>
                A Pólia é um ambiente digital que organiza a operação da marca em etapas e
                tarefas, com registro de clientes, números e progresso. A Pólia é uma ferramenta de
                apoio: as decisões sobre o negócio são sempre da usuária. A gente não presta
                consultoria contábil, jurídica ou financeira.
              </p>

              <h2 id="conta">3. A conta</h2>
              <p>
                A usuária é responsável por manter os dados de acesso em segurança e por tudo que
                acontece na conta. Deve avisar a gente se notar uso indevido. Os dados informados
                devem ser verdadeiros e atualizados.
              </p>

              <h2 id="planos">4. Planos e pagamento</h2>
              <ul>
                <li>
                  Os valores e ciclos de cobrança vigentes são os informados na página de{" "}
                  <Link to="/" hash="planos" className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]">
                    Preços
                  </Link>
                  .
                </li>
                <li>A cobrança é recorrente e renova automaticamente até ser cancelada.</li>
                <li>
                  <Ph>[Definir política de reembolso e período de teste.]</Ph>
                </li>
                <li>Impostos aplicáveis podem incidir conforme a legislação brasileira.</li>
              </ul>

              <h2 id="uso">5. Uso aceitável</h2>
              <p>
                A usuária concorda em não usar a Pólia para: violar leis, infringir direitos de
                terceiros, tentar burlar segurança, revender o acesso sem autorização, ou
                sobrecarregar a plataforma de forma indevida. A gente pode suspender contas que
                quebrem estas regras.
              </p>

              <h2 id="conteudo">6. O conteúdo</h2>
              <p>
                Tudo que é cadastrado na Pólia (dados da marca, clientes, números) continua sendo
                da usuária. Ela dá pra gente apenas a permissão necessária para operar o serviço:
                armazenar, processar e mostrar esse conteúdo de volta. A gente não vende esse
                conteúdo. O tratamento de dados pessoais segue a{" "}
                <Link to="/privacidade" className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]">
                  Política de Privacidade
                </Link>
                .
              </p>

              <h2 id="propriedade">7. Propriedade da Pólia</h2>
              <p>
                A marca Pólia, o software, o design e os textos são nossos ou licenciados para a
                gente. Estes termos não transferem esses direitos para a usuária, além do uso normal do
                serviço.
              </p>

              <h2 id="cancelamento">8. Cancelamento</h2>
              <p>
                O cancelamento pode ser feito quando quiser, direto no aplicativo, sem precisar ligar ou
                justificar. O acesso continua até o fim do ciclo já pago. A gente pode encerrar
                contas que violem estes termos, avisando quando for possível.
              </p>

              <h2 id="garantias">9. Garantias e responsabilidade</h2>
              <p>
                A gente se esforça para manter a Pólia no ar e funcionando, mas o serviço é
                fornecido “como está”, sem garantia de disponibilidade ininterrupta. Na medida
                permitida pela lei, a responsabilidade da Pólia se limita ao valor pago
                nos últimos <Ph>[12]</Ph> meses.{" "}
                <Ph>[Revisar limitação com advogado, à luz do Código de Defesa do Consumidor.]</Ph>
              </p>

              <h2 id="mudancas">10. Mudanças nos termos</h2>
              <p>
                A gente pode atualizar estes termos. Quando a mudança for relevante, avisamos por
                e-mail ou dentro do aplicativo, com antecedência razoável. Continuar usando a Pólia
                depois disso significa aceitar a nova versão.
              </p>

              <h2 id="lei">11. Lei e foro</h2>
              <p>
                Estes termos seguem as leis do Brasil. Fica eleito o foro da comarca de{" "}
                <Ph>[cidade/UF]</Ph> para resolver questões, sem prejuízo dos direitos que a
                legislação de consumo garante à usuária.
              </p>

              <h2 id="contato">12. Contato</h2>
              <p>
                Dúvidas sobre estes termos? O contato é{" "}
                <a href="mailto:oi@usepolia.com.br" className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]">
                  oi@usepolia.com.br
                </a>{" "}
                ou pela página de{" "}
                <Link to="/ajuda" hash="contato" className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]">
                  Contato
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
