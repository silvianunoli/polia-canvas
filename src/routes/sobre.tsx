import { createFileRoute, Link } from "@tanstack/react-router";
import { Route as RouteIcon, Target, Clock } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre · Pólia" },
      {
        name: "description",
        content:
          "A Pólia te ajuda a construir a sua marca, uma etapa de cada vez, no seu tempo. A história de quem largou um negócio que dava certo e passou dez anos aprendendo o método que faltava.",
      },
      { property: "og:title", content: "Sobre · Pólia" },
      {
        property: "og:description",
        content: "A história de quem largou um negócio que dava certo pra construir o método que faltava.",
      },
    ],
  }),
  component: SobrePage,
});

const pontos = [
  {
    icon: RouteIcon,
    titulo: "Sua marca vira uma trilha",
    desc: "O todo quebrado em etapas curtas, na ordem que faz sentido. Uma coisa de cada vez.",
  },
  {
    icon: Target,
    titulo: "A Aimer aponta o próximo passo",
    desc: "A assistente lê o seu momento e mostra a próxima etapa pequena, pra nunca travar sem saber o que fazer.",
  },
  {
    icon: Clock,
    titulo: "A marca segue no ritmo dela",
    desc: "Continua de onde parou, no seu tempo. Dona da marca, nunca devedora dela.",
  },
];

const marcos = [
  { ano: "2012", texto: "Abri meu e-commerce, do zero." },
  { ano: "2020", texto: "Larguei, mesmo vendendo bem. Não faltava cliente, faltava estrutura." },
  {
    ano: "Nos anos seguintes",
    texto:
      "Trabalhei em grandes empresas como ArcelorMittal, Allied e C&A, e fiz um MBA em gestão de projetos com métodos ágeis. Foi ali que a ficha caiu: o que faltava era método, não disciplina.",
  },
  { ano: "Hoje", texto: "Estou no Bradesco, estudo desenvolvimento com IA e construo a Pólia." },
];

const naoE = [
  "Coach que promete faturamento e some depois.",
  "Curso que fica pela metade e cai no esquecimento.",
  "App neutro de produtividade, sem cara e sem direção.",
  "Ferramenta de empresa grande adaptada pra fingir que serve.",
];

const formacao = [
  "Publicidade e propaganda",
  "Pós em gestão de e-commerce",
  "MBA em gestão de projetos ágeis",
  "Desenvolvimento com IA",
];

