import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, LineChart, Route as RouteIcon, Check, X } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PoliaWordmark, PoliaIcon } from "@/components/brand/PoliaLogo";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "A marca · Pólia" },
      {
        name: "description",
        content:
          "A história de quem largou um negócio que dava certo, no que a Pólia acredita e pra quem ela é feita. Clareza sobre a marca é o que faz ela faturar mais.",
      },
      { property: "og:title", content: "A marca · Pólia" },
      {
        property: "og:description",
        content: "Por que a Pólia existe, no que ela acredita, e pra quem é feita.",
      },
    ],
  }),
  component: SobrePage,
});

const pontos = [
  {
    icon: ClipboardList,
    titulo: "Tudo começa no Planejamento",
    desc: "Você decide quem a marca atende, o que entrega e quanto vale. Essa decisão vira o preço, a meta e o rumo do negócio.",
  },
  {
    icon: LineChart,
    titulo: "Os números aparecem na hora",
    desc: "Preço, margem, caixa e quanto falta pra meta num Painel que você abre e entende de relance. Sem planilha, sem susto no fim do mês.",
  },
  {
    icon: RouteIcon,
    titulo: "A execução não se perde",
    desc: "O Planner organiza o que a semana pede, ligado à mesma meta que você definiu. Decidir bem não adianta se a entrega se perde no caminho.",
  },
];

