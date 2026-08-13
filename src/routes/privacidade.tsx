import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { CONTAINER, SECAO, Eyebrow } from "@/components/site/Editorial";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade · Pólia" },
      {
        name: "description",
        content:
          "Política de Privacidade da Pólia, no padrão LGPD. Os dados são da titular. Nós explicamos o que coletamos, por quê e como ela controla.",
      },
    ],
  }),
  component: PrivacidadePage,
});

const TOC = [
  ["controlador", "1. Quem trata os dados"],
  ["coleta", "2. Dados que coletamos"],
  ["uso", "3. Para que usamos"],
  ["cookies", "4. Cookies"],
  ["compartilha", "5. Compartilhamento"],
  ["direitos", "6. Direitos da titular"],
  ["seguranca", "7. Segurança"],
  ["retencao", "8. Por quanto tempo guardamos"],
  ["internacional", "9. Transferência internacional"],
  ["encarregado", "10. Encarregado (DPO)"],
  ["mudancas", "11. Mudanças"],
  ["contato", "12. Contato"],
] as const;

const DADOS = [
  { categoria: "Cadastro", exemplos: "Nome, e-mail, senha", origem: "Informado pela titular" },
  {
    categoria: "Marca e operação",
    exemplos: "Dados da marca, clientes e números registrados",
    origem: "Informado pela titular",
  },
  {
    categoria: "Pagamento",
    exemplos: "Dados de cobrança, processados pelo provedor de pagamento",
    origem: "Titular / provedor",
  },
  {
    categoria: "Uso",
    exemplos:
      "Páginas acessadas e ações no app (medição própria, sem IP, sem identificador de dispositivo e sem localização)",
    origem: "Coleta automática, só com consentimento",
  },
];

/** Leitura confortável pro texto corrido do documento jurídico. */
const LEITURA = "mx-auto w-full max-w-[68ch]";

const LINK_EMAIL =
  "text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] hover:decoration-[var(--secondary-text)]";

/* Ritmo tipográfico do corpo do documento. Fica num lugar só pra as doze
   seções não divergirem entre si. */
const PROSA = [
  "[&>h2]:mt-[clamp(40px,5vw,56px)] [&>h2]:scroll-mt-28 [&>h2]:text-[clamp(1.3rem,2.2vw,1.6rem)]",
  "[&>h2]:font-bold [&>h2]:leading-[1.2] [&>h2]:tracking-[-0.02em] [&>h2]:text-balance [&>h2]:text-[var(--ink)]",
  "[&>p]:mt-4 [&>p]:text-[17px] [&>p]:leading-[1.7] [&>p]:text-[var(--ink-soft)]",
  "[&>ul]:mt-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:text-[17px] [&>ul]:leading-[1.7] [&>ul]:text-[var(--ink-soft)]",
  "[&>ul>li]:mt-3 [&>ul>li]:pl-1 [&>ul>li]:marker:text-[var(--secondary)]",
].join(" ");

