import { createFileRoute, Link } from "@tanstack/react-router";
import { linkCanonico, urlCanonica } from "@/lib/seo";
import { jsonLdAboutPage, jsonLdPersonSil, tagJsonLd } from "@/lib/jsonld";
import { ClipboardList, LineChart, Route as RouteIcon, Check, X } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import {
  CONTAINER,
  SECAO,
  BTN_PRIMARIO,
  BTN_CONTORNO,
  Eyebrow,
  Pullquote,
} from "@/components/site/Editorial";

const TITULO_SOBRE = "A história da Pólia · Por que ela existe";
const DESCRICAO_SOBRE =
  "Meu negócio vendia bem. Eu só não sabia quanto sobrava. A história da Pólia, aquilo em que ela acredita e pra quem ela é feita.";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: TITULO_SOBRE },
      { name: "description", content: DESCRICAO_SOBRE },
      { property: "og:title", content: "A história · Pólia" },
      {
        property: "og:description",
        content: "Por que a Pólia existe, no que ela acredita, e pra quem é feita.",
      },
    ],
    links: [linkCanonico("/sobre")],
    // AboutPage (a página conta a história da empresa) + Person da Sil (a
    // fundadora, citada e fotografada na própria página) — só campos já
    // públicos aqui e em `/lista-de-espera`/assinatura dos posts.
    scripts: [
      tagJsonLd(
        jsonLdAboutPage({
          nome: TITULO_SOBRE,
          url: urlCanonica("/sobre"),
          descricao: DESCRICAO_SOBRE,
        }),
      ),
      tagJsonLd(jsonLdPersonSil()),
    ],
  }),
  component: SobrePage,
});

// Copy V4 (14/09/2026). A história da Sil explica por que a Pólia existe sem
// fazer a página parecer "a ferramenta pessoal da Sil": eu vivi o problema,
// entendi o que faltava e transformei o método em produto pra outras
// empreendedoras. Três frases-âncora: "Eu vendia bem e não sabia quanto sobrava",
// "Não faltou esforço. Faltou método." e "A decisão continua sendo de quem toca
// o negócio."

const numeros = [
  { valor: "14", rotulo: "anos de e-commerce" },
  { valor: "8", rotulo: "anos de negócio próprio" },
  // Três, não quatro: só C&A, Allied e ArcelorMittal são nomeadas na linha do
  // tempo, e o emprego atual fica fora da copy pública.
  { valor: "3", rotulo: "grandes marcas na bagagem" },
];

// A saída do e-commerce nunca entra como fracasso, o emprego atual fica fora da
// copy pública e diploma não é argumento de autoridade aqui: a linha do tempo
// carrega isso sozinha. Guardrails travados no Manual da Marca.
const marcos = [
  { ano: "2012", texto: "Primeiro negócio: cosmético artesanal." },
  {
    ano: "2013",
    texto: "Papelaria de casamento, no meio dos lacinhos e da plotter ligada o dia todo.",
  },
  {
    ano: "2016",
    texto:
      "Planner e caderno artesanal, tocados junto com um emprego fixo, o negócio rodando nas brechas do dia.",
  },
  {
    ano: "2020",
    texto:
      "Encerrei o e-commerce com cliente chegando e as contas sem fechar. O que faltou ali tem nome: método. E acabou virando a razão de existir da Pólia.",
  },
  {
    ano: "2020 a 2022",
    texto:
      "Consultoria para quem estava montando loja virtual e definindo a estratégia da própria marca.",
  },
  {
    ano: "Depois",
    texto:
      "Dentro de grandes empresas, como C&A, Allied e ArcelorMittal, vi de perto o método que marcas grandes usam para decidir. A ficha caiu: era isso que faltava do outro lado do balcão.",
  },
  {
    ano: "Hoje",
    texto: "A Pólia está sendo construída em público e testada primeiro na minha própria marca.",
  },
];

const entendi = [
  "Eu sabia vender.",
  "Sabia construir marca.",
  "Sabia trabalhar.",
  "Mas preço, caixa, metas e rotina ficavam espalhados.",
];

