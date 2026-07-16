import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, CircleCheck, Target } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AppEntryGateModal } from "@/components/site/AppEntryGateModal";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Pólia · Sua marca fatura mais quando você sabe quem ela é",
      },
      {
        name: "description",
        content:
          "Tudo começa no Planejamento: você decide quem sua marca é e isso vira preço, caixa, meta e o dia a dia do negócio. Uma decisão só, sem planilha por fora.",
      },
      {
        property: "og:title",
        content: "Pólia · Sua marca fatura mais quando você sabe quem ela é",
      },
      {
        property: "og:description",
        content: "Decidir quem sua marca é e ver quanto ela fatura no mesmo lugar.",
      },
    ],
  }),
  component: HomePage,
});

const mecanismo = [
  {
    n: "01",
    titulo: "Defina a marca",
    desc: "Quem ela atende, o que entrega e quanto cobra. Decidido, não chutado.",
  },
  {
    n: "02",
    titulo: "Veja a margem",
    desc: "Cada preço mostra o lucro que sobra antes de você fechar.",
  },
  {
    n: "03",
    titulo: "Marque a venda",
    desc: "Entregou, o dinheiro cai no caixa sozinho. Sem lançar de novo.",
  },
  {
    n: "04",
    titulo: "Acompanhe a meta",
    desc: "Saiba hoje se está no ritmo, não no fim do mês, quando não dá mais pra reagir.",
  },
];

const modulos = [
  {
    titulo: "É aqui que o negócio inteiro ganha forma",
    nomeModulo: "Planejamento",
    body: "Seis módulos onde você responde quem sua marca atende, o que entrega e quanto vale. Não é discurso de missão que morre na gaveta. É a decisão que define o seu preço, a sua meta e o rumo do negócio.",
    printLabel: "print do Planejamento",
  },
  {
    titulo: "Você vê o que sobra em cada venda",
    nomeModulo: "Produtos",
    body: "A margem de cada produto fica numa barra que você lê de relance, do lado do custo e do preço. O que sobra da venda para de ser achismo e vira número na frente do produto.",
    printLabel: "print de Produtos",
  },
  {
    titulo: "A entrega vira caixa sozinha",
    nomeModulo: "Clientes",
    body: "Marque que o produto ou serviço foi entregue e a venda entra sozinha no financeiro da empresa. Sem lançar de novo, sem abrir outra planilha.",
    printLabel: "print de Clientes",
  },
  {
    titulo: "O extrato deixa de ser surpresa",
    nomeModulo: "Financeiro",
    body: "Entradas, saídas e lucro do mês num lugar só, com uma régua que mostra onde você está entre o mês mínimo e o mês bom. Os marcos vêm do seu Planejamento, não de um número que você chutou.",
    printLabel: "print de Financeiro",
  },
  {
    titulo: "Você abre e já sabe quanto falta",
    nomeModulo: "Painel",
    body: "Receita do mês, pedidos, tarefas do dia e quanto falta pra fechar a meta, tudo na primeira tela. O número que decide o seu mês não fica escondido em aba nenhuma.",
    printLabel: "print do Painel",
  },
  {
    titulo: "O que precisa sair essa semana não se perde",
    nomeModulo: "Planner",
    body: "Quadro de projetos e tarefas pra organizar o que a semana pede, ligado à mesma meta que você definiu no Planejamento. Decisão boa não vale nada se a entrega se perde no meio do caminho.",
    printLabel: "print do Planner",
  },
];

const qualificacaoSim = [
  "Você já tem produto ou serviço rodando, mas ainda cobra no chute.",
  "Você cobra, mas trava quando alguém pergunta como chegou naquele preço.",
  "Sua conta pessoal e a da marca ainda são a mesma conta.",
  "Você decide sozinha e não tem ninguém pra confirmar se o número fecha.",
];

const qualificacaoNao = [
  "Você ainda não decidiu o que vai vender. A Pólia começa depois disso.",
  "Você procura ferramenta de anúncio ou automação de marketing. A Pólia não faz isso.",
  "Você tem equipe e processo já rodando. A Pólia é feita pra quem toca sozinha.",
];