function SobrePage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Sobre
            </p>
            <h1 className="font-cabinet mt-4 max-w-[16ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              A Pólia é a ferramenta que eu não tive.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              Antes dela, eu larguei um negócio que dava certo. Esta é a história de por quê, e do
              que eu construí pra você não passar pelo mesmo.
            </p>
          </div>
        </section>

        {/* BLOCO DE ABERTURA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--secondary)] p-8 md:p-12">
              <p className="max-w-[22ch] text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--secondary-ink)] md:text-[44px]">
                Eu já tive um negócio que deu certo. E larguei mesmo assim.
              </p>
            </div>
          </div>
        </section>

        {/* HISTÓRIA · PARTE 1 */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Foi um e-commerce, de 2012 a 2020. Ele vendia, faturava, os números da frente iam
              bem. O que ninguém via era o fundo: eu não conseguia me organizar. As finanças
              viviam no susto, cada mês era um remendo, e chegou uma hora em que dar certo em
              venda não segurava mais um negócio que eu não conseguia organizar por dentro. Então
              eu parei. Não por falta de cliente. Por falta de estrutura minha.
            </p>
            <p className="mt-6 text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Demorei pra entender que aquilo não era defeito meu. Era falta de método, e ninguém
              tinha me dado um.
            </p>
          </div>
        </section>

        {/* NÚMEROS-ÂNCORA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="font-cabinet text-[40px] leading-none tracking-[-0.02em] text-[var(--ink)]">
                  8
                </div>
                <div className="mt-2 text-[14px] text-[var(--muted)]">anos de e-commerce</div>
              </div>
              <div>
                <div className="font-cabinet text-[40px] leading-none tracking-[-0.02em] text-[var(--ink)]">
                  10
                </div>
                <div className="mt-2 text-[14px] text-[var(--muted)]">anos atrás do método</div>
              </div>
              <div>
                <div className="font-cabinet text-[40px] leading-none tracking-[-0.02em] text-[var(--ink)]">
                  4
                </div>
                <div className="mt-2 text-[14px] text-[var(--muted)]">grandes marcas na bagagem</div>
              </div>
            </div>
          </div>
        </section>

        {/* LINHA DO TEMPO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              O caminho até aqui
            </p>
            <ul className="list-none">
              {marcos.map((m, i) => (
                <li
                  key={m.ano}
                  className={`relative border-l-2 py-0 pb-8 pl-8 ${
                    i === marcos.length - 1 ? "border-transparent pb-0" : "border-[var(--line)]"
                  }`}
                >
                  <span className="absolute -left-[7px] top-[3px] h-3 w-3 rounded-[3px] bg-[var(--secondary)]" />
                  <span className="block text-[18px] font-semibold text-[var(--ink)]">
                    {m.ano}
                  </span>
                  <p className="mt-1 text-[var(--ink-soft)]">{m.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* PULL QUOTE */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <div className="rounded-xl bg-[var(--surface-pink)] p-8">
              <p className="max-w-[22ch] text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
                Meu negócio não morreu por falta de venda. Morreu por falta de método, e de
                alguém do lado.
              </p>
            </div>
          </div>
        </section>

        {/* O QUE VIROU A PÓLIA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="max-w-[720px]">
              <h2 className="text-[24px] text-[var(--ink)] md:text-[30px]">
                Foi isso que virou a Pólia.
              </h2>
              <p className="mt-3 max-w-[60ch] text-[var(--ink-soft)]">
                A Pólia é o que eu não tive: uma ferramenta que te ajuda a construir a sua marca,
                uma etapa de cada vez, no seu tempo.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {pontos.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.titulo} className="rounded-xl border border-[var(--line)] bg-white p-8">
                    <Icon size={24} className="text-[var(--secondary-ink)]" aria-hidden="true" />
                    <h3 className="mt-3 text-[18px] text-[var(--ink)]">{p.titulo}</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* O QUE NÃO É */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-white p-8">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                O que a Pólia não é
              </p>
              <ul className="mt-4 list-none">
                {naoE.map((item) => (
                  <li key={item} className="relative mt-3 pl-6 text-[var(--ink-soft)]">
                    <span className="absolute left-0 top-[10px] h-[10px] w-[10px] rounded-[2px] bg-[var(--accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* HONESTIDADE + FORMAÇÃO + ASSINATURA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Eu construo a Pólia usando ela na minha própria marca. Sou a primeira usuária do meu
              produto, e isso me obriga a ser honesta: se uma tela mente sobre o seu avanço, eu
              percebo primeiro.
            </p>
            <p className="mt-6 text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Quem toca a marca sozinha, eu sei como é. Passei dez anos aprendendo, na
              marra, o método que devia ter existido desde o começo. A Pólia é pra ninguém
              precisar dos dez anos. Só da próxima etapa, no seu tempo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {formacao.map((f) => (
                <span
                  key={f}
                  className="rounded-[4px] bg-[var(--surface-pink)] px-3 py-1 text-[14px] text-[var(--ink-soft)]"
                >
                  {f}
                </span>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="font-cabinet flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)] text-[22px] text-[var(--accent-ink)]">
                S
              </div>
              <div>
                <p className="m-0 font-semibold text-[var(--ink)]">por Sil</p>
                <p className="m-0 text-[14px] text-[var(--muted)]">fundadora da Pólia</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <h2 className="mx-auto max-w-[18ch] text-[32px] text-[var(--ink)] md:text-[40px]">
              Quer ver a Pólia funcionando?
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/"
                hash="como-funciona"
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
              >
                Ver como a Pólia funciona
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