const pontos = [
  {
    icon: ClipboardList,
    titulo: "Tudo começa no Planejamento",
    desc: "A marca decide quem atende, o que entrega e quanto vale. Essa decisão vira preço, meta e rumo para o negócio.",
  },
  {
    icon: LineChart,
    titulo: "Os números aparecem na hora",
    desc: "Preço, quanto sobra, caixa e quanto falta para a meta aparecem em um painel que dá para entender de relance. Sem planilha perdida. Sem esperar o fim do mês para descobrir o que aconteceu.",
  },
  {
    icon: RouteIcon,
    titulo: "A execução não se perde",
    desc: "O Planner organiza o que a semana pede, ligado às metas definidas no Planejamento. Porque decidir bem também significa conseguir colocar a decisão em prática.",
  },
];

// Era "O que a Pólia não é", uma lista que atacava coach e curso. Numa página
// cujo único trabalho é gerar confiança, atacar o vizinho gasta o espaço que
// deveria dizer o que a marca é. "Mentora de bolso" saiu em 14/09: aproximava
// a Pólia de uma categoria que ela não quer ocupar.
const escolheSer = [
  {
    titulo: "Do tamanho de quem toca o negócio.",
    desc: "Sozinha, com a família ou com poucas mãos ajudando. A Pólia não foi feita para exigir a estrutura de uma empresa grande.",
  },
  {
    titulo: "Clara o suficiente para usar todos os dias.",
    desc: "Em português claro, sem fazer da gestão um idioma que só especialista entende.",
  },
  {
    titulo: "Conectada ao que realmente importa.",
    desc: "Planejamento, preço, vendas, caixa, metas e rotina não precisam morar em lugares diferentes.",
  },
  {
    titulo: "Feita para ajudar a decidir.",
    desc: "A Pólia organiza os números e mostra o cenário. A decisão continua sendo de quem toca o negócio.",
  },
];

const primeiraUsuaria = [
  "Se uma tela não ajuda a entender o dinheiro da minha marca, eu percebo primeiro.",
  "Se uma conta não faz sentido, eu encontro.",
  "Se uma ferramenta complica mais do que resolve, ela não está pronta.",
];

const recusa = [
  "Meta usada como cobrança",
  "Promessa de dinheiro fácil",
  "Hype com número mágico",
  "Linguagem infantilizada",
  "Falar com a empreendedora como se ela não entendesse do próprio negócio",
  "Dificuldade financeira virando motivação vazia",
];

const escolhe = [
  "Clareza sobre quanto a marca vale",
  "Números que ajudam a decidir",
  "Planejamento conectado à rotina",
  "Informação disponível na hora de cobrar, comprar ou fechar",
  "Progresso real",
];

const credo = [
  {
    linha: "Clareza vale mais que esforço.",
    texto:
      "Decidir o que importa, quem a marca atende, quanto ela cobra e o que sobra no fim do mês pode fazer mais diferença do que uma lista inteira de tarefas feitas no braço.",
  },
  {
    linha: "A gente puxa pela oportunidade, nunca pela culpa.",
    texto:
      "Se você ficou alguns dias sem abrir a Pólia, ela não precisa fazer cara feia. Você abre e continua de onde parou.",
  },
  {
    linha: "Dona da marca, nunca devedora dela.",
    texto:
      "A marca é sua. A Pólia existe para ajudar você a entendê-la e decidir sobre ela, não para fazer do negócio mais uma fonte de cobrança.",
  },
  {
    linha: "A gente respeita a sua inteligência.",
    texto:
      "Sem tutorial bobo. Sem explicar o óbvio. Sem falar de cima. Quem toca a marca já sabe muita coisa. A Pólia existe para organizar o que está espalhado e tornar os números mais claros.",
  },
  {
    linha: "A gente comemora o concreto, não a promessa vazia.",
    texto:
      "O preço que finalmente saiu do chute. O quanto sobra que apareceu. A meta que foi alcançada. Progresso real merece mais atenção que promessa grande.",
  },
  {
    linha: "Do tamanho de quem decide, não do tamanho da equipe.",
    texto:
      "Uma pessoa sozinha pode precisar da mesma clareza que uma pequena equipe. A Pólia não mede a importância do negócio pelo tamanho da estrutura.",
  },
];

const publicoSim = [
  "O negócio já vende, mas o preço ainda sai no chute.",
  "Você quer saber quanto realmente sobra.",
  "Preço, financeiro, atendimento e rotina passam pelas mesmas mãos.",
  "Você quer organizar o negócio sem precisar montar uma estrutura de empresa grande.",
  "Você quer entender os números sem virar especialista em planilhas.",
];

const publicoNao = [
  "Você ainda não sabe o que quer vender.",
  "Sua empresa já tem uma estrutura robusta de gestão funcionando.",
  "Você procura uma ferramenta de anúncios ou automação de marketing.",
];

