import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, type ReactNode } from "react";
import { AppEntryGateModal } from "@/components/site/AppEntryGateModal";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
import { gatePublico } from "@/lib/site-gate";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import {
  MockPainel,
  MockFrasePainel,
  MockPlanejamento,
  MockPergunta,
  MockModulos,
  MockCalculadora,
  MockMetas,
  MockPlanner,
} from "@/components/site/ProdutoMock";

export const Route = createFileRoute("/")({
  beforeLoad: gatePublico,
  head: () => ({
    meta: [
      { title: "Pólia · Descubra se o seu negócio dá lucro" },
      {
        name: "description",
        content:
          "Veja quanto sobra em cada venda, sem planilha e sem achismo. Vinte minutos no primeiro módulo e o painel passa a dizer, todo dia, quanto já entrou e quanto falta pra fechar as contas do mês.",
      },
      { property: "og:title", content: "Pólia · Descubra se o seu negócio dá lucro" },
      {
        property: "og:description",
        content: "Ver quanto sobra em cada venda e cobrar o que o negócio vale, no mesmo lugar.",
      },
    ],
  }),
  component: HomePage,
});

/* ───────────────────────────── conteúdo ───────────────────────────── */

const credenciais = [
  "Feita no Brasil",
  "Para quem vende produto ou serviço",
  "Físico ou digital",
  "Plano grátis de verdade",
];

const problemas: { forte: string; resto: string }[] = [
  {
    forte: "O preço foi definido no chute",
    resto: ", olhando o da concorrente e tirando dois reais.",
  },
  {
    forte: "A meta vive só na cabeça",
    resto: ", e o que vive só na cabeça não fecha mês nenhum.",
  },
  { forte: "As tarefas moram em três aplicativos", resto: " que não se conversam." },
  {
    forte: "E o aperto tem hora marcada",
    resto:
      ": na hora de passar o orçamento, dar o desconto, fechar a compra de material. A decisão sai no escuro, e depois vem a pior parte, que é ficar remoendo se cobrou certo.",
  },
  {
    forte: "Isso não se resolve com mais esforço.",
    resto: " Se resolve com um lugar onde o negócio inteiro caiba.",
  },
];

const movimentos: {
  n: string;
  titulo: string;
  body: string;
  resultado: string;
  mock: ReactNode;
}[] = [
  {
    n: "01",
    titulo: "O negócio sai da cabeça",
    body: "O Planejamento faz as perguntas certas, em português claro, sobre seis assuntos: a razão de existir, quem a marca serve, o que vende, quanto vale, como te acharem e onde a marca vai. As respostas formam um documento vivo, que dá pra pausar e retomar em qualquer ponto sem perder nada.",
    resultado: "Resultado: o negócio inteiro, escrito, num lugar só.",
    mock: <MockPergunta />,
  },
  {
    n: "02",
    titulo: "As respostas viram ferramentas",
    body: "Cada módulo concluído desbloqueia uma ferramenta que já nasce preenchida com as respostas: a marca, o mapa de mercado, o catálogo, o financeiro, o caderno de divulgação e as metas. Nada de começar do zero duas vezes.",
    resultado: "Resultado: ferramentas prontas, sem retrabalho.",
    mock: <MockModulos />,
  },
  {
    n: "03",
    titulo: "A rotina acontece no painel",
    body: "Todo dia, o painel abre dizendo quanto falta pro mês bom, quais tarefas têm prazo hoje e como a semana está indo. Sem relatório pra montar, sem planilha pra alimentar: o painel se calcula sozinho com o que o negócio registra.",
    resultado: "Resultado: clareza diária, em uma tela.",
    mock: <MockFrasePainel />,
  },
];

const anotacoes = [
  {
    n: "1",
    titulo: "Seis módulos, um mapa",
    texto:
      "A faixa mostra onde o documento está. Módulo concluído fica aberto pra reler e editar sempre.",
  },
  {
    n: "2",
    titulo: "Resposta vira decisão",
    texto:
      "O que foi respondido sobre cliente e tom aparece aqui como o retrato da marca, não como texto perdido num formulário.",
  },
  {
    n: "3",
    titulo: "Números com nome",
    texto: "Mês mínimo, mês bom e mês de celebrar. As metas do painel nascem destes três números.",
  },
];

