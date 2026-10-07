import { createFileRoute, Link } from "@tanstack/react-router";
import { linkCanonico, urlCanonica } from "@/lib/seo";
import { jsonLdAboutPage, jsonLdPersonSil, tagJsonLd } from "@/lib/jsonld";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { DadosEmpresa, LinhaDoTempo, type ItemLinhaDoTempo } from "@/components/site/SobreBlocos";
import {
  BotaoCadastro,
  CORPO,
  FotoLanding,
  FraseAncora,
  H2,
  NumeroProva,
  Rotulo,
  Secao,
} from "@/components/landing/BlocosLanding";
import { MockFluxoMarcaPrecoMes } from "@/components/landing/MocksLanding";

const TITULO_SOBRE = "Sobre a Pólia One · Quem fez e por quê";
const DESCRICAO_SOBRE =
  "Meu negócio vendia bem. Eu só não sabia quanto sobrava. A história da Sil, no que a Pólia acredita e a empresa por trás da Pólia One.";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: TITULO_SOBRE },
      { name: "description", content: DESCRICAO_SOBRE },
      { property: "og:title", content: "Quem fez a Pólia One" },
      { property: "og:description", content: DESCRICAO_SOBRE },
    ],
    links: [linkCanonico("/sobre")],
    // AboutPage (a página conta a história da empresa) + Person da Sil (a
    // fundadora, citada e fotografada na própria página). A Organization dentro
    // dos dois já leva razão social e CNPJ, os mesmos do bloco "A empresa".
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

// Copy V5 (07/10/2026), em COPY-SITE-HOME-SOBRE.md (Parte 2), e layout em
// WIREFRAME-SOBRE-POLIA-ONE.md, na raiz do workspace. Substitui a V4 de 14/09:
// de 11 blocos pra 7, sem fala de pré-lançamento, com "Pólia One" pro app e a
// empresa com CNPJ. Primeira pessoa só da Sil, na história; os princípios têm a
// Pólia como sujeito, então a página não depende da decisão do DEC-15.

const numeros = [
  { valor: "14", rotulo: "anos de e-commerce" },
  { valor: "8", rotulo: "anos de negócio próprio" },
  // C&A, Allied, ArcelorMittal e Bradesco (Bradesco entrou em 06/10/2026).
  { valor: "4", rotulo: "grandes marcas na bagagem" },
];

// A saída de 2020 é fato, não fracasso (Manual da Marca). "Projetos com marcas
// como" é a forma aprovada: não diz qual é o vínculo atual com nenhuma delas.
const linhaDoTempo: ItemLinhaDoTempo[] = [
  { ano: "2012", texto: "Primeiro negócio: cosmético artesanal." },
  { ano: "2013", texto: "Papelaria de casamento." },
  {
    ano: "2016",
    texto:
      "Planner e caderno artesanal, tocados junto com um emprego fixo, o negócio rodando nas brechas do dia.",
  },
  {
    ano: "2020",
    texto:
      "Encerrei o e-commerce com cliente chegando e as contas sem fechar. O que faltou ali tem nome: método.",
  },
  {
    ano: "2020 a 2022",
    texto:
      "Consultoria pra quem estava montando loja virtual e definindo a estratégia da própria marca.",
  },
  {
    ano: "Depois",
    texto: (
      <>
        Projetos com marcas como{" "}
        <b className="font-semibold text-[var(--ink)]">C&amp;A, Allied, ArcelorMittal e Bradesco</b>
        . Lá dentro, vi o método que marca grande usa pra decidir preço e meta. Era isso que faltava
        do outro lado do balcão.
      </>
    ),
  },
  { ano: "Hoje", texto: "A Pólia One está aberta, e a minha marca é a primeira a usar." },
];

const ordem = [
  {
    titulo: "Primeiro, a marca.",
    texto:
      "No Planejamento, a Pólia One pergunta por que a marca existe, pra quem ela é e o que entrega. É isso que sustenta o preço quando a cliente diz que tá caro.",
  },
  {
    titulo: "Depois, o preço.",
    texto:
      "A Calculadora pega o custo real, as taxas e quanto precisa sobrar, e devolve um preço sugerido, comparado com a meta do mês.",
  },
  {
    titulo: "Por fim, o mês.",
    texto:
      "A cada venda registrada, o Painel mostra quanto falta pra fechar as contas e o Planner organiza o que a semana pede.",
  },
];