const marcos = [
  { ano: "2012", texto: "Abri meu primeiro negócio vendendo cosmético artesanal." },
  {
    ano: "2013",
    texto:
      "Migrei pra papelaria de casamento, no meio dos lacinhos e da plotter de recorte ligada o dia todo.",
  },
  {
    ano: "2016",
    texto:
      "Comecei a criar planner e caderno artesanal e entrei no CLT ao mesmo tempo, dividida entre o meu negócio e o emprego fixo.",
  },
  {
    ano: "2020",
    texto: "Fechei o e-commerce. Não faltava cliente, faltava estrutura.",
  },
  {
    ano: "2020 a 2022",
    texto: "Dei consultoria ensinando a criar loja virtual e definir estratégia de branding.",
  },
  {
    ano: "Nos anos seguintes",
    texto:
      "Trabalhei em grandes empresas como ArcelorMittal, Allied e C&A, e fiz um MBA em gestão de projetos com métodos ágeis. Foi ali que a ficha caiu: o que faltava era método, não disciplina.",
  },
  {
    ano: "Hoje",
    texto:
      "Estou trabalhando no Bradesco, estudo desenvolvimento com IA e construo, junto com vocês, a Pólia.",
  },
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

const recusa = [
  "Culpa quando você fica uns dias fora",
  "Meta no vermelho jogada como cobrança",
  "O “você sumiu, não desista”",
  "Hype: “transforme”, “fature 6 dígitos”",
  "Tutorial bobo, mascote, professora de cima",
  "Jargão e feature de empresa grande",
];

const escolhe = [
  "Clareza sobre quanto a marca vale",
  "O Planejamento intacto quando você voltar",
  "Dona da marca, nunca devedora dela",
  "O concreto: o preço que você decidiu",
  "Respeitar a sua inteligência, do seu lado",
  "Do tamanho de uma pessoa só",
];

const credo = [
  {
    linha: "Clareza vale mais que esforço.",
    texto:
      "Não é sobre fazer mil coisas todo dia. É sobre decidir o que importa: quem a marca atende, quanto ela cobra, o que sobra no fim do mês. Uma decisão dessas bem tomada rende mais que uma lista inteira de tarefas.",
  },
  {
    linha: "A gente puxa pela oportunidade, nunca pela culpa.",
    texto:
      "Se você ficou uns dias fora, o seu Planejamento está lá do jeito que você deixou, esperando sem cara feia. “Você sumiu, não desista” é cobrança disfarçada de incentivo, e a gente não usa. Você volta quando dá e continua de onde parou.",
  },
  {
    linha: "Dona da marca, nunca devedora dela.",
    texto:
      "A marca é sua, não uma dívida que cresce quando você para. A Pólia trata assim: você abre, decide uma coisa e sai com a sensação de quem manda no negócio. Nunca com a régua na mão e a conta pra pagar.",
  },
  {
    linha: "A gente respeita a sua inteligência.",
    texto:
      "Sem tutorial bobo, sem explicar o óbvio, sem mascote fazendo graça. Quem toca a marca sabe o que faz. A Pólia foi feita por quem já viveu isso e senta do lado, não a professora que fala de cima nem o app que te acha ingênua.",
  },
  {
    linha: "Comemora o concreto, não a promessa vazia.",
    texto:
      "Nada de “transforme seu negócio”, “fature 6 dígitos”, antes e depois de mentira. A Pólia comemora o concreto: o preço que você finalmente decidiu, a margem que apareceu, a meta do mês batida. Sobriedade é uma forma de respeito.",
  },
  {
    linha: "Do tamanho de uma pessoa só.",
    texto:
      "O time é uma pessoa só. Então nada de feature de equipe, jargão corporativo ou complexidade de ERP. A Pólia cabe na rotina de quem faz tudo sozinha, porque foi feita pra ela, não adaptada de uma ferramenta de empresa grande.",
  },
];

const valores = [
  {
    nome: "Clareza acima de esforço",
    desc: "Uma decisão bem tomada rende mais que um dia cheio de tarefas.",
  },
  {
    nome: "Oportunidade, nunca culpa",
    desc: "A Pólia convida, não cobra. Você volta quando dá e continua de onde parou.",
  },
  {
    nome: "Respeito à sua inteligência",
    desc: "Sem tutorial bobo, sem falar de cima. Feita por quem já tocou uma marca sozinha.",
  },
  {
    nome: "O concreto acima da promessa",
    desc: "Nada de “transforme seu negócio”. A Pólia mostra o preço que você decidiu e a meta que bateu, número real, não promessa de marketing.",
  },
  {
    nome: "Do tamanho de uma pessoa só",
    desc: "Sem feature de equipe nem complexidade de ERP. Cabe na rotina de quem faz tudo sozinha.",
  },
];

const publicoSim = [
  "Você já vende, mas ainda decide o preço no chute.",
  "Você faz tudo: entrega, financeiro, atendimento, conteúdo.",
  "A conta da marca e a sua conta pessoal ainda se misturam.",
  "Você quer método pra operação do dia a dia, não só marca bonita no papel.",
];

const publicoNao = [
  "Você ainda não decidiu o que vai vender.",
  "Você já tem equipe e processo rodando. A Pólia é pra quem toca sozinha.",
  "Você procura ferramenta de anúncio ou automação de marketing.",
];

const cores = [
  { nome: "Turquesa", hex: "#7CCBCD", uso: "Ação, botão, banner" },
  { nome: "Pêssego", hex: "#F3B9A9", uso: "Fundo, borda, gráfico" },
  { nome: "Amarelo", hex: "#FFC629", uso: "Indicador pontual" },
  { nome: "Tinta", hex: "#0A0A0A", uso: "Texto principal" },
  { nome: "Pedra", hex: "#F2F0ED", uso: "Fundo da marca" },
];

function SobrePage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A marca
                </p>
                <h1 className="font-cabinet mt-4 max-w-[20ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
                  Por que a Pólia existe.
                </h1>
                <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
                  A história de quem largou um negócio que dava certo, no que a Pólia acredita, e
                  pra quem ela é feita.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
                <img
                  src="/marketing/sobre-hero.png"
                  alt="Sil, fundadora da Pólia, trabalhando no notebook"
                  className="h-full w-full object-cover"
                  width={2224}
                  height={1664}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 1. SUA HISTÓRIA */}
        <section id="historia" className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              A história
            </p>
            <h2 className="font-cabinet mt-3 max-w-[18ch] text-[32px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
              A Pólia é a ferramenta que eu não tive.
            </h2>
          </div>
        </section>

        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--secondary)] p-8 md:p-12">
              <p className="font-cabinet max-w-[22ch] text-[30px] leading-[1.15] tracking-[-0.02em] text-[var(--secondary-ink)] md:text-[44px]">
                Meu negócio vendia bem. Eu só não sabia quanto sobrava.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Comecei em 2012 vendendo cosmético artesanal, e nos anos seguintes o negócio foi
              mudando de cara comigo. Virou papelaria de casamento, com lacinho feito à mão e a
              plotter de recorte ligada o dia todo. Depois virou planner e caderno artesanal, os
              mesmos nomes que hoje batizam dois módulos da Pólia. A partir de 2016 eu tocava a
              marca de um lado e um emprego CLT do outro, dividida entre o meu negócio e o crachá
              de todo dia. Cada fase vendia, faturava, os números da frente iam bem. O que
              ninguém via era o fundo: eu não conseguia me organizar. As finanças viviam no
              susto, cada mês era um remendo, e chegou uma hora em que dar certo em venda não
              segurava mais um negócio que eu não conseguia organizar por dentro. Em 2020 eu
              fechei o e-commerce. Não por falta de cliente. Por falta de estrutura minha.
            </p>
            <p className="mt-6 text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Demorei pra entender que aquilo não era defeito meu. Era falta de método, e ninguém
              tinha me dado um.
            </p>
          </div>
        </section>

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

        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[720px] px-6">
            <div className="rounded-xl bg-[var(--surface-pink)] p-8">
              <p className="font-cabinet max-w-[22ch] text-[30px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
                Não faltou cliente. Faltou clareza sobre o meu próprio negócio.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="max-w-[720px]">
              <h3 className="text-[24px] text-[var(--ink)] md:text-[30px]">
                Foi isso que virou a Pólia.
              </h3>
              <p className="mt-3 max-w-[60ch] text-[var(--ink-soft)]">
                A Pólia é o que eu não tive: um lugar onde as decisões da marca, o preço, o caixa
                e a rotina moram juntos, sem planilha por fora.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {pontos.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.titulo} className="rounded-xl border border-[var(--line)] bg-white p-8">
                    <Icon size={24} className="text-[var(--secondary-ink)]" aria-hidden="true" />
                    <h4 className="mt-3 text-[18px] text-[var(--ink)]">{p.titulo}</h4>
                    <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

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

        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Eu construo a Pólia usando ela na minha própria marca. Sou a primeira usuária do meu
              produto, e isso me obriga a ser honesta: se uma tela mente sobre o seu dinheiro, eu
              percebo primeiro.
            </p>
            <p className="mt-6 text-[18px] leading-[1.65] text-[var(--ink-soft)]">
              Quem toca a marca sozinha, eu sei como é. Passei dez anos aprendendo, na
              marra, o método que devia ter existido desde o começo. A Pólia é pra ninguém
              precisar dos dez anos que eu levei. É pra você decidir com clareza desde agora.
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
            <div className="mt-8 flex flex-wrap gap-3">
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

        {/* 2. MANIFESTO */}
        <section id="manifesto" className="pb-12 pt-4 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Manifesto
            </p>
            <h2 className="font-cabinet mt-3 max-w-[20ch] text-[32px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
              A gente acredita em clareza, não em cobrança.
            </h2>
            <p className="mt-5 max-w-[60ch] text-[18px] leading-[1.5] text-[var(--ink-soft)]">
              A maioria das ferramentas te motiva com medo: o app que te cobra quando você some
              uns dias, o vermelho da meta jogado na sua cara, o “faz tempo que você não
              aparece”. A Pólia recusa isso por inteiro. Aqui vai o que a gente defende.
            </p>
            <div className="mt-8 overflow-hidden rounded-xl border border-[var(--line)]">
              <img
                src="/marketing/sobre-manifesto.jpg"
                alt=""
                aria-hidden="true"
                className="h-[220px] w-full object-cover md:h-[320px]"
                width={2224}
                height={1664}
              />
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A Pólia recusa
                </p>
                <ul className="mt-4 grid list-none gap-3 p-0">
                  {recusa.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.4] text-[var(--ink)]">
                      <X size={18} className="mt-0.5 flex-none text-[var(--muted)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--surface-pink)] bg-[var(--surface-pink)] p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A Pólia escolhe
                </p>
                <ul className="mt-4 grid list-none gap-3 p-0">
                  {escolhe.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.4] text-[var(--ink)]">
                      <Check size={18} className="mt-0.5 flex-none text-[var(--secondary-ink)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[760px] px-6">
            {credo.map((item, i) => (
              <div key={item.linha} className={`py-12 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 max-w-[20ch] text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
                  {item.linha}
                </p>
                <p className="mt-4 max-w-[54ch] text-[var(--ink-soft)]">{item.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--secondary)] p-8 text-center md:p-12">
              <p className="font-fraunces mx-auto max-w-[24ch] text-[26px] italic leading-[1.3] text-[var(--secondary-ink)]">
                “Quando a marca fica clara, o dinheiro para de escapar.”
              </p>
              <p className="mt-4 text-[15px] text-[var(--secondary-ink)] opacity-75">
                O que toda tela da Pólia foi feita pra provar.
              </p>
            </div>
          </div>
        </section>

        {/* 3. MISSÃO, VISÃO E VALORES */}
        <section id="missao" className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              No que a gente se apoia
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-white p-8">
                <h3 className="text-[19px] text-[var(--ink)]">Missão</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                  Dar pra quem toca a marca sozinha a clareza de decidir bem e faturar mais: quem
                  a marca atende, quanto ela cobra e quanto sobra, tudo num lugar só.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white p-8">
                <h3 className="text-[19px] text-[var(--ink)]">Visão</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                  Que nenhuma empreendedora precise largar um negócio que dá certo por falta de
                  método. Que decidir o preço, ver o caixa e tocar a rotina seja simples pra quem
                  faz tudo sozinha.
                </p>
              </div>
            </div>

            <h3 className="mt-10 text-[19px] text-[var(--ink)]">Valores</h3>
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {valores.map((v) => (
                <div key={v.nome}>
                  <p className="text-[16px] font-semibold text-[var(--ink)]">{v.nome}</p>
                  <p className="mt-1 text-[15px] leading-[1.5] text-[var(--ink-soft)]">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. PRA QUEM É A PÓLIA */}
        <section id="publico" className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Pra quem é
            </p>
            <p className="mt-4 max-w-[70ch] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
              A Pólia é feita pra empreendedora que toca a própria marca sozinha e já saiu do
              zero. Você tem produto ou serviço rodando, cliente chegando, e agora quer
              profissionalizar a operação em vez de tocar tudo no improviso. O seu gargalo não é
              ideia de marca, é o dia a dia de fazer o negócio girar sem largar dinheiro pelo
              caminho.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-[17px] text-[var(--ink)]">É você se:</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {publicoSim.map((item) => (
                    <li key={item} className="text-[15px] leading-[1.5] text-[var(--ink-soft)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[17px] text-[var(--ink)]">Provavelmente não é pra você se:</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {publicoNao.map((item) => (
                    <li key={item} className="text-[15px] leading-[1.5] text-[var(--ink-soft)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 5. IDENTIDADE VISUAL */}
        <section id="identidade-visual" className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Identidade visual
            </p>
            <p className="mt-4 max-w-[70ch] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
              A Pólia tem cara de coisa feita à mão, não de sistema. O logotipo e as cores quentes
              seguem a mesma ideia do produto: acolher quem toca o negócio sozinha, sem parecer
              painel de banco.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-center justify-center rounded-xl border border-[var(--line)] bg-white p-12">
                <PoliaWordmark className="h-10 w-auto text-[var(--ink)]" />
              </div>
              <div className="flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--ink)] p-12">
                <PoliaIcon className="h-16 w-auto text-white" />
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {cores.map((c) => (
                <div key={c.nome}>
                  <div
                    className="h-16 w-full rounded-lg border border-[var(--line)]"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{c.nome}</p>
                  <p className="text-[13px] text-[var(--muted)]">{c.hex}</p>
                  <p className="text-[12px] text-[var(--muted)]">{c.uso}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative overflow-hidden pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src="/marketing/sobre-fechamento.jpg"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-[var(--ink)] opacity-40" />
              <div className="relative flex flex-col items-center gap-8 px-8 py-16 text-center md:py-24">
                <PoliaWordmark className="h-8 w-auto text-white md:h-10" />
                <h2 className="mx-auto max-w-[16ch] text-[28px] leading-[1.25] text-white md:text-[36px]">
                  A marca clara é a que fatura. Comece pela sua.
                </h2>
                <Link
                  to="/"
                  hash="planos"
                  className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Começar de graça
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