const recursos: {
  eyebrow: string;
  titulo: string;
  body: string;
  resultado: string;
  /** Âncora de preço: liga o número do exemplo ao valor da assinatura. */
  ancora?: string;
  mock: ReactNode;
}[] = [
  {
    eyebrow: "Preço",
    titulo: "Quanto sobra de verdade",
    body: "A calculadora de preço pega o custo, as taxas e o tempo de produção e mostra, em reais, quanto fica no bolso a cada venda. Sem termo técnico: a pergunta é quanto sobra, e a resposta também.",
    resultado: "De preço no chute a preço com razão.",
    ancora:
      "Na conta do exemplo, cada caixa deixa R$ 18,90 limpos. Duas vendas com o preço certo pagam o mês de Controle inteiro.",
    mock: <MockCalculadora />,
  },
  {
    eyebrow: "Metas",
    titulo: "Três metas, não trinta",
    body: "A Pólia limita as metas ativas a três, de propósito. Cada uma mostra o caminho no formato que importa: R$ 2.570 de R$ 3.000, 7 de 10 clientes. O progresso atualiza sozinho conforme as vendas entram.",
    resultado: "Meta que vive na tela, não na cabeça.",
    mock: <MockMetas />,
  },
  {
    eyebrow: "Rotina",
    titulo: "Tarefas por prazo, não por pilha",
    body: "O Planner organiza o trabalho em quadros simples, e o painel puxa dali o que tem prazo: o que atrasou, o que é de hoje, o que vem nos próximos sete dias. Concluir no painel conclui no quadro, é o mesmo dado.",
    resultado: "Um dia de trabalho que cabe numa tela.",
    mock: <MockPlanner />,
  },
];

const ferramentas = [
  "Marca",
  "Preço",
  "Catálogo",
  "Metas",
  "Clientes",
  "Planner",
  "Caderno",
  "Financeiro",
];

const credenciaisSil = [
  "14 anos de e-commerce, 8 deles tocando o próprio negócio",
  "Passagens por C&A, Allied e ArcelorMittal",
  "Consultoria para pequenas empreendedoras: o problema que a Pólia resolve foi visto de perto, muitas vezes",
];

// A faixa de "depoimento reservado" saiu da página a pedido da fundadora, até
// existir depoimento de usuária de verdade. Está no histórico do git se voltar.

const fazSentido = [
  "O negócio já vende, mas o mês fecha sem clareza de quanto sobrou",
  "O produto é físico, digital ou serviço, sozinha ou com ajuda",
  "A vontade de começar existe, e falta um caminho que não seja curso",
  "O preço atual foi definido olhando o da concorrente",
];

const aindaNao = [
  "A busca é por fórmula pronta de enriquecer rápido: isso a Pólia não promete",
  // Não é sobre tamanho de equipe: é sobre já ter um sistema de gestão maduro
  // rodando, que segue sendo critério de exclusão válido (a Pólia não é ERP).
  "A empresa já tem equipe de gestão e sistema robusto rodando",
  "O que se procura é uma agência pra fazer no lugar: a Pólia organiza, quem decide é a dona",
];