const primeiraUsuaria = [
  "Se uma tela não ajuda a entender o dinheiro da minha marca, eu percebo primeiro.",
  "Se uma conta não faz sentido, eu encontro.",
  "Se uma ferramenta complica mais do que resolve, ela não está pronta.",
];

const principios = [
  {
    titulo: "A decisão é de quem toca a marca.",
    texto:
      "A Pólia organiza os números e mostra o cenário. O preço, a meta e o próximo passo continuam nas mãos de quem conhece o negócio.",
  },
  {
    titulo: "Oportunidade, nunca culpa.",
    texto:
      "Ficou uns dias sem abrir? A Pólia One não faz cara feia. Você abre e continua de onde parou.",
  },
  {
    titulo: "Respeito pela inteligência de quem usa.",
    texto:
      "Sem tutorial bobo, sem explicar o óbvio, sem falar de cima. Quem toca uma marca já sabe muita coisa. A Pólia organiza o que está espalhado.",
  },
  {
    titulo: "O concreto vale mais que a promessa.",
    texto:
      "O preço que saiu do chute. O quanto sobra que apareceu. A meta que fechou. É isso que a Pólia comemora, não número mágico nem dinheiro fácil.",
  },
];

function SobrePage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main id="conteudo">
        {/* S1 · HERO */}
        <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
          <div className="grid grid-cols-1 items-center gap-x-[clamp(32px,5vw,64px)] gap-y-12 md:grid-cols-[55fr_45fr]">
            {/* h1 e parágrafo fora do Reveal: chegam visíveis no HTML do servidor. */}
            <div>
              <Rotulo>Quem fez a Pólia One</Rotulo>
              <h1 className="mt-4 text-[clamp(30px,3.2vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance max-md:text-[32px]">
                Meu negócio vendia bem. Eu só não sabia quanto sobrava.
              </h1>
              <p className="mt-6 max-w-[52ch] text-[19px] leading-[1.6] text-[var(--ink-soft)] max-md:text-[17px]">
                Sou a Sil. Foram oito anos com marca própria, do cosmético artesanal ao caderno
                feito à mão. Cliente nunca faltou. Faltou{" "}
                <b className="font-semibold text-[var(--ink)]">
                  a conta que dissesse quanto daquilo era meu
                </b>
                . A Pólia One nasceu pra fazer essa conta.
              </p>
            </div>
            {/* Elemento de LCP: sem Reveal (começaria invisível até o JS chegar). */}
            <figure>
              <FotoLanding
                nome="quemfez-sil-retrato"
                alt="Sil, fundadora da Pólia, sorrindo, de blusa clara, em casa."
                proporcao="4/5"
                prioridade
              />
              <figcaption className="mt-3 text-[13px] text-[var(--muted)]">
                Sil, fundadora da Pólia
              </figcaption>
            </figure>
          </div>
        </Secao>

        {/* S2 · A HISTÓRIA */}
        <Secao fundo="surface" id="historia">
          <Reveal>
            <Rotulo>A história</Rotulo>
            <h2 className={`mt-4 max-w-[24ch] ${H2}`}>
              Cada fase vendia. O fundo é que nunca fechava.
            </h2>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-x-[clamp(32px,5vw,64px)] gap-y-12 md:grid-cols-[7fr_4fr]">
            <Reveal>
              <p className={CORPO}>
                Comecei em 2012 vendendo cosmético artesanal. Depois veio a papelaria de casamento,
                com lacinho feito à mão e a plotter de recorte ligada o dia todo. Mais tarde,
                planner e caderno artesanal, os mesmos nomes que hoje batizam duas áreas da Pólia
                One.
              </p>
              <p className={`mt-4 ${CORPO}`}>
                Os números da frente iam bem. O que ninguém via era o fundo: as finanças no susto,
                cada mês um remendo,{" "}
                <b className="font-semibold text-[var(--ink)]">
                  a conta da casa misturada com a do negócio
                </b>
                .
              </p>
              <p className={`mt-4 ${CORPO}`}>
                Demorei pra entender que aquilo não era defeito meu. Era falta de método, e ninguém
                tinha me dado um.
              </p>
            </Reveal>

            {/* Números parados de propósito: contador animado é enfeite (wireframe 1.5). */}
            <ul className="grid list-none grid-cols-3 gap-4 border-y border-[var(--line)] py-6 md:grid-cols-1 md:gap-0 md:border-y-0 md:py-0">
              {numeros.map((n, i) => (
                <li
                  key={n.rotulo}
                  className={i > 0 ? "md:mt-6 md:border-t md:border-[var(--line)] md:pt-6" : ""}
                >
                  <NumeroProva numero={n.valor} texto={n.rotulo} tamanho="medio" />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16 max-w-[760px]">
            <Rotulo>Linha do tempo</Rotulo>
            <div className="mt-6">
              <LinhaDoTempo itens={linhaDoTempo} />
            </div>
          </div>

          <FraseAncora className="mt-12">Não faltou esforço. Faltou método.</FraseAncora>
        </Secao>

        {/* S3 · O QUE VIROU A PÓLIA ONE */}
        <Secao>
          <Reveal className="max-w-[62ch]">
            <Rotulo>O que virou</Rotulo>
            <h2 className={`mt-4 ${H2}`}>Juntar o que estava espalhado, na ordem certa.</h2>
            <p className={`mt-6 ${CORPO}`}>
              Eu sabia vender, sabia construir marca e sabia trabalhar. O que não estava junto era
              preço, caixa, meta e rotina. E quando os números moram em lugares diferentes, cada
              decisão vira aposta.
            </p>
            <p className={`mt-4 ${CORPO}`}>
              A Pólia One junta essas partes na ordem que faltou pra mim:
            </p>
          </Reveal>

          {/* Colunas de texto, sem borda: o único elemento com moldura é o mock. */}
          <ol className="mt-10 grid list-none grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {ordem.map((o, i) => (
              <li key={o.titulo}>
                <Reveal delay={i * 0.08}>
                  <h3 className="font-cabinet text-[20px] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--ink)] max-md:text-[18px]">
                    {o.titulo}
                  </h3>
                  <p className="mt-2 text-[17px] leading-[1.65] text-[var(--ink-soft)] max-md:text-[16px]">
                    {o.texto}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-xl bg-[var(--surface)] p-6">
            <MockFluxoMarcaPrecoMes />
          </div>
          <p className="mt-3 text-[13px] text-[var(--muted)]">Números de exemplo.</p>

          <FraseAncora className="mt-10">
            A marca dá coragem pro preço. O número prova que a coragem tinha razão.
          </FraseAncora>
        </Secao>

        {/* S4 · A PRIMEIRA USUÁRIA (respiro) */}
        <Secao fundo="surface" respiro>
          <Reveal className="mx-auto max-w-[62ch]">
            <Rotulo>A primeira usuária</Rotulo>
            <h2 className={`mt-4 ${H2}`}>Eu construo a Pólia usando a Pólia.</h2>
            <p className={`mt-6 ${CORPO}`}>
              A minha marca é a primeira a usar a Pólia One. Isso me obriga a ser honesta:
            </p>
            <ul className="mt-4 flex list-none flex-col gap-2">
              {primeiraUsuaria.map((linha) => (
                <li
                  key={linha}
                  className="flex items-start gap-3 text-[17px] leading-[1.6] text-[var(--ink)] max-md:text-[16px]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[11px] h-[6px] w-[6px] flex-none rounded-full bg-[var(--secondary)]"
                  />
                  {linha}
                </li>
              ))}
            </ul>
            <p className={`mt-6 ${CORPO}`}>
              A Pólia One não nasceu de uma ideia de como uma empreendedora deveria trabalhar.{" "}
              <b className="font-semibold text-[var(--ink)]">
                Nasceu dentro de um negócio de verdade.
              </b>
            </p>

            <div className="mt-8 flex items-center gap-4">
              {/* Mesmo arquivo da foto do hero: no celular já está no cache. */}
              <img
                src="/marketing/landing/quemfez-sil-retrato-640.webp"
                alt=""
                width={64}
                height={64}
                decoding="async"
                loading="lazy"
                className="h-16 w-16 rounded-full object-cover object-[50%_25%]"
              />
              <div>
                <p className="font-semibold text-[var(--ink)]">Sil</p>
                <p className="text-[14px] text-[var(--ink-soft)]">fundadora da Pólia</p>
              </div>
            </div>
          </Reveal>
        </Secao>

        {/* S5 · NO QUE A PÓLIA ACREDITA */}
        <Secao id="principios">
          <div className="grid grid-cols-1 items-start gap-x-[clamp(32px,5vw,64px)] gap-y-8 md:grid-cols-[5fr_6fr]">
            <div className="md:sticky md:top-[96px]">
              <Rotulo>No que a Pólia acredita</Rotulo>
              <h2 className={`mt-4 ${H2}`}>Clareza, não cobrança.</h2>
              <p className={`mt-6 ${CORPO}`}>
                Cada tela da Pólia One passa pela mesma pergunta: isso ajuda a entender melhor o
                próprio negócio, ou só deixa a pessoa mais pressionada?
              </p>
            </div>
            <ol className="list-none">
              {principios.map((p, i) => (
                <li
                  key={p.titulo}
                  className={`py-8 ${i > 0 ? "border-t border-[var(--line)]" : "pt-0"}`}
                >
                  <Reveal delay={i * 0.08}>
                    <span className="font-accent text-[13px] font-bold tracking-[0.08em] text-[var(--secondary-text)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-cabinet mt-2 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)] max-md:text-[20px]">
                      {p.titulo}
                    </h3>
                    <p className="mt-3 text-[17px] leading-[1.65] text-[var(--ink-soft)] max-md:text-[16px]">
                      {p.texto}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>

          <p className="font-fraunces mt-12 max-w-[40ch] text-[28px] italic leading-[1.4] text-[var(--ink)] max-md:text-[22px]">
            Quando a marca fica clara, o dinheiro para de escapar.
          </p>
        </Secao>

        {/* S6 · A EMPRESA */}
        <Secao fundo="surface" id="empresa">
          <div className="grid grid-cols-1 items-start gap-x-[clamp(32px,5vw,64px)] gap-y-8 md:grid-cols-[5fr_6fr]">
            <Reveal>
              <Rotulo>A empresa</Rotulo>
              <h2 className={`mt-4 ${H2}`}>Quem está por trás.</h2>
              <p className={`mt-6 ${CORPO}`}>
                A Pólia é a marca. A Pólia One é o app, feito pela Pólia Lab, que também oferece
                serviços pra marcas.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <DadosEmpresa
                dados={[
                  { rotulo: "Razão social", valor: "Nunoli Soluções Digitais Ltda" },
                  { rotulo: "CNPJ", valor: "18.305.925/0001-06" },
                  { rotulo: "Dúvida sobre o app", valor: "Central de ajuda", para: "/ajuda" },
                  {
                    rotulo: "Serviços pra marcas",
                    valor: "lab.usepolia.com.br",
                    href: "https://lab.usepolia.com.br/",
                    externo: true,
                  },
                  {
                    rotulo: "Dados e privacidade",
                    valor: "privacidade@usepolia.com.br",
                    href: "mailto:privacidade@usepolia.com.br",
                  },
                  {
                    rotulo: "Instagram",
                    valor: "@hub.polia",
                    href: "https://instagram.com/hub.polia",
                    externo: true,
                  },
                ]}
              />
            </Reveal>
          </div>
        </Secao>

        {/* S7 · CTA FINAL (respiro) */}
        <Secao respiro>
          <Reveal className="max-w-[62ch]">
            <h2 className="max-w-[18ch] text-[clamp(32px,4vw,54px)] font-bold leading-[1.06] tracking-[-0.02em] text-balance text-[var(--ink)]">
              O método que faltou pra mim agora tem nome.
            </h2>
            <p className={`mt-6 ${CORPO}`}>
              A Pólia One começa pela marca, faz a conta do preço e mostra o mês. O Grátis abre o
              Planejamento e a Calculadora.
            </p>
            <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <div>
                <BotaoCadastro
                  busca={{ origem: "sobre" }}
                  contexto="sobre_cta_final"
                  className="max-md:w-full"
                />
              </div>
              <Link
                to="/planos"
                className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2 max-md:justify-center"
              >
                Ver os planos
              </Link>
            </div>
            <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
          </Reveal>
        </Secao>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
