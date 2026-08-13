import { createFileRoute, Link } from "@tanstack/react-router";
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
import { gatePublico } from "@/lib/site-gate";

export const Route = createFileRoute("/sobre")({
  beforeLoad: gatePublico,
  head: () => ({
    meta: [
      { title: "A marca · Pólia" },
      {
        name: "description",
        content:
          "Meu negócio vendia bem. Eu só não sabia quanto sobrava. A história, aquilo em que a Pólia acredita e pra quem ela é feita.",
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

const numeros = [
  { valor: "14", rotulo: "anos de e-commerce" },
  { valor: "8", rotulo: "anos de negócio próprio" },
  { valor: "4", rotulo: "grandes marcas na bagagem" },
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
      "Encerrei o e-commerce com cliente chegando e as contas sem fechar. O que faltou ali tem nome, método, e virou a razão de existir da Pólia.",
  },
  {
    ano: "2020 a 2022",
    texto:
      "Consultoria pra quem estava montando loja virtual e definindo a estratégia da própria marca.",
  },
  {
    ano: "Nos anos seguintes",
    texto:
      "Dentro de grandes empresas, como C&A, Allied e ArcelorMittal, vi de perto o método que marca grande usa pra decidir. A ficha caiu: era isso que faltava do outro lado do balcão.",
  },
  {
    ano: "Hoje",
    texto: "A Pólia, construída em público, rodando primeiro na minha própria marca.",
  },
];

const pontos = [
  {
    icon: ClipboardList,
    titulo: "Tudo começa no Planejamento",
    desc: "A marca decide quem atende, o que entrega e quanto vale. Essa decisão vira o preço, a meta e o rumo do negócio.",
  },
  {
    icon: LineChart,
    titulo: "Os números aparecem na hora",
    desc: "Preço, quanto sobra, caixa e quanto falta pra meta num Painel que se entende de relance. Sem planilha, sem susto no fim do mês.",
  },
  {
    icon: RouteIcon,
    titulo: "A execução não se perde",
    desc: "O Planner organiza o que a semana pede, ligado à mesma meta definida no Planejamento. Decidir bem não adianta se a entrega se perde no caminho.",
  },
];

// Era "O que a Pólia não é", uma lista que atacava coach e curso. Numa página
// cujo único trabalho é gerar confiança, atacar o vizinho gasta o espaço que
// deveria dizer o que a marca é.
const escolheSer = [
  "Uma mentora de bolso, presente na hora de cobrar, comprar e fechar.",
  "Do tamanho de quem toca o negócio, sozinha, com a família ou com poucas mãos ajudando, nunca do tamanho de empresa grande.",
  "Em português claro, do jeito que se fala na mesa da cozinha.",
  "De uso diário, desde antes da primeira venda.",
];

// A ausência ("sumiu", "uns dias fora") é nomeada UMA vez na página inteira, no
// princípio 02 do manifesto. Repetir cria a impressão de que a Pólia está
// preocupada com o sumiço, que é exatamente o oposto do que ela defende.
const recusa = [
  "Meta no vermelho jogada como cobrança",
  "Hype: “transforme”, “fature 6 dígitos”",
  "Tutorial bobo, mascote, professora de cima",
  "Jargão e feature de sistema grande",
];

const escolhe = [
  "Clareza sobre quanto a marca vale",
  "O Planejamento intacto na volta",
  "Dona da marca, nunca devedora dela",
  "O concreto: o preço que saiu do chute",
  "Respeitar a sua inteligência, do seu lado",
  "Do tamanho de quem manda no negócio",
];

const credo = [
  {
    linha: "Clareza vale mais que esforço.",
    texto:
      "Decidir o que importa, quem a marca atende, quanto ela cobra, o que sobra no fim do mês, rende mais que uma lista inteira de tarefas feitas no braço.",
  },
  {
    linha: "A gente puxa pela oportunidade, nunca pela culpa.",
    texto:
      "Depois de uns dias fora, o Planejamento está lá do jeito que ficou, esperando sem cara feia. O “sumiu, não desista” dos outros aplicativos é cobrança disfarçada de incentivo, e a Pólia não usa. Dá pra voltar quando der e continuar de onde parou.",
  },
  {
    linha: "Dona da marca, nunca devedora dela.",
    texto:
      "A marca é sua, e dívida não é. A Pólia trata assim: abre, decide uma coisa e fecha com a sensação de quem manda no negócio.",
  },
  {
    linha: "A gente respeita a sua inteligência.",
    texto:
      "Sem tutorial bobo, sem explicar o óbvio, sem mascote fazendo graça. Quem toca a marca sabe o que faz. A Pólia foi feita por quem já viveu isso e senta do lado, nunca fala de cima.",
  },
  {
    linha: "Comemora o concreto, não a promessa vazia.",
    texto:
      "A Pólia celebra o preço que finalmente saiu do chute, o quanto sobra que apareceu, a meta do mês batida. Sobriedade é uma forma de respeito.",
  },
  {
    linha: "Do tamanho de quem decide, não do tamanho da equipe.",
    texto:
      "Uma dona de negócio sozinha entra e sai tão rápido quanto uma que tem a irmã na produção e o marido cuidando do Instagram. A Pólia não pergunta quantas pessoas trabalham ali, pergunta quem manda. Nada de aprovação em cadeia, nada de crachá, nada de reunião pra decidir o óbvio.",
  },
];

const publicoSim = [
  "O negócio já vende, mas o preço ainda sai no chute.",
  "Entrega, financeiro, atendimento e conteúdo passam todos pelas mesmas mãos.",
  "A conta da marca e a conta pessoal ainda se misturam.",
  "Falta método pra operação do dia a dia, não marca bonita no papel.",
];

const publicoNao = [
  "O que vai ser vendido ainda não está decidido.",
  "Já existe equipe e processo rodando. A Pólia é pra quem toca sozinha.",
  "A procura é por ferramenta de anúncio ou automação de marketing: a Pólia cuida da decisão, não da mídia.",
];

function SobrePage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-[clamp(48px,6vw,72px)] pt-[clamp(48px,7vw,96px)]">
          <div
            className={`${CONTAINER} grid grid-cols-1 items-center gap-[clamp(32px,5vw,72px)] md:grid-cols-[1.05fr_0.95fr]`}
          >
            <div>
              <Reveal>
                <Eyebrow>A marca</Eyebrow>
              </Reveal>
              <h1 className="mt-4 text-[clamp(2.4rem,5.4vw,4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Por que a Pólia existe.
              </h1>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                  Meu negócio vendia bem. Eu só não sabia quanto sobrava. Esta página conta o que
                  essa frase virou: a história, aquilo em que a Pólia acredita e pra quem ela é
                  feita.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.15} y={28}>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                <img
                  src="/marketing/sobre-hero.png"
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  width={2224}
                  height={1664}
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* A HISTÓRIA */}
        <section id="historia" className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>A história</Eyebrow>
              <h2 className="mt-4 max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A Pólia é a ferramenta{" "}
                <span className="whitespace-nowrap">
                  <HighlightWord delay={0.3}>que eu não tive</HighlightWord>.
                </span>
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mt-[clamp(40px,5vw,56px)]">
              <Pullquote>Meu negócio vendia bem. Eu só não sabia quanto sobrava.</Pullquote>
            </Reveal>

            <div className="mx-auto mt-[clamp(40px,5vw,56px)] max-w-[68ch]">
              <Reveal>
                <p className="text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                  Comecei em 2012 vendendo cosmético artesanal, e o negócio foi mudando de cara
                  comigo: virou papelaria de casamento, com lacinho feito à mão e a plotter de
                  recorte ligada o dia todo, e depois virou planner e caderno artesanal, os mesmos
                  nomes que hoje batizam duas áreas da Pólia. Cada fase vendia. Os números da frente
                  iam bem. O que ninguém via era o fundo: as finanças no susto, cada mês um remendo,
                  a conta da casa misturada com a conta do negócio. Eu vendia bem e não sabia quanto
                  sobrava.
                </p>
                <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                  Demorei pra entender que aquilo não era defeito meu. Era falta de método, e
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
                  <Eyebrow>O caminho até aqui</Eyebrow>
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
              <Pullquote tom="pessego">
                Não faltou cliente. Faltou clareza sobre o meu próprio negócio.
              </Pullquote>
            </Reveal>
          </div>
        </section>

        {/* O QUE VIROU A PÓLIA */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[60ch]">
              <Eyebrow>O que virou</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Foi isso que virou a Pólia.
              </h2>
              <p className="mt-4 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                A Pólia é o que eu não tive: um lugar onde as decisões da marca, o preço, o caixa e
                a rotina moram juntos, sem planilha perdida.
              </p>
            </Reveal>

            <RevealGroup className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-3">
              {pontos.map((p) => {
                const Icon = p.icon;
                return (
                  <RevealItem
                    key={p.titulo}
                    className="rounded-2xl border border-[var(--line)] bg-white p-8"
                  >
                    <Icon size={22} className="text-[var(--secondary-text)]" aria-hidden="true" />
                    <h3 className="mt-4 text-[18px] font-bold tracking-[-0.01em]">{p.titulo}</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                      {p.desc}
                    </p>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            <Reveal className="mx-auto mt-[clamp(40px,5vw,48px)] max-w-[68ch]">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
                <Eyebrow>O que a Pólia escolhe ser</Eyebrow>
                <ul className="mt-4 list-none">
                  {escolheSer.map((item) => (
                    <li key={item} className="relative mt-3 pl-6 text-[var(--ink-soft)]">
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-[10px] h-[10px] w-[10px] rounded-[2px] bg-[var(--accent)]"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ASSINATURA */}
        <section className={SECAO}>
          <div className={`${CONTAINER} max-w-[68ch]`}>
            <Reveal>
              <p className="text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                Eu construo a Pólia usando ela na minha própria marca. Sou a primeira usuária do meu
                produto, e isso me obriga a ser honesta: se uma tela mente sobre o seu dinheiro, eu
                percebo primeiro.
              </p>
              <p className="mt-6 text-[18px] leading-[1.7] text-[var(--ink-soft)]">
                Quem toca a marca sozinha, eu sei como é. Passei dez anos aprendendo na marra o
                método que devia ter existido desde o começo. A Pólia existe pra ninguém mais
                precisar desses dez anos.
              </p>

              <div className="mt-8 flex items-center gap-4">
                <img
                  src="/marketing/sil.jpg"
                  alt="Sil, fundadora da Pólia"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold">por Sil</p>
                  <p className="text-[14px] text-[var(--ink-soft)]">fundadora da Pólia</p>
                </div>
              </div>

              <div className="mt-8">
                <Link to="/" hash="como-funciona" className={BTN_CONTORNO}>
                  Ver como a Pólia funciona
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MANIFESTO */}
        <section id="manifesto" className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[62ch]">
              <Eyebrow>Manifesto</Eyebrow>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A gente acredita em clareza, não em cobrança.
              </h2>
              <p className="mt-5 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                Ferramenta também educa quem usa, pelo jeito que trata. A Pólia foi desenhada a
                partir de escolhas conscientes, e aqui vai o que ela defende.
              </p>
            </Reveal>

            <Reveal delay={0.1} y={28} className="mt-[clamp(40px,5vw,48px)]">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
                <img
                  src="/marketing/sobre-manifesto.jpg"
                  alt=""
                  aria-hidden="true"
                  className="h-[200px] w-full object-cover md:h-[300px]"
                  width={2224}
                  height={1664}
                />
              </div>
            </Reveal>

            <div className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <Eyebrow>A Pólia recusa</Eyebrow>
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
                  <Eyebrow>A Pólia escolhe</Eyebrow>
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

            <Reveal className="mt-[clamp(32px,4vw,48px)]">
              <div className="rounded-2xl bg-[var(--secondary)] p-8 text-center md:p-12">
                <p className="font-fraunces mx-auto max-w-[24ch] text-[clamp(1.4rem,2.6vw,2rem)] italic leading-[1.35] text-[var(--secondary-ink)]">
                  “Quando a marca fica clara, o dinheiro para de escapar.”
                </p>
                <p className="mt-4 text-[14px] text-[var(--secondary-ink)] opacity-75">
                  O que toda tela da Pólia foi feita pra provar.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MISSÃO, VISÃO E VALORES */}
        <section id="missao" className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>No que a gente se apoia</Eyebrow>
            </Reveal>

            <div className="mt-[clamp(32px,4vw,40px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="text-[19px] font-bold tracking-[-0.01em]">Missão</h3>
                  <p className="mt-3 leading-[1.65] text-[var(--ink-soft)]">
                    Dar pra quem toca a marca sozinha a clareza de decidir bem e de saber quanto
                    sobra: quem a marca atende, quanto ela cobra e o que fica no fim do mês, tudo
                    num lugar só.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="text-[19px] font-bold tracking-[-0.01em]">Visão</h3>
                  <p className="mt-3 leading-[1.65] text-[var(--ink-soft)]">
                    Que nenhuma empreendedora precise largar um negócio que dá certo por falta de
                    método. Que decidir o preço, ver o caixa e tocar a rotina seja simples pra quem
                    toca o negócio.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* A lista de Valores saiu: repetia quase palavra por palavra os 6
                princípios do manifesto, logo acima. */}
          </div>
        </section>

        {/* PRA QUEM É */}
        <section id="publico" className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[70ch]">
              <Eyebrow>Pra quem é</Eyebrow>
              <p className="mt-4 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                A Pólia é feita pra empreendedora que toca a própria marca sozinha e já saiu do
                zero. Tem produto ou serviço rodando, cliente chegando, e agora quer
                profissionalizar a operação em vez de tocar tudo no improviso. O gargalo não é ideia
                de marca, é o dia a dia de fazer o negócio girar sem largar dinheiro pelo caminho.
              </p>
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
                  <h3 className="text-[18px] font-bold tracking-[-0.01em]">Provavelmente não</h3>
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
              <Eyebrow>Pólia</Eyebrow>
              <h2 className="mb-6 mt-4 max-w-[18ch] text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                O método que faltou pra mim já existe.
              </h2>
              <p className="max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Vinte minutos no primeiro módulo e o painel começa a trabalhar.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/auth/cadastro"
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"sobre_cta_final"}'
                  className={BTN_PRIMARIO}
                >
                  Criar conta grátis
                  <span aria-hidden="true">→</span>
                </Link>
                <Link to="/" hash="planos" className={BTN_CONTORNO}>
                  Conhecer os planos
                </Link>
              </div>
              <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
                Sem cartão no Confere. Cancelamento em um clique.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