// Cada plano abre com a frase-verbo do nome: "Projete" solto lê como desenhar,
// e é a frase ao lado que devolve o sentido de projeção. Os bullets são frase de
// resultado, não nome de recurso, porque muita visitante rola direto até aqui
// sem ler nada acima e o card precisa vender sozinho.
const planos: {
  nome: string;
  frase: string;
  preco: string;
  ciclo: string;
  features: string[];
  apoio?: string;
  botao: string;
  href: string;
  destaque: boolean;
}[] = [
  {
    nome: "Confere",
    frase: "Confere se o seu negócio dá lucro.",
    preco: "R$ 0",
    ciclo: "· pra sempre",
    features: [
      "Os 6 módulos do Planejamento: a razão de existir, o público, o preço e o rumo do negócio, respondidos do zero",
      "Painel diário: quanto já entrou e quanto falta pra fechar as contas do mês",
      "Calculadora de preço em até 5 produtos: quanto sobra em cada venda, antes de cobrar",
      "Até 3 metas acompanhadas sozinhas, sem planilha",
      "Um quadro no Planner pra organizar a semana",
    ],
    botao: "Criar conta grátis",
    href: "/auth/cadastro",
    destaque: false,
  },
  {
    nome: "Controle",
    frase: "Controle o negócio inteiro, mês a mês.",
    preco: "R$ 29,90",
    ciclo: "/mês",
    features: [
      "Tudo do Confere",
      "Calculadora de preço sem limite de produtos: quanto sobra em cada venda, antes de cobrar",
      "Financeiro com os três números que decidem o mês: o mínimo pra fechar as contas, o mês bom e o mês de celebrar",
      "Clientes com o status de cada pedido, do orçamento à entrega",
      "Quadros ilimitados no Planner",
    ],
    apoio: "Basta um desconto dado no chute pra uma encomenda levar embora mais que R$ 29,90.",
    botao: "Assinar o Controle",
    href: "/assinar?plano=controle",
    destaque: true,
  },
  {
    nome: "Projete",
    frase: "A Pólia lê os números e diz o que fazer.",
    preco: "R$ 47,90",
    ciclo: "/mês",
    // Os bullets nomeiam o que o código realmente tranca no Projete
    // (ROTAS_PROJETE + o Resumo pro contador em src/lib/planos.ts). Mapa de
    // mercado é do Controle e o Caderno abre no Confere: os dois estavam
    // listados aqui e prometiam exclusividade que não existe.
    features: [
      "Tudo do Controle",
      "Raio-x do mês: a leitura do que aconteceu e o que muda no mês que vem",
      "Projeção: quantas vendas faltam pra empatar, pra se pagar e pra bater a meta",
      "Plano de conteúdo do ano: uma ideia de post por dia, ligada ao que a marca vende",
      "Resumo do mês pro contador, em PDF e CSV",
      "Recursos novos chegam aqui primeiro",
    ],
    botao: "Assinar o Projete",
    href: "/assinar?plano=projete",
    destaque: false,
  },
];

const perguntas = [
  {
    pergunta: "A Pólia é um curso?",
    resposta:
      "É uma ferramenta de uso diário. O Planejamento organiza as decisões do negócio, o painel acompanha a rotina, e o aprendizado acontece no caminho, respondendo perguntas sobre o próprio negócio.",
  },
  {
    pergunta: "O dia já é cheio. Cabe mais uma ferramenta?",
    resposta:
      "A Pólia foi desenhada pra rotina de quem cuida da casa e do negócio no mesmo dia. Nenhuma tela exige sessão longa: registrar uma venda leva menos tempo que anotar a venda no caderninho, e o painel faz o resto sozinho.",
  },
  {
    pergunta: "O negócio ainda não vende. Faz sentido entrar agora?",
    resposta:
      "Faz. O Planejamento foi desenhado pra funcionar antes da primeira venda: definir o que a marca é, pra quem ela existe e quanto vai cobrar são exatamente as decisões de quem está começando. O Confere é grátis, então dá pra construir essa base sem gastar nada.",
  },
  {
    pergunta: "Precisa entender de números ou de planilha?",
    resposta:
      "Não. A Pólia pergunta em português claro, quanto custa fazer, quanto cobra, quanto precisa entrar no mês, e faz as contas sozinha. Nenhuma tela usa termo técnico sem explicar. Quem sabe responder sobre o próprio produto já sabe o suficiente.",
  },
  {
    pergunta: "Funciona pra serviço, ou só pra produto?",
    resposta:
      "Funciona pros dois, e pros híbridos também. O Planejamento adapta as perguntas ao tipo de negócio: quem vende brigadeiro, quem vende consultoria e quem vende arquivo digital respondem perguntas diferentes, e a calculadora de preço tem um modo próprio pra serviço cobrado por hora.",
  },
  {
    pergunta: "Quanto tempo leva pra ver o negócio organizado?",
    resposta:
      "Cada módulo do Planejamento leva em torno de vinte minutos. Dá pra pausar em qualquer pergunta e retomar depois, tudo salva sozinho. Muita gente conclui o primeiro módulo no mesmo dia em que cria a conta, e o painel já começa a trabalhar com o que foi respondido.",
  },
  {
    pergunta: "E se a assinatura for cancelada, o que acontece com os dados?",
    resposta:
      "O Planejamento e os registros continuam da dona do negócio. Ao cancelar um plano pago, a conta volta pro Confere, que é grátis e não expira, e nada do que foi escrito se perde.",
  },
];

