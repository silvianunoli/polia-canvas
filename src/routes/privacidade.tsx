import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade · Pólia" },
      {
        name: "description",
        content:
          "Política de Privacidade da Pólia, no padrão LGPD. Os dados são da titular. A gente explica o que coleta, por quê e como ela controla.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function Ph({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[3px] bg-[var(--highlight)] px-1.5 font-semibold text-[var(--highlight-ink)]">
      {children}
    </span>
  );
}

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

function PrivacidadePage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        <section className="pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-[760px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Jurídico
            </p>
            <h1 className="font-fraunces mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[48px]">
              Política de Privacidade
            </h1>
            <p className="mt-3 text-[14px] text-[var(--muted)]">
              Última atualização: <Ph>[DD/MM/AAAA]</Ph> · Alinhada à LGPD (Lei 13.709/2018)
            </p>

            <div className="mt-6 flex gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
              <span aria-hidden="true" className="text-[var(--danger)]">•</span>
              <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">
                <strong className="text-[var(--ink)]">Rascunho, não revisado por advogado.</strong>{" "}
                Base em linguagem clara no padrão LGPD. Antes de publicar, precisa de revisão
                jurídica e do preenchimento dos campos em <Ph>amarelo</Ph> (controlador,
                encarregado, ferramentas usadas e prazos reais de retenção).
              </p>
            </div>

            <p className="mt-6 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              Os dados são da titular. Esta política explica, sem enrolação, o que a Pólia coleta,
              para quê, com quem compartilha e como ela controla tudo isso.
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

            <div className="[&>h2]:font-fraunces [&>h2]:mt-12 [&>h2]:scroll-mt-24 [&>h2]:text-[22px] [&>h2]:text-[var(--ink)] [&>p]:mt-3 [&>p]:leading-relaxed [&>p]:text-[var(--ink-soft)] [&>ul]:mt-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:text-[var(--ink-soft)] [&>ul>li]:mt-2">
              <h2 id="controlador">1. Quem trata os dados</h2>
              <p>
                O controlador dos dados é <Ph>[Razão social]</Ph>, CNPJ{" "}
                <Ph>[00.000.000/0001-00]</Ph>, com sede em <Ph>[endereço]</Ph>. É a gente quem
                decide como e por que os dados são tratados.
              </p>

              <h2 id="coleta">2. Dados que coletamos</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-[var(--line)] p-3 text-left text-[15px] font-semibold text-[var(--ink)]">
                        Categoria
                      </th>
                      <th className="border-b border-[var(--line)] p-3 text-left text-[15px] font-semibold text-[var(--ink)]">
                        Exemplos
                      </th>
                      <th className="border-b border-[var(--line)] p-3 text-left text-[15px] font-semibold text-[var(--ink)]">
                        Origem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DADOS.map((d) => (
                      <tr key={d.categoria}>
                        <td className="border-b border-[var(--line)] p-3 align-top text-[15px] text-[var(--ink-soft)]">
                          {d.categoria}
                        </td>
                        <td className="border-b border-[var(--line)] p-3 align-top text-[15px] text-[var(--ink-soft)]">
                          {d.exemplos}
                        </td>
                        <td className="border-b border-[var(--line)] p-3 align-top text-[15px] text-[var(--ink-soft)]">
                          {d.origem}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                A gente coleta o mínimo necessário para a Pólia funcionar. Não pedimos dado
                sensível que o serviço não precisa.
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
                  <strong className="text-[var(--ink)]">Operar a conta e o serviço</strong> ·
                  base: execução de contrato.
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
                    Enviar avisos importantes e, mediante aceite, novidades
                  </strong>{" "}
                  · base: consentimento / legítimo interesse.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cumprir obrigações legais</strong> · base:
                  obrigação legal.
                </li>
              </ul>
              <p>A gente não vende os dados. Ponto.</p>

              <h2 id="cookies">4. Cookies</h2>
              <p>
                Usamos cookies essenciais (pra manter a sessão logada) e, mediante permissão,
                medição de uso para entender o produto e melhorá-lo. O controle fica no banner de
                cookies e nas configurações do navegador. A medição é própria da Pólia, sem
                ferramenta de analytics de terceiros, e só roda depois do seu consentimento — sem
                IP, sem identificador de dispositivo e sem localização.
              </p>

              <h2 id="compartilha">5. Com quem compartilhamos</h2>
              <p>
                Compartilhamos dados apenas com quem ajuda a Pólia a funcionar, e só o necessário:
              </p>
              <ul>
                <li>
                  <strong className="text-[var(--ink)]">Supabase</strong> — banco de dados,
                  autenticação e armazenamento
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cloudflare</strong> — hospedagem do
                  aplicativo e proteção contra bots (Turnstile)
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Stripe</strong> — processamento de
                  pagamento (a Pólia não guarda os dados do cartão)
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Resend</strong> — envio dos e-mails da conta
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Google</strong> — apenas se a titular
                  conectar o Google Agenda, para ler os próprios eventos
                </li>
                <li>Autoridades, quando exigido por lei</li>
              </ul>
              <p>Esses parceiros tratam os dados como operadores, seguindo as nossas instruções.</p>

              <h2 id="direitos">6. Direitos da titular (LGPD art. 18)</h2>
              <p>
                A qualquer momento, a titular pode pedir para: confirmar se a gente trata os dados
                dela; acessar os dados; corrigir dados incompletos ou errados; anonimizar,
                bloquear ou eliminar dados desnecessários; portar os dados; eliminar dados
                tratados com base no consentimento; saber com quem a gente compartilha; e revogar
                o consentimento. Para exercer, o contato é pela seção 12. A gente responde no
                prazo da lei.
              </p>
              <p>
                A exclusão pode ser feita na hora, pela própria titular, em{" "}
                <strong className="text-[var(--ink)]">Configurações → Excluir conta</strong>: isso
                apaga os dados da conta e cancela a assinatura, sem depender de pedido por e-mail.
              </p>

              <h2 id="seguranca">7. Segurança</h2>
              <p>
                Usamos medidas técnicas e organizacionais para proteger os dados, como controle
                de acesso e criptografia em trânsito. Nenhum sistema é 100% infalível, mas a gente
                trata segurança como prioridade e avisa a titular e a ANPD se acontecer um incidente
                relevante.
              </p>

              <h2 id="retencao">8. Por quanto tempo guardamos</h2>
              <p>
                Guardamos os dados enquanto a conta existir. A titular pode excluir a conta a
                qualquer momento (seção 6), e os dados da conta são apagados na hora. Alguns dados
                podem ser mantidos por prazos legais <Ph>[definir prazos, ex.: fiscais por 5 anos]</Ph>.
              </p>

              <h2 id="internacional">9. Transferência internacional</h2>
              <p>
                Os dados são armazenados em servidores nos Estados Unidos (Supabase, região US
                East). Provedores como Cloudflare, Stripe, Resend e Google também podem processar
                dados fora do Brasil. Nesses casos, a transferência se apoia nas garantias
                adequadas previstas na LGPD (art. 33), como as cláusulas contratuais e os acordos
                de tratamento de dados (DPA) desses provedores.
              </p>

              <h2 id="encarregado">10. Encarregado (DPO)</h2>
              <p>
                Nosso encarregado pela proteção de dados é{" "}
                <Ph>[nome / e-mail do encarregado]</Ph>. É com quem a titular fala sobre qualquer
                assunto de privacidade.
              </p>

              <h2 id="mudancas">11. Mudanças nesta política</h2>
              <p>
                Se a gente atualizar esta política, avisamos por aqui e, quando for relevante, por
                e-mail. A data no topo mostra a última versão.
              </p>

              <h2 id="contato">12. Contato</h2>
              <p>
                Assuntos de privacidade:{" "}
                <a
                  href="mailto:privacidade@usepolia.com.br"
                  className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                >
                  privacidade@usepolia.com.br
                </a>{" "}
                ou pela página de{" "}
                <Link
                  to="/contato"
                  className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                >
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