function SobrePage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main id="conteudo">
        {/* HERO */}
        <section className="pb-[clamp(48px,6vw,72px)] pt-[clamp(48px,7vw,96px)]">
          <div
            className={`${CONTAINER} grid grid-cols-1 items-center gap-[clamp(32px,5vw,72px)] md:grid-cols-[1.05fr_0.95fr]`}
          >
            <div>
              <Reveal>
                <Eyebrow>A história da Pólia</Eyebrow>
              </Reveal>
              <h1 className="mt-4 text-[clamp(2.4rem,5.4vw,4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Meu negócio vendia bem. Eu só não sabia quanto sobrava.
              </h1>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                  Foram oito anos vendendo, mudando de negócio e tentando fazer a conta fechar. O
                  que faltou não foi cliente. Faltou método. E foi desse problema que nasceu a
                  Pólia.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.15} y={28}>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                {/* Elemento de LCP da página: carrega cedo e com prioridade,
                    nunca lazy. O PNG de 809KB fica só como fallback do WebP. */}
                {/* block + tamanho no <picture>: ele é inline por padrão, e sem
                    isso o h-full/w-full do <img> passaria a medir contra ele em
                    vez do container, mudando o enquadramento. */}
                <picture className="block h-full w-full">
                  <source
                    srcSet="/marketing/sobre-hero-1024.webp"
                    type="image/webp"
                    media="(min-width: 641px)"
                  />
                  <source srcSet="/marketing/sobre-hero-640.webp" type="image/webp" />
                  <img
                    src="/marketing/sobre-hero.png"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                    width={2224}
                    height={1664}
                    decoding="async"
                    loading="eager"
                    fetchPriority="high"
                  />
                </picture>
              </div>
            </Reveal>
          </div>
        </section>

        {/* A HISTÓRIA */}
        <section id="historia" className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <h2 className="max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A Pólia é a ferramenta{" "}
                <span className="whitespace-nowrap">
                  <HighlightWord delay={0.3}>que eu não tive</HighlightWord>.
                </span>
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mt-[clamp(40px,5vw,56px)]">
              <Pullquote>Cada fase vendia. O fundo é que nunca fechava.</Pullquote>
            </Reveal>

            <div className="mx-auto mt-[clamp(40px,5vw,56px)] max-w-[68ch]">
              <Reveal>
                <p className="text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                  Comecei em 2012 vendendo cosmético artesanal. Depois, o negócio virou papelaria de
                  casamento, com lacinho feito à mão e a plotter de recorte ligada o dia todo. Mais
                  tarde, virou planner e caderno artesanal, os mesmos nomes que hoje batizam duas
                  áreas da Pólia.
                </p>
                <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                  Cada fase vendia. Os números da frente iam bem. O que ninguém via era o fundo: as
                  finanças no susto, cada mês um remendo, a conta da casa misturada com a conta do
                  negócio.{" "}
                  <b className="font-semibold text-[var(--ink)]">
                    Eu vendia bem e não sabia quanto sobrava.
                  </b>
                </p>
                <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                  Demorei para entender que aquilo não era defeito meu. Era falta de método. E
                  ninguém tinha me dado um.
                </p>
              </Reveal>

              <RevealGroup className="mt-[clamp(40px,5vw,56px)] grid grid-cols-3 gap-6 border-y border-[var(--line)] py-8">
                {numeros.map((n) => (
                  <RevealItem key={n.rotulo}>
                    <p className="text-[clamp(2rem,4vw,2.8rem)] font-bold leading-none tracking-[-0.02em]">
                      {n.valor}
                    </p>
                    <p className="mt-2 text-[14px] leading-[1.4] text-[var(--ink-soft)]">
                      {n.rotulo}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>

              <div className="mt-[clamp(40px,5vw,56px)]">
                <Reveal>
                  <h3 className="text-[clamp(1.4rem,2.4vw,1.9rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
                    De vender no improviso a construir um método.
                  </h3>
                </Reveal>
                <ul className="mt-6 list-none">
                  {marcos.map((m, i) => (
                    <li
                      key={m.ano}
                      className={`relative border-l-2 pb-8 pl-8 ${
                        i === marcos.length - 1 ? "border-transparent pb-0" : "border-[var(--line)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute -left-[7px] top-[3px] h-3 w-3 rounded-[3px] bg-[var(--secondary)]"
                      />
                      <span className="block text-[17px] font-semibold">{m.ano}</span>
                      <p className="mt-1 leading-[1.65] text-[var(--ink-soft)]">{m.texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Reveal className="mt-[clamp(48px,6vw,72px)]">
              <Pullquote tom="pessego">Não faltou esforço. Faltou método.</Pullquote>
            </Reveal>
          </div>
        </section>

        {/* O QUE EU ENTENDI */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div
            className={`${CONTAINER} grid grid-cols-1 items-start gap-[clamp(32px,5vw,80px)] md:grid-cols-[1.1fr_0.9fr]`}
          >
            <Reveal>
              <Eyebrow>O que eu entendi</Eyebrow>
              <h2 className="mt-4 max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Não faltava esforço. Faltava conseguir enxergar o negócio inteiro.
              </h2>
            </Reveal>
            <div>
              <RevealGroup className="flex flex-col gap-1">
                {entendi.map((linha) => (
                  <RevealItem key={linha}>
                    <p className="text-[18px] font-semibold leading-[1.6] text-[var(--ink)]">
                      {linha}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-[48ch] text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                  E quando os números não estão juntos, cada decisão vira uma aposta.
                </p>
                <p className="mt-6 max-w-[48ch] border-l-2 border-[var(--secondary)] pl-5 text-[17px] leading-[1.7] text-[var(--ink)]">
                  Foi daí que veio a ideia da Pólia: juntar o que precisa estar junto para que quem
                  toca o negócio consiga decidir melhor.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* O QUE VIROU A PÓLIA */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[60ch]">
              <Eyebrow>O que virou</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Foi isso que virou a Pólia.
              </h2>
              <p className="mt-4 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                A Pólia é o lugar onde planejamento, preço, caixa, metas e rotina trabalham juntos.
              </p>
              <p className="mt-4 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                Primeiro, a marca deixa claro quem atende, o que entrega e quanto vale. Depois, essa
                decisão vira número: quanto custa, quanto cobrar, quanto sobra e quanto precisa
                entrar. E esses números acompanham a rotina do negócio.
              </p>
              <p className="mt-6 text-[clamp(1.2rem,1.9vw,1.5rem)] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--ink)]">
                <span className="block">O número dá chão para a decisão.</span>
                <span className="block">A marca dá sentido para o que está sendo construído.</span>
              </p>
            </Reveal>

            {/* Timeline vertical em vez de 3 cards idênticos (mesmo tratamento
                visual usado nos "marcos" da seção "A história", acima): os
                três pontos são um fluxo em sequência (Planejamento → números
                → execução), não features soltas para caixinhas separadas. */}
            <ul className="mt-[clamp(40px,5vw,48px)] max-w-[64ch] list-none">
              {pontos.map((p, i) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.titulo}
                    className={`relative border-l-2 pb-8 pl-8 ${
                      i === pontos.length - 1 ? "border-transparent pb-0" : "border-[var(--line)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[7px] top-[3px] h-3 w-3 rounded-[3px] bg-[var(--secondary)]"
                    />
                    <div className="flex items-center gap-2.5">
                      <Icon size={20} className="text-[var(--secondary-text)]" aria-hidden="true" />
                      <h3 className="text-[18px] font-bold tracking-[-0.01em]">{p.titulo}</h3>
                    </div>
                    <p className="mt-2 leading-[1.6] text-[var(--ink-soft)]">{p.desc}</p>
                  </li>
                );
              })}
            </ul>

            <Reveal className="mx-auto mt-[clamp(40px,5vw,48px)] max-w-[68ch]">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
                <Eyebrow>O que a Pólia escolhe ser</Eyebrow>
                <ol className="mt-2 list-none">
                  {escolheSer.map((item, i) => (
                    <li
                      key={item.titulo}
                      className={`flex gap-4 py-5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}
                    >
                      <span className="font-accent pt-[3px] text-[12px] font-bold tracking-[0.1em] text-[var(--secondary-text)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-[17px] font-bold tracking-[-0.01em]">{item.titulo}</p>
                        <p className="mt-1.5 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </section>

        {/* A PRIMEIRA USUÁRIA */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={`${CONTAINER} max-w-[68ch]`}>
            <Reveal>
              <Eyebrow>A primeira usuária</Eyebrow>
              <h2 className="mt-4 max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Eu construo a Pólia usando a Pólia.
              </h2>
              <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                Sou a primeira usuária do meu próprio produto. Isso me obriga a ser honesta.
              </p>
              <ul className="mt-5 flex list-none flex-col gap-2">
                {primeiraUsuaria.map((linha) => (
                  <li key={linha} className="flex items-start gap-3 text-[17px] leading-[1.6]">
                    <span
                      aria-hidden="true"
                      className="mt-[11px] h-[6px] w-[6px] flex-none rounded-full bg-[var(--secondary)]"
                    />
                    {linha}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                A Pólia não está sendo construída a partir de uma ideia abstrata de como uma
                empreendedora deveria trabalhar.{" "}
                <b className="font-semibold text-[var(--ink)]">
                  Está sendo construída dentro de um negócio de verdade.
                </b>
              </p>

              <div className="mt-8 flex items-center gap-4">
                <img
                  src="/marketing/sil.jpg"
                  alt="Sil, fundadora da Pólia"
                  width={64}
                  height={64}
                  decoding="async"
                  loading="lazy"
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold">por Sil</p>
                  <p className="text-[14px] text-[var(--ink-soft)]">fundadora da Pólia</p>
                </div>
              </div>

              <div className="mt-8">
                {/* Âncora na própria página: o botão antigo levava a leitora
                    embora antes do manifesto, do "pra quem é" e do CTA final. */}
                <Link to="/sobre" hash="manifesto" className={BTN_CONTORNO}>
                  Continuar: no que a Pólia acredita
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MANIFESTO */}
        <section id="manifesto" className={SECAO}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[62ch]">
              <Eyebrow>No que a Pólia acredita</Eyebrow>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A gente acredita em clareza, não em cobrança.
              </h2>
              <p className="mt-5 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                Ferramenta também educa quem usa pelo jeito que trata. Por isso, cada escolha da
                Pólia parte de uma pergunta simples: isso ajuda alguém a entender melhor o próprio
                negócio ou só faz essa pessoa se sentir mais pressionada?
              </p>
            </Reveal>

            <Reveal delay={0.1} y={28} className="mt-[clamp(40px,5vw,48px)]">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
                {/* Abaixo da dobra: lazy. O JPG de 1MB fica só como fallback. */}
                <picture className="block w-full">
                  <source
                    srcSet="/marketing/sobre-manifesto-1024.webp"
                    type="image/webp"
                    media="(min-width: 641px)"
                  />
                  <source srcSet="/marketing/sobre-manifesto-640.webp" type="image/webp" />
                  <img
                    src="/marketing/sobre-manifesto.jpg"
                    alt=""
                    aria-hidden="true"
                    className="h-[200px] w-full object-cover md:h-[300px]"
                    width={2224}
                    height={1664}
                    decoding="async"
                    loading="lazy"
                  />
                </picture>
              </div>
            </Reveal>

            <div className="mx-auto mt-[clamp(48px,6vw,72px)] max-w-[68ch]">
              {credo.map((item, i) => (
                <Reveal
                  key={item.linha}
                  className={`py-[clamp(32px,4vw,48px)] ${i > 0 ? "border-t border-[var(--line)]" : ""}`}
                >
                  <span className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-3 max-w-[20ch] text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                    {item.linha}
                  </p>
                  <p className="mt-4 leading-[1.7] text-[var(--ink-soft)]">{item.texto}</p>
                </Reveal>
              ))}
            </div>

            <div className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="text-[18px] font-bold tracking-[-0.01em]">A Pólia recusa</h3>
                  <ul className="mt-4 grid list-none gap-3">
                    {recusa.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-[15px] leading-[1.45] text-[var(--ink)]"
                      >
                        <X
                          size={18}
                          className="mt-0.5 flex-none text-[var(--muted)]"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl bg-[var(--surface-pink)] p-8">
                  <h3 className="text-[18px] font-bold tracking-[-0.01em]">A Pólia escolhe</h3>
                  <ul className="mt-4 grid list-none gap-3">
                    {escolhe.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-[15px] leading-[1.45] text-[var(--ink)]"
                      >
                        <Check
                          size={18}
                          className="mt-0.5 flex-none text-[var(--secondary-text)]"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>

            <Reveal className="mt-[clamp(32px,4vw,48px)]">
              <div className="rounded-2xl bg-[var(--secondary)] p-8 text-center md:p-12">
                <p className="font-fraunces mx-auto max-w-[24ch] text-[clamp(1.4rem,2.6vw,2rem)] italic leading-[1.35] text-[var(--secondary-ink)]">
                  “Quando a marca fica clara, o dinheiro para de escapar.”
                </p>
                <p className="mt-4 text-[14px] text-[var(--secondary-ink)] opacity-75">
                  É o que cada tela da Pólia precisa ajudar a provar.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MISSÃO E VISÃO */}
        <section id="missao" className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>No que a gente se apoia</Eyebrow>
            </Reveal>

            <div className="mt-[clamp(32px,4vw,40px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h2 className="text-[19px] font-bold tracking-[-0.01em]">Missão</h2>
                  <p className="mt-3 leading-[1.65] text-[var(--ink-soft)]">
                    Dar a quem comanda uma marca, com ajuda ou sem, clareza para decidir bem e saber
                    quanto sobra. Quem a marca atende. Quanto cobra. Quanto sobra. E o que precisa
                    acontecer para o negócio continuar de pé. Tudo em um lugar só.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h2 className="text-[19px] font-bold tracking-[-0.01em]">Visão</h2>
                  <p className="mt-3 leading-[1.65] text-[var(--ink-soft)]">
                    Que nenhuma empreendedora descubra tarde demais quanto estava sobrando. Que
                    decidir o preço, acompanhar o caixa e tocar a rotina seja simples para quem está
                    fazendo o negócio acontecer.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* A lista de Valores saiu: repetia quase palavra por palavra os 6
                princípios do manifesto, logo acima. */}
          </div>
        </section>

        {/* PRA QUEM É */}
        <section id="publico" className={SECAO}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[70ch]">
              <Eyebrow>Pra quem é</Eyebrow>
              <h2 className="mt-4 max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A Pólia é para quem quer tocar o próprio negócio com mais clareza.
              </h2>
              <p className="mt-5 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Pode estar começando. Pode já estar vendendo. Pode tocar tudo sozinha ou ter algumas
                pessoas ajudando. O que importa não é o tamanho do negócio. É chegar naquele momento
                em que você percebe:
              </p>
              <blockquote className="mt-5 font-fraunces text-[clamp(1.4rem,2.4vw,2rem)] italic leading-[1.3] text-[var(--ink)]">
                “Eu não quero mais decidir tudo no improviso.”
              </blockquote>
            </Reveal>

            <div className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="text-[18px] font-bold tracking-[-0.01em]">Provavelmente sim</h3>
                  <ul className="mt-5 flex list-none flex-col gap-4">
                    {publicoSim.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[15px] leading-[1.6] text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--secondary)] text-[11px] font-bold text-[var(--secondary-ink)]"
                        >
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-[var(--line)] p-8">
                  <h3 className="text-[18px] font-bold tracking-[-0.01em]">Talvez ainda não</h3>
                  <ul className="mt-5 flex list-none flex-col gap-4">
                    {publicoNao.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[15px] leading-[1.6] text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--line)] text-[11px] font-bold text-[var(--muted)]"
                        >
                          ·
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-[15px] font-semibold leading-[1.6] text-[var(--ink)]">
                    A Pólia cuida da clareza para decidir. Não da mídia.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* A seção "Identidade visual" (wordmark, ícone e a paleta com os hex)
            saiu da página pública: é assunto de bastidor, vira pauta de blog. */}

        {/* CTA FINAL */}
        <section className="py-[clamp(80px,10vw,140px)] text-center">
          <div className={CONTAINER}>
            <Reveal className="flex flex-col items-center">
              <h2 className="mb-6 max-w-[18ch] text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                O método que faltou pra mim está virando produto.
              </h2>
              <p className="max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Estou construindo a Pólia em público e testando cada parte primeiro na minha própria
                marca. Em outubro, ela chega às primeiras empreendedoras.
              </p>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink)]">
                Entre na lista para ser uma das primeiras a usar.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {/* Pré-lançamento: cadastro fechado, então o CTA leva pra lista.
                    Volta pra /auth/cadastro quando os planos abrirem. */}
                <Link
                  to="/lista-de-espera"
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"sobre_cta_final"}'
                  className={BTN_PRIMARIO}
                >
                  Quero entrar na lista
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="mt-4 text-[14px] text-[var(--ink-soft)]">É grátis. Sem cobrança.</p>
            </Reveal>
          </div>
        </section>

        {/* ASSINATURA FINAL */}
        <section className="pb-[clamp(72px,9vw,128px)]">
          <div className={`${CONTAINER} border-t border-[var(--line)] pt-[clamp(48px,6vw,80px)]`}>
            <Reveal>
              <p className="max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Clareza sobre o negócio gera lucro.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