function HomePage() {
  const { mostrarModal, escondendoHome, explorar } = useAppEntryGate();

  // App Android/iOS com sessão ativa (ou sessão ainda carregando): a Home de
  // marketing não deve piscar antes do redirect automático pro painel.
  if (escondendoHome) return null;

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      {mostrarModal && <AppEntryGateModal onExplorar={explorar} />}
      <SiteHeader />

      <main>
        {/* 1. HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
              <div>
                <h1 className="font-cabinet max-w-[20ch] text-[36px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[48px]">
                  Sua marca fatura mais quando você sabe quem ela é.
                </h1>
                <p className="mt-6 max-w-[60ch] text-[19px] leading-[1.55] text-[var(--ink-soft)] md:text-[21px]">
                  Tudo começa no Planejamento: você decide quem sua marca atende, o que entrega e
                  quanto vale. Essa decisão vira preço, caixa, meta e a rotina do dia a dia, tudo
                  ligado, sem planilha por fora.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    to="/precos"
                    data-track="cadastro_cta_clicado"
                    data-track-props='{"contexto":"hero"}'
                    className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                  >
                    Quero faturar
                  </Link>
                  <a
                    href="#como-funciona"
                    className="text-[16px] text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                  >
                    ver como funciona
                  </a>
                </div>
                <p className="mt-3 text-[13px] text-[var(--muted)]">
                  Ver planos e assinar · a partir de R$ 29/mês
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
                <img
                  src="/marketing/hero.png"
                  alt="Tela da Pólia mostrando o Planejamento da marca conectado ao preço e ao caixa"
                  className="h-full w-full object-cover"
                  width={1344}
                  height={752}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. FAIXA DE MECANISMO */}
        <section id="como-funciona" className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-white p-8 md:p-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                {mecanismo.map((passo) => (
                  <div key={passo.n}>
                    <span className="font-cabinet text-[28px] leading-none text-[var(--secondary-text)]">
                      {passo.n}
                    </span>
                    <h3 className="mt-3 text-[18px] text-[var(--ink)]">{passo.titulo}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                      {passo.desc}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-10 max-w-[60ch] border-t border-[var(--line)] pt-6 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                Um passo puxa o outro. A clareza que você tem no começo é o que vira dinheiro no
                fim.
              </p>
            </div>
          </div>
        </section>

        {/* 3. PROBLEMA/VILÃO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[0.95fr_1.05fr] md:gap-16">
              {/* TODO: ilustração humana da Sil */}
              <div
                aria-hidden="true"
                className="order-2 h-[280px] rounded-xl bg-[var(--accent)] md:order-1 md:h-[360px]"
              />
              <div className="order-1 md:order-2">
                <p className="max-w-[32ch] text-[22px] leading-[1.4] text-[var(--ink)] md:text-[26px]">
                  O problema quase nunca é falta de esforço. É tocar o negócio no escuro, uma
                  decisão de cada vez, sem ninguém juntando os números pra você.
                </p>
                <p className="mt-5 max-w-[54ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                  Preço definido olhando a concorrente. Gasto sem saber o que sobra. Cliente que
                  você corre atrás sem saber se dá lucro. Cada escolha dessas parece pequena, mas
                  junto elas decidem quanto entra no fim do mês. O preço é só onde a conta aparece
                  mais rápido: quem cobra no chute quase sempre lucra menos do que pensa.
                </p>
                <a
                  href="#tour"
                  className="mt-6 inline-block text-[16px] text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  Ver onde as decisões se juntam
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 4. TOUR DE MÓDULOS */}
        <section id="tour" className="relative overflow-hidden pb-12 md:pb-16">
          <img
            src="/marketing/moldura-modulos.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.06]"
          />
          <div className="relative mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Como funciona por dentro
            </p>
            <h2 className="mt-3 max-w-[28ch] text-[24px] text-[var(--ink)] md:text-[30px]">
              Seis telas, uma decisão que atravessa todas.
            </h2>

            <div className="mt-10 flex flex-col gap-16 md:gap-20">
              {modulos.map((m, i) => (
                <div
                  key={m.nomeModulo}
                  className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16"
                >
                  <div
                    className={i % 2 === 1 ? "md:order-2" : "md:order-1"}
                  >
                    <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--secondary-text)]">
                      {m.nomeModulo}
                    </p>
                    <h3 className="mt-2 max-w-[22ch] text-[22px] text-[var(--ink)] md:text-[26px]">
                      {m.titulo}
                    </h3>
                    <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                      {m.body}
                    </p>
                  </div>
                  <div className={i % 2 === 1 ? "md:order-1" : "md:order-2"}>
                    {/* TODO: print real de {m.printLabel} aqui, ver print capturado na sessão */}
                    <div
                      role="img"
                      aria-label={`Espaço reservado para ${m.printLabel}`}
                      className="flex h-[240px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[13px] text-[var(--muted)] md:h-[300px]"
                    >
                      {m.printLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 flex flex-col items-center gap-3">
              <Link
                to="/precos"
                data-track="cadastro_cta_clicado"
                data-track-props='{"contexto":"tour_modulos"}'
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                Quero faturar
              </Link>
              <p className="text-[13px] text-[var(--muted)]">
                Ver planos e assinar · a partir de R$ 29/mês
              </p>
            </div>

            {/* 4.6 reforço menor */}
            <div className="mt-16 grid grid-cols-1 gap-6 border-t border-[var(--line)] pt-10 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <ClipboardList
                  size={20}
                  className="mt-0.5 flex-none text-[var(--secondary-text)]"
                  aria-hidden="true"
                />
                <span className="text-[14px] leading-[1.5] text-[var(--ink-soft)]">
                  Calendário e Caderno
                </span>
              </div>
              <p className="text-[14px] leading-[1.6] text-[var(--ink-soft)] sm:col-span-2">
                Agenda e notas também ficam na Pólia, no mesmo lugar do preço, do caixa e do
                Planner.
              </p>
            </div>
          </div>
        </section>

        {/* 5. QUALIFICAÇÃO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-white p-8">
                <div className="flex items-center gap-3">
                  <CircleCheck
                    size={22}
                    className="flex-none text-[var(--secondary-text)]"
                    aria-hidden="true"
                  />
                  <h3 className="text-[19px] text-[var(--ink)]">
                    Pra quem já vende e quer enxergar o negócio inteiro
                  </h3>
                </div>
                <ul className="mt-5 flex flex-col gap-4">
                  {qualificacaoSim.map((item) => (
                    <li
                      key={item}
                      className="border-t border-[var(--line)] pt-4 text-[15px] leading-[1.6] text-[var(--ink-soft)] first:border-t-0 first:pt-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-white p-8">
                <div className="flex items-center gap-3">
                  <Target
                    size={22}
                    className="flex-none text-[var(--muted)]"
                    aria-hidden="true"
                  />
                  <h3 className="text-[19px] text-[var(--ink)]">Ainda não é pra você</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-4">
                  {qualificacaoNao.map((item) => (
                    <li
                      key={item}
                      className="border-t border-[var(--line)] pt-4 text-[15px] leading-[1.6] text-[var(--ink-soft)] first:border-t-0 first:pt-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 7. CTA FINAL */}
        <section className="relative overflow-hidden pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src="/marketing/fechamento.jpg"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[var(--ink)] opacity-40"
              />
              <div className="relative flex flex-col items-center gap-8 px-8 py-16 text-center md:py-24">
                <PoliaWordmark className="h-8 w-auto text-white md:h-10" />
                <h2 className="mx-auto max-w-[20ch] text-[28px] leading-[1.25] text-white md:text-[36px]">
                  Tocar o negócio sozinha não precisa ser no escuro.
                </h2>
                <div className="flex flex-col items-center gap-3">
                  <Link
                    to="/precos"
                    data-track="cadastro_cta_clicado"
                    data-track-props='{"contexto":"cta_final"}'
                    className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Quero faturar
                  </Link>
                  <p className="text-[13px] text-white/70">
                    Ver planos e assinar · a partir de R$ 29/mês
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