/* ───────────────────────────── peças ───────────────────────────── */

/** Faixa contínua com as ferramentas. Para de girar com prefers-reduced-motion. */
function FaixaFerramentas() {
  const reduzirMovimento = useReducedMotion();
  const lista = [...ferramentas, ...ferramentas];

  return (
    <div
      aria-hidden="true"
      className="mt-[clamp(64px,8vw,96px)] overflow-hidden border-y border-white/[0.18] py-4"
    >
      <motion.div
        className="flex w-max items-center"
        animate={reduzirMovimento ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 36, ease: "linear", repeat: Infinity }}
      >
        {lista.map((nome, i) => (
          <span
            key={`${nome}-${i}`}
            className="flex items-center gap-14 whitespace-nowrap px-7 text-[21px] tracking-[-0.01em] text-[var(--bg)]/85 md:text-[32px]"
          >
            {nome}
            <span className="text-[var(--secondary)]">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Retrato da fundadora. Se a foto não carregar, cai no monograma em vez de
 * deixar um ícone de imagem quebrada no lugar do rosto.
 */
function FotoFundadora() {
  const [falhou, setFalhou] = useState(false);

  if (falhou) {
    return (
      <span
        aria-hidden="true"
        className="mb-5 grid h-28 w-28 place-items-center rounded-full bg-[var(--accent)] text-[40px] font-bold text-[var(--ink-soft)]"
      >
        S
      </span>
    );
  }

  return (
    <img
      src="/marketing/sil.jpg"
      alt="Sil, fundadora da Pólia"
      width={112}
      height={112}
      onError={() => setFalhou(true)}
      className="mb-5 h-28 w-28 rounded-full object-cover"
    />
  );
}

/** Pergunta do FAQ. `details` nativo: abre sem JS e já vem acessível. */
function Pergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className="group border-b border-[var(--line)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[18px] font-medium tracking-[-0.01em] text-[var(--ink)] [&::-webkit-details-marker]:hidden">
        {pergunta}
        <span
          aria-hidden="true"
          className="grid h-7 w-7 flex-none place-items-center rounded-full border border-[var(--line)] text-[16px] text-[var(--ink-soft)] transition-transform group-open:rotate-45 group-open:border-[var(--secondary)] group-open:bg-[var(--secondary)] group-open:text-[var(--secondary-ink)]"
        >
          +
        </span>
      </summary>
      <p className="max-w-[62ch] pb-6 text-[16px] leading-[1.7] text-[var(--ink-soft)]">
        {resposta}
      </p>
    </details>
  );
}

/* ───────────────────────────── página ───────────────────────────── */

function HomePage() {
  const { mostrarModal, escondendoHome, explorar } = useAppEntryGate();
  const [mostrarCtaFlutuante, setMostrarCtaFlutuante] = useState(false);

  useEffect(() => {
    const onScroll = () => setMostrarCtaFlutuante(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // App Android/iOS com sessão ativa (ou sessão ainda carregando): a Home de
  // marketing não deve piscar antes do redirect automático pro painel.
  if (escondendoHome) return null;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]" id="topo">
      {mostrarModal && <AppEntryGateModal onExplorar={explorar} />}
      <SiteHeader />

      <AnimatePresence>
        {mostrarCtaFlutuante && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-40 hidden md:block"
          >
            <a
              href="#planos"
              data-track="cadastro_cta_clicado"
              data-track-props='{"contexto":"flutuante"}'
              className={BTN_PRIMARIO}
            >
              Quero ver se dá lucro
              <span aria-hidden="true">→</span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* HERO */}
        <section className="overflow-hidden pb-0 pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            {/* Duas colunas: a promessa à esquerda e a ficha da marca preenchendo a
                lateral. Sem imagem de apoio, porque a tela do produto logo abaixo
                é a prova, e sem centralizar, que a home alinha à esquerda. */}
            <div className="grid grid-cols-1 items-end gap-x-[clamp(32px,5vw,72px)] gap-y-10 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <Reveal>
                  <Eyebrow>Pólia · para quem toca o próprio negócio</Eyebrow>
                </Reveal>
                <h1 className="mb-6 mt-4 text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                  Descubra se o seu negócio dá{" "}
                  <span className="whitespace-nowrap">
                    <HighlightWord delay={0.35}>lucro</HighlightWord>.
                  </span>
                </h1>
                <Reveal delay={0.1}>
                  <p className="max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                    Veja quanto sobra em cada venda, sem planilha e sem achismo. Vinte minutos no
                    primeiro módulo e o painel passa a dizer, todo dia, quanto já entrou e quanto
                    falta pra fechar as contas do mês.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href="#planos"
                      data-track="cadastro_cta_clicado"
                      data-track-props='{"contexto":"hero"}'
                      className={BTN_PRIMARIO}
                    >
                      Quero ver se dá lucro
                      <span aria-hidden="true">→</span>
                    </a>
                    <a href="#produto" className={BTN_CONTORNO}>
                      Ver o produto
                    </a>
                  </div>
                  <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                    O Confere é grátis de verdade. Sem cartão, sem prazo.
                  </p>
                </Reveal>
              </div>

              <Reveal delay={0.2} className="md:pb-1">
                <ul className="flex list-none flex-col gap-4 border-t border-[var(--line)] pt-5">
                  {credenciais.map((c) => (
                    <li
                      key={c}
                      className="font-accent flex items-start gap-3 text-[12px] font-bold uppercase leading-[1.5] tracking-[0.12em] text-[var(--ink-soft)]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[6px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--secondary)]"
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* A tela do produto entra inteira e é cortada na base. */}
            <Reveal delay={0.2} y={32}>
              <div
                className="mt-[clamp(48px,6vw,72px)]"
                style={{
                  maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
                }}
              >
                <MockPainel className="shadow-[0_24px_64px_-16px_rgba(10,10,10,0.18)]" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* PROVA SOCIAL */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <Reveal>
                  <Eyebrow>A pesquisa</Eyebrow>
                  <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                    66% mistura a conta da casa com a conta do negócio.
                  </h2>
                  <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                    Na pesquisa aberta da Pólia, com quase duzentas respostas de quem vende, 52%
                    admitem definir o preço no olho.
                  </p>
                </Reveal>
              </div>

              <Reveal delay={0.1}>
                <div className="rounded-2xl bg-[var(--surface-pink)] p-8 md:p-10">
                  <p className="text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                    E a frase que mais se repete é quase sempre a mesma:
                  </p>
                  <blockquote className="mt-4 font-fraunces text-[clamp(1.3rem,2.2vw,1.75rem)] italic leading-[1.35] text-[var(--ink)]">
                    “Não sei se tô tendo lucro de verdade ou só girando dinheiro.”
                    <footer className="mt-5 font-sans text-[13px] not-italic text-[var(--ink-soft)]">
                      resposta da pesquisa aberta da Pólia · 2026
                    </footer>
                  </blockquote>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PROBLEMA */}
        <section className={SECAO}>
          <div
            className={`${CONTAINER} grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[1.1fr_0.9fr]`}
          >
            <div>
              <Reveal>
                <Eyebrow>O problema</Eyebrow>
              </Reveal>
              <h2 className="mt-4 text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                Tem negócio que vende bem e ainda assim termina o mês{" "}
                {/* O marcador é inline-block e não quebra, então a pontuação precisa
                    viajar junto com ele, senão o ponto final cai sozinho na linha. */}
                <span className="whitespace-nowrap">
                  <HighlightWord delay={0.3}>sem saber quanto sobrou</HighlightWord>.
                </span>
              </h2>
            </div>
            <RevealGroup className="flex flex-col gap-6 border-l border-[var(--line)] pl-8">
              {problemas.map((p) => (
                <RevealItem key={p.forte}>
                  <p className="text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                    <b className="font-semibold text-[var(--ink)]">{p.forte}</b>
                    {p.resto}
                  </p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className={`scroll-mt-[88px] bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Como funciona</Eyebrow>
              <h2 className="mt-4 max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Três movimentos. Do papel em branco à rotina que roda.
              </h2>
            </Reveal>

            <div className="mt-4">
              {movimentos.map((m, i) => (
                <article
                  key={m.n}
                  className={`grid grid-cols-1 items-center gap-[clamp(32px,5vw,72px)] py-[clamp(48px,6vw,64px)] md:grid-cols-[0.9fr_1.1fr] ${
                    i > 0 ? "border-t border-[var(--line)]" : ""
                  }`}
                >
                  <Reveal className={i % 2 === 1 ? "md:order-2" : ""}>
                    <p className="font-accent mb-3 inline-flex items-center gap-2.5 text-[13px] font-bold tracking-[0.1em] text-[var(--ink-soft)]">
                      {m.n}
                      <span aria-hidden="true" className="h-0.5 w-10 bg-[var(--secondary)]" />
                    </p>
                    <h3 className="mb-4 text-[clamp(1.5rem,2.6vw,2.1rem)] font-bold leading-[1.15] tracking-[-0.015em]">
                      {m.titulo}
                    </h3>
                    <p className="max-w-[46ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                      {m.body}
                    </p>
                    <p className="mt-4 text-[14px] font-semibold text-[var(--secondary-text)]">
                      {m.resultado}
                    </p>
                  </Reveal>
                  <Reveal delay={0.1} y={28} className={i % 2 === 1 ? "md:order-1" : ""}>
                    {m.mock}
                  </Reveal>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* O PRODUTO */}
        <section id="produto" className={`scroll-mt-[88px] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="mb-[clamp(40px,5vw,48px)] max-w-[720px]">
              <Eyebrow>O produto</Eyebrow>
              <h2 className="mb-4 mt-3 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Um documento vivo, não um formulário
              </h2>
              <p className="max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                O Planejamento cresce junto com o negócio. Cada resposta fica guardada, editável e
                conectada com a ferramenta que usa aquela informação.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 items-start gap-[clamp(24px,4vw,56px)] lg:grid-cols-[1fr_300px]">
              <Reveal className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[11px] top-[88px] z-10 hidden h-[22px] w-[22px] place-items-center rounded-full bg-[var(--ink)] text-[11px] font-semibold text-[var(--bg)] shadow-[0_0_0_4px_var(--secondary-light)] md:grid"
                >
                  1
                </span>
                <span
                  aria-hidden="true"
                  className="absolute -right-[11px] top-[216px] z-10 hidden h-[22px] w-[22px] place-items-center rounded-full bg-[var(--ink)] text-[11px] font-semibold text-[var(--bg)] shadow-[0_0_0_4px_var(--secondary-light)] md:grid"
                >
                  2
                </span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-[64px] left-[34%] z-10 hidden h-[22px] w-[22px] place-items-center rounded-full bg-[var(--ink)] text-[11px] font-semibold text-[var(--bg)] shadow-[0_0_0_4px_var(--secondary-light)] md:grid"
                >
                  3
                </span>
                <MockPlanejamento className="shadow-[0_24px_64px_-16px_rgba(10,10,10,0.18)]" />
              </Reveal>

              <RevealGroup className="flex flex-col gap-6 lg:sticky lg:top-[104px]">
                {anotacoes.map((a) => (
                  <RevealItem key={a.n} className="border-l-2 border-[var(--secondary)] pl-4">
                    <span
                      aria-hidden="true"
                      className="mb-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--ink)] text-[11px] font-semibold text-[var(--bg)]"
                    >
                      {a.n}
                    </span>
                    <b className="block text-[15px] font-semibold">{a.titulo}</b>
                    <p className="mt-0.5 text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                      {a.texto}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section className="pb-[clamp(72px,9vw,128px)]">
          <div className={CONTAINER}>
            {recursos.map((r, i) => (
              <article
                key={r.titulo}
                className={`grid grid-cols-1 items-center gap-[clamp(32px,5vw,72px)] py-[clamp(48px,6vw,64px)] md:grid-cols-2 ${
                  i > 0 ? "border-t border-[var(--line)]" : ""
                }`}
              >
                <Reveal className={i % 2 === 1 ? "md:order-2" : ""}>
                  <Eyebrow>{r.eyebrow}</Eyebrow>
                  <h3 className="mb-4 mt-3 text-[clamp(1.5rem,2.6vw,2.1rem)] font-bold leading-[1.15] tracking-[-0.015em]">
                    {r.titulo}
                  </h3>
                  <p className="max-w-[44ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                    {r.body}
                  </p>
                  <p className="mt-4 text-[14px] font-semibold text-[var(--secondary-text)]">
                    {r.resultado}
                  </p>
                  {r.ancora && (
                    <p className="mt-4 max-w-[44ch] border-l-2 border-[var(--secondary)] pl-4 text-[15px] leading-[1.6] text-[var(--ink)]">
                      {r.ancora}
                    </p>
                  )}
                </Reveal>
                <Reveal delay={0.1} y={28} className={i % 2 === 1 ? "md:order-1" : ""}>
                  {r.mock}
                </Reveal>
              </article>
            ))}
          </div>
        </section>

        {/* O PRINCÍPIO */}
        <section className="bg-[var(--ink)] py-[clamp(80px,10vw,140px)] text-[var(--bg)]">
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow claro>O princípio</Eyebrow>
              <h2 className="mb-6 mt-4 max-w-[20ch] text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Preço, meta e rotina são{" "}
                <em className="font-fraunces font-normal italic text-[var(--secondary-light)]">
                  decisões de marca
                </em>
                .
              </h2>
              <p className="max-w-[52ch] text-[16px] leading-[1.7] text-[var(--bg)]/70">
                Quando a marca sabe quem serve e quanto vale o que entrega, o preço para de ser
                chute, a meta para de ser desejo e a rotina para de ser correria. A Pólia existe pra
                essa conta fechar.
              </p>
            </Reveal>
          </div>
          <FaixaFerramentas />
        </section>

        {/* QUEM FEZ */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,80px)] md:grid-cols-[0.85fr_1.15fr]">
              <Reveal>
                <Eyebrow>Quem fez</Eyebrow>
                <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  Feita por quem passou 14 anos dentro do e-commerce
                </h2>
                <blockquote className="mt-8 max-w-[28ch] font-fraunces text-[clamp(1.35rem,2.3vw,1.9rem)] italic leading-[1.4]">
                  “Passei anos vendo marca grande decidir com clareza e marca pequena decidir no
                  escuro. A Pólia é o painel que eu queria ter tido no meu próprio negócio, e que eu
                  queria ter entregado a cada cliente das consultorias.”
                  <footer className="mt-4 font-sans text-[14px] not-italic text-[var(--ink-soft)]">
                    Sil, fundadora da Pólia
                  </footer>
                </blockquote>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
                  <FotoFundadora />
                  <b className="text-[16px] font-semibold">Sil</b>
                  <p className="text-[14px] text-[var(--ink-soft)]">fundadora</p>
                  <ul className="mt-6 flex list-none flex-col gap-3">
                    {credenciaisSil.map((c) => (
                      <li
                        key={c}
                        className="flex gap-2.5 text-[14px] leading-[1.6] text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--secondary)]"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PARA QUEM É */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Para quem é</Eyebrow>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Feita pra quem vende. Ou pra quem vai começar.
              </h2>
            </Reveal>

            <div className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="mb-6 text-[20px] font-bold tracking-[-0.01em]">
                    Faz sentido quando
                  </h3>
                  <ul className="flex list-none flex-col gap-4">
                    {fazSentido.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[14px] leading-[1.6] text-[var(--ink-soft)]"
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
                  <h3 className="mb-6 text-[20px] font-bold tracking-[-0.01em]">
                    Ainda não, quando
                  </h3>
                  <ul className="flex list-none flex-col gap-4">
                    {aindaNao.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[14px] leading-[1.6] text-[var(--ink-soft)]"
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

        {/* PLANOS */}
        <section id="planos" className={`scroll-mt-[88px] bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Planos</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Começa grátis. Cresce quando o negócio pedir.
              </h2>
            </Reveal>

            <RevealGroup className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
              {planos.map((p) => (
                <RevealItem
                  key={p.nome}
                  className={`relative flex flex-col gap-4 rounded-2xl border bg-white p-8 ${
                    p.destaque ? "border-[var(--ink)]" : "border-[var(--line)]"
                  }`}
                >
                  {p.destaque && (
                    <span className="font-accent absolute -top-3 left-8 rounded-full bg-[var(--highlight)] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--highlight-ink)]">
                      Mais escolhido
                    </span>
                  )}
                  <div>
                    <h3 className="text-[22px] font-bold tracking-[-0.01em]">{p.nome}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--ink-soft)]">
                      {p.frase}
                    </p>
                  </div>
                  <p className="text-[35px] font-bold leading-none tracking-[-0.02em]">
                    {p.preco}
                    <small className="ml-1 font-sans text-[14px] font-normal text-[var(--ink-soft)]">
                      {p.ciclo}
                    </small>
                  </p>
                  <ul className="flex flex-1 list-none flex-col gap-3">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex gap-2.5 text-[14px] leading-[1.6] text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--secondary)]"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.apoio && (
                    <p className="text-[13px] leading-[1.5] text-[var(--ink-soft)]">{p.apoio}</p>
                  )}
                  <a
                    href={p.href}
                    data-track="cadastro_cta_clicado"
                    data-track-props={`{"contexto":"planos_${p.nome.toLowerCase()}"}`}
                    className={`${p.destaque ? BTN_PRIMARIO : BTN_CONTORNO} w-full`}
                  >
                    {p.botao}
                  </a>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal>
              <p className="mx-auto mt-6 max-w-[64ch] text-center text-[14px] leading-[1.65] text-[var(--ink-soft)]">
                Sem cartão no Confere. Cancelamento em um clique, sem multa e sem conversa difícil.
                E ao cancelar, a conta volta pro Confere: nada do que foi escrito se perde.
              </p>
              <p className="mx-auto mt-3 max-w-[64ch] text-center text-[14px] leading-[1.65] text-[var(--ink)]">
                Na dúvida, o caminho é simples: o Confere responde se dá lucro. O Controle faz o mês
                inteiro rodar.
              </p>
            </Reveal>
          </div>
        </section>

        {/* PERGUNTAS */}
        <section id="perguntas" className={`scroll-mt-[88px] ${SECAO}`}>
          <div className={`${CONTAINER} max-w-[760px]`}>
            <Reveal>
              <Eyebrow>Perguntas</Eyebrow>
              <h2 className="mb-[clamp(40px,5vw,48px)] mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Antes de criar a conta, respostas diretas
              </h2>
            </Reveal>
            {perguntas.map((p) => (
              <Pergunta key={p.pergunta} pergunta={p.pergunta} resposta={p.resposta} />
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-[clamp(80px,10vw,140px)] text-center">
          <div className={CONTAINER}>
            <Reveal className="flex flex-col items-center">
              <Eyebrow>Pólia</Eyebrow>
              <h2 className="mb-6 mt-4 max-w-[18ch] text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                O negócio já existe. <HighlightWord delay={0.3}>Falta o lugar dele.</HighlightWord>
              </h2>
              <p className="max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Vinte minutos no primeiro módulo e o painel começa a trabalhar. E a primeira
                resposta que aparece é a que mais aperta: dá lucro, ou só gira dinheiro?
              </p>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink)]">
                O próximo orçamento vai chegar de qualquer jeito. Melhor que ele chegue com a conta
                pronta.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/auth/cadastro"
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"cta_final"}'
                  className={BTN_PRIMARIO}
                >
                  Criar conta grátis
                  <span aria-hidden="true">→</span>
                </Link>
                <a href="#planos" className={BTN_CONTORNO}>
                  Conhecer os planos
                </a>
              </div>
              <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
                Sem cartão. Se não fizer sentido, cancelar leva um clique.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
