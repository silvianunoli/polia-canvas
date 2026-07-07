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
          "Política de Privacidade da Pólia, no padrão LGPD. Seus dados são seus. A gente explica o que coleta, por quê e como você controla.",
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
  ["controlador", "1. Quem trata seus dados"],
  ["coleta", "2. Dados que coletamos"],
  ["uso", "3. Para que usamos"],
  ["cookies", "4. Cookies"],
  ["compartilha", "5. Compartilhamento"],
  ["direitos", "6. Seus direitos"],
  ["seguranca", "7. Segurança"],
  ["retencao", "8. Por quanto tempo guardamos"],
  ["internacional", "9. Transferência internacional"],
  ["encarregado", "10. Encarregado (DPO)"],
  ["mudancas", "11. Mudanças"],
  ["contato", "12. Contato"],
] as const;

const DADOS = [
  { categoria: "Cadastro", exemplos: "Nome, e-mail, senha", origem: "Você informa" },
  {
    categoria: "Marca e operação",
    exemplos: "Dados da sua marca, clientes e números que você registra",
    origem: "Você informa",
  },
  {
    categoria: "Pagamento",
    exemplos: "Dados de cobrança, processados pelo provedor de pagamento",
    origem: "Você informa / provedor",
  },
  {
    categoria: "Uso",
    exemplos: "Páginas acessadas, ações no app, dispositivo, IP",
    origem: "Coleta automática",
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
              Os seus dados são seus. Esta política explica, sem enrolação, o que a Pólia coleta,
              para quê, com quem compartilha e como você controla tudo isso.
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
              <h2 id="controlador">1. Quem trata seus dados</h2>
              <p>
                O controlador dos seus dados é <Ph>[Razão social]</Ph>, CNPJ{" "}
                <Ph>[00.000.000/0001-00]</Ph>, com sede em <Ph>[endereço]</Ph>. É a gente quem
                decide como e por que seus dados são tratados.
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

              <h2 id="uso">3. Para que usamos (e com qual base legal)</h2>
              <ul>
                <li>
                  <strong className="text-[var(--ink)]">Operar a sua conta e o serviço</strong> ·
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
                    Enviar avisos importantes e, se você aceitar, novidades
                  </strong>{" "}
                  · base: consentimento / legítimo interesse.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Cumprir obrigações legais</strong> · base:
                  obrigação legal.
                </li>
              </ul>
              <p>A gente não vende os seus dados. Ponto.</p>

              <h2 id="cookies">4. Cookies</h2>
              <p>
                Usamos cookies essenciais (para você continuar logada) e, se você permitir,
                cookies de medição para entender o uso e melhorar o produto. Você controla isso no
                banner de cookies e nas configurações do navegador.{" "}
                <Ph>[Listar as ferramentas de analytics usadas.]</Ph>
              </p>

              <h2 id="compartilha">5. Com quem compartilhamos</h2>
              <p>
                Compartilhamos dados apenas com quem ajuda a Pólia a funcionar, e só o necessário:
              </p>
              <ul>
                <li>
                  Provedor de hospedagem e banco de dados{" "}
                  <Ph>[ex.: Supabase / provedor de nuvem]</Ph>
                </li>
                <li>
                  Provedor de pagamento <Ph>[ex.: Stripe / gateway]</Ph>
                </li>
                <li>
                  Ferramenta de e-mail e de medição <Ph>[preencher]</Ph>
                </li>
                <li>Autoridades, quando exigido por lei</li>
              </ul>
              <p>Esses parceiros tratam os dados como operadores, seguindo as nossas instruções.</p>

              <h2 id="direitos">6. Seus direitos (LGPD art. 18)</h2>
              <p>
                A qualquer momento você pode pedir para: confirmar se tratamos seus dados; acessar
                seus dados; corrigir dados incompletos ou errados; anonimizar, bloquear ou
                eliminar dados desnecessários; portar seus dados; eliminar dados tratados com base
                no consentimento; saber com quem compartilhamos; e revogar o consentimento. Para
                exercer, escreve pra gente (seção 12). A gente responde no prazo da lei.
              </p>

              <h2 id="seguranca">7. Segurança</h2>
              <p>
                Usamos medidas técnicas e organizacionais para proteger seus dados, como controle
                de acesso e criptografia em trânsito. Nenhum sistema é 100% infalível, mas a gente
                trata segurança como prioridade e avisa você e a ANPD se acontecer um incidente
                relevante.
              </p>

              <h2 id="retencao">8. Por quanto tempo guardamos</h2>
              <p>
                Guardamos seus dados enquanto a sua conta existir e pelo tempo necessário para
                cumprir obrigações legais. Ao cancelar, você pode pedir a exclusão; alguns dados
                podem ser mantidos por prazos legais <Ph>[definir prazos, ex.: fiscais por 5 anos]</Ph>.
              </p>

              <h2 id="internacional">9. Transferência internacional</h2>
              <p>
                Alguns parceiros podem processar dados fora do Brasil. Quando isso acontece,
                exigimos garantias adequadas de proteção, conforme a LGPD.{" "}
                <Ph>[Confirmar onde ficam os servidores.]</Ph>
              </p>

              <h2 id="encarregado">10. Encarregado (DPO)</h2>
              <p>
                Nosso encarregado pela proteção de dados é{" "}
                <Ph>[nome / e-mail do encarregado]</Ph>. É com quem você fala sobre qualquer
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