function PrivacidadePage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* CABEÇALHO */}
        <section className="pb-[clamp(32px,4vw,48px)] pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            <Reveal className={LEITURA}>
              <Eyebrow>Jurídico</Eyebrow>
              <h1 className="mt-4 text-[clamp(2.1rem,4.6vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Política de Privacidade
              </h1>
              <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                Última atualização: 16/07/2026 · Alinhada à LGPD (Lei 13.709/2018)
              </p>
              <p className="mt-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Os dados são da titular. Esta política explica, sem enrolação, o que a Pólia coleta,
                para quê, com quem compartilha e como ela controla tudo isso.
              </p>
            </Reveal>

            <Reveal delay={0.1} className={`${LEITURA} mt-[clamp(32px,4vw,48px)]`}>
              <nav
                aria-label="Nesta página"
                className="rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
              >
                <Eyebrow>Nesta página</Eyebrow>
                <ul className="mt-4 list-none columns-2 gap-6 p-0">
                  {TOC.map(([id, label]) => (
                    <li key={id} className="mb-2 break-inside-avoid">
                      <a
                        href={`#${id}`}
                        className="text-[15px] text-[var(--ink)] no-underline hover:underline hover:decoration-[var(--secondary)] hover:decoration-2 hover:underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </Reveal>
          </div>
        </section>

        {/* DOCUMENTO */}
        <section className={`${SECAO} pt-0`}>
          <div className={CONTAINER}>
            <div className={`${LEITURA} ${PROSA}`}>
              <h2 id="controlador">1. Quem trata os dados</h2>
              <p>
                O controlador dos dados é Silvia Nunoli Soluções Digitais ME, CNPJ
                18.305.925/0001-06, com sede na Rua Kenkiti Shimomoto, São Paulo/SP. Somos nós que
                decidimos como e por que os dados são tratados.
              </p>

              <h2 id="coleta">2. Dados que coletamos</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-[var(--line)] p-4 text-left text-[14px] font-semibold text-[var(--ink)]">
                        Categoria
                      </th>
                      <th className="border-b border-[var(--line)] p-4 text-left text-[14px] font-semibold text-[var(--ink)]">
                        Exemplos
                      </th>
                      <th className="border-b border-[var(--line)] p-4 text-left text-[14px] font-semibold text-[var(--ink)]">
                        Origem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DADOS.map((d, i) => (
                      <tr key={d.categoria}>
                        <td
                          className={`p-4 align-top text-[15px] leading-[1.6] font-semibold text-[var(--ink)] ${
                            i === DADOS.length - 1 ? "" : "border-b border-[var(--line)]"
                          }`}
                        >
                          {d.categoria}
                        </td>
                        <td
                          className={`p-4 align-top text-[15px] leading-[1.6] text-[var(--ink-soft)] ${
                            i === DADOS.length - 1 ? "" : "border-b border-[var(--line)]"
                          }`}
                        >
                          {d.exemplos}
                        </td>
                        <td
                          className={`p-4 align-top text-[15px] leading-[1.6] text-[var(--ink-soft)] ${
                            i === DADOS.length - 1 ? "" : "border-b border-[var(--line)]"
                          }`}
                        >
                          {d.origem}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Nós coletamos o mínimo necessário para a Pólia funcionar. Não pedimos dado sensível
                que o serviço não precisa.
              </p>
              <p>
                Quando a titular cadastra dados de terceiros (por exemplo, os clientes do negócio
                dela), ela é a controladora desses dados e a Pólia atua como operadora, tratando-os
                só para prestar o serviço e conforme as instruções dela. A titular é responsável por
                ter base legal para inserir esses dados.
              </p>
              <p>
                A Pólia é destinada a maiores de 18 anos e não coleta dados de menores de forma
                intencional.
              </p>

              <h2 id="uso">3. Para que usamos (e com qual base legal)</h2>
              <ul>
                <li>
                  <strong className="text-[var(--ink)]">Operar a conta e o serviço</strong> · base:
                  execução de contrato.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cobrar a assinatura</strong> · base:
                  execução de contrato e obrigação legal.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Melhorar a Pólia e dar suporte</strong> ·
                  base: legítimo interesse.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">
                    Enviar avisos importantes sobre a conta
                  </strong>{" "}
                  · base: execução de contrato / legítimo interesse.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Enviar a newsletter</strong>, com novidades
                  e conteúdo sobre a Pólia · base: consentimento. O cadastro na newsletter é
                  opcional e separado da criação de conta: a titular escolhe ativamente receber, e
                  cada e-mail enviado traz um link para descadastro imediato, sem precisar entrar em
                  contato.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">
                    Medir o uso do site e das campanhas de divulgação
                  </strong>{" "}
                  (Google Analytics, Google Ads e Meta Ads) · base: consentimento, coletado no
                  banner de cookies.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cumprir obrigações legais</strong> · base:
                  obrigação legal.
                </li>
              </ul>
              <p>Nós não vendemos os dados. Ponto.</p>

              <h2 id="cookies">4. Cookies</h2>
              <p>
                Usamos cookies essenciais (pra manter a sessão logada) e, mediante permissão,
                cookies de análise e publicidade: Google Analytics (para entender como o site é
                usado), Google Ads e Meta Ads / Meta Pixel (para medir o resultado dos nossos
                anúncios e, quando aplicável, mostrar publicidade da Pólia em outros sites). O
                controle fica no banner de cookies e nas configurações do navegador: quem visita
                pode aceitar só os essenciais, e os cookies de análise e publicidade só rodam depois
                do consentimento.
              </p>

              <h2 id="compartilha">5. Com quem compartilhamos</h2>
              <p>
                Compartilhamos dados apenas com quem ajuda a Pólia a funcionar, e só o necessário:
              </p>
              <ul>
                <li>
                  <strong className="text-[var(--ink)]">Supabase</strong>: banco de dados,
                  autenticação e armazenamento
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cloudflare</strong>: hospedagem do
                  aplicativo e proteção contra bots (Turnstile)
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Stripe</strong>: processamento de pagamento
                  (a Pólia não guarda os dados do cartão)
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Resend</strong>: envio dos e-mails da conta
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Google Agenda</strong>: apenas se a titular
                  conectar, para ler os próprios eventos
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Google Analytics e Google Ads</strong>:
                  medição de uso do site e das campanhas de anúncio, só com consentimento
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Meta Ads (Meta Pixel)</strong>: medição do
                  resultado dos anúncios no Instagram e Facebook, só com consentimento
                </li>
                <li>Autoridades, quando exigido por lei</li>
              </ul>
              <p>Esses parceiros tratam os dados como operadores, seguindo as nossas instruções.</p>

              <h2 id="direitos">6. Direitos da titular (LGPD art. 18)</h2>
              <p>
                A qualquer momento, a titular pode pedir para: confirmar se nós tratamos os dados
                dela; acessar os dados; corrigir dados incompletos ou errados; anonimizar, bloquear
                ou eliminar dados desnecessários; portar os dados; eliminar dados tratados com base
                no consentimento; saber com quem nós compartilhamos; e revogar o consentimento. Para
                exercer, o contato é pela seção 12. Nós respondemos no prazo da lei.
              </p>
              <p>
                A exclusão pode ser feita na hora, pela própria titular, em{" "}
                <strong className="text-[var(--ink)]">Configurações → Excluir conta</strong>: isso
                apaga os dados da conta e cancela a assinatura, sem depender de pedido por e-mail.
              </p>

              <h2 id="seguranca">7. Segurança</h2>
              <p>
                Usamos medidas técnicas e organizacionais para proteger os dados, como controle de
                acesso e criptografia em trânsito. Nenhum sistema é 100% infalível, mas nós tratamos
                segurança como prioridade e avisamos a titular e a ANPD se acontecer um incidente
                relevante.
              </p>

              <h2 id="retencao">8. Por quanto tempo guardamos</h2>
              <p>
                Guardamos os dados enquanto a conta existir. A titular pode excluir a conta a
                qualquer momento (seção 6), e os dados da conta são apagados na hora. Alguns dados
                podem ser mantidos por prazos legais, como documentos fiscais e financeiros, por até
                5 anos, conforme exige a legislação tributária brasileira.
              </p>

              <h2 id="internacional">9. Transferência internacional</h2>
              <p>
                Os dados são armazenados em servidores nos Estados Unidos (Supabase, região US
                East). Provedores como Cloudflare, Stripe, Resend, Google (Agenda, Analytics e Ads)
                e Meta (Meta Ads) também podem processar dados fora do Brasil. Nesses casos, a
                transferência se apoia nas garantias adequadas previstas na LGPD (art. 33), como as
                cláusulas contratuais e os acordos de tratamento de dados (DPA) desses provedores.
              </p>

              <h2 id="encarregado">10. Encarregado (DPO)</h2>
              <p>
                Nosso encarregado pela proteção de dados é a própria Silvia Nunes de Oliveira,
                fundadora da Pólia, pelo e-mail{" "}
                <a href="mailto:privacidade@usepolia.com.br" className={LINK_EMAIL}>
                  privacidade@usepolia.com.br
                </a>
                . É com quem a titular fala sobre qualquer assunto de privacidade.
              </p>

              <h2 id="mudancas">11. Mudanças nesta política</h2>
              <p>
                Se nós atualizarmos esta política, avisamos por aqui e, quando for relevante, por
                e-mail. A data no topo mostra a última versão.
              </p>

              <h2 id="contato">12. Contato</h2>
              <p>
                Assuntos de privacidade, somente por e-mail:{" "}
                <a href="mailto:privacidade@usepolia.com.br" className={LINK_EMAIL}>
                  privacidade@usepolia.com.br
                </a>
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
