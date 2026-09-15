import { createFileRoute, Link } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { jsonLdFaq, tagJsonLd } from "@/lib/jsonld";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, type ReactNode } from "react";
import { AppEntryGateModal } from "@/components/site/AppEntryGateModal";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
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
  head: () => ({
    meta: [
      { title: "Pólia · Descubra se o seu negócio dá lucro" },
      {
        name: "description",
        content:
          "Números para decidir melhor: veja quanto sobra, quanto precisa entrar no mês e o que merece atenção no seu negócio. Sem planilha e sem achismo.",
      },
      { property: "og:title", content: "Pólia · Descubra se o seu negócio dá lucro" },
      {
        property: "og:description",
        content: "Ver quanto sobra em cada venda e cobrar o que o negócio vale, no mesmo lugar.",
      },
    ],
    links: [linkCanonico("/")],
    // Gerado do array `perguntas` logo abaixo, nunca copiado à mão: FAQ
    // estruturado que não bate com o texto visível vale menos que nenhum.
    scripts: [tagJsonLd(jsonLdFaq(perguntas))],
  }),
  component: HomePage,
});

/* ───────────────────────────── conteúdo ───────────────────────────── */

// Copy V4 (14/09/2026): a Home conta uma história só, nesta ordem. Eu descubro se
// dá lucro, entendo quanto sobra, passo a cobrar com clareza, decido melhor e
// construo uma marca que sustenta essas decisões. O número abre, a marca aprofunda.

const credenciais = [
  "Feita no Brasil",
  "Para quem vende produto ou serviço",
  "Físico ou digital",
  "Plano grátis de verdade",
];

/** Cenas do problema, curtas de propósito: o riso vem do reconhecimento. */
const cenas = [
  "O preço foi definido olhando o da concorrente.",
  "O desconto foi dado no susto.",
  "A compra aconteceu sem saber se cabia.",
  "A meta ficou na cabeça.",
  "As tarefas estão espalhadas por vários lugares.",
];

/** O que a Pólia conecta, na ordem em que o negócio usa. */
const cadeia = ["planejamento", "preço", "vendas", "financeiro", "metas", "rotina"];

const movimentos: {
  n: string;
  titulo: string;
  body: string;
  /** Lista curta que entra entre o corpo e o fecho, um item por linha. */
  itens?: string[];
  depois?: string;
  resultado: string;
  mock: ReactNode;
}[] = [
  {
    n: "01",
    titulo: "O negócio sai da cabeça",
    body: "O Planejamento faz as perguntas certas, em português claro, sobre o que importa para o negócio: razão de existir, cliente, oferta, preço, divulgação e rumo. As respostas formam um documento vivo, e dá pra pausar, voltar e editar quando quiser.",
    resultado: "Resultado: o negócio inteiro, organizado em um só lugar.",
    mock: <MockPergunta />,
  },
  {
    n: "02",
    titulo: "As respostas viram ferramentas",
    body: "O que você responde não fica perdido em um formulário. Cada módulo alimenta as ferramentas que você vai usar no dia a dia:",
    itens: ["Marca", "Mercado", "Catálogo", "Financeiro", "Caderno", "Metas"],
    resultado: "Resultado: você não precisa preencher a mesma informação duas vezes.",
    mock: <MockModulos />,
  },
  {
    n: "03",
    titulo: "A rotina acontece no painel",
    body: "O painel traduz o que está acontecendo no negócio em informação pronta pra usar.",
    itens: [
      "Quanto já entrou.",
      "Quanto falta para o mês.",
      "Quais tarefas vencem hoje.",
      "Como as metas estão avançando.",
    ],
    depois: "Sem relatório para montar. Sem planilha para alimentar.",
    resultado: "Resultado: clareza para decidir o que fazer agora.",
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
  /** Título no tamanho de seção: só pro bloco que a copy pede em destaque. */
  grande?: boolean;
  body: string;
  /** Três linhas grandes, empilhadas. A última ganha o grifo. */
  trio?: string[];
  itens?: string[];
  depois?: string;
  resultado: string;
  fecho?: string;
  cta?: { texto: string; href: string; contexto: string };
  mock: ReactNode;
}[] = [
  {
    eyebrow: "Preço",
    titulo: "Quanto sobra de verdade?",
    grande: true,
    body: "Preço não é só quanto o cliente paga. É quanto fica depois dos custos, das taxas e do que foi necessário para fazer aquela venda acontecer. A Pólia coloca essa conta em reais.",
    trio: ["Quanto custa.", "Quanto você cobra.", "Quanto sobra."],
    depois: "Sem precisar entender termos técnicos para descobrir.",
    resultado: "De preço no chute a preço com razão.",
    fecho:
      "A cada venda, a Pólia mostra quanto realmente sobra. E quando você sabe quanto sobra, cobrar deixa de ser uma aposta.",
    // Pré-lançamento: a calculadora abre no plano Grátis, então o botão leva aos
    // planos. Em outubro volta pra /auth/cadastro.
    cta: { texto: "Quero calcular meu preço", href: "#planos", contexto: "preco" },
    mock: <MockCalculadora />,
  },
  {
    eyebrow: "Metas",
    titulo: "Três metas. Não trinta.",
    body: "Você não precisa acompanhar tudo ao mesmo tempo. A Pólia limita as metas ativas para manter o foco no que realmente importa agora.",
    itens: [
      "Quanto já entrou.",
      "Quanto falta.",
      "Quantos clientes faltam.",
      "O que já foi concluído.",
    ],
    resultado: "Meta que dá pra enxergar é meta que dá pra acompanhar.",
    mock: <MockMetas />,
  },
  {
    eyebrow: "Rotina",
    titulo: "Tarefas por prazo, não por pilha.",
    body: "O Planner organiza o trabalho sem fazer da sua rotina mais uma coisa para administrar. O painel mostra o que atrasou, o que é de hoje e o que vem pela frente. E quando você conclui uma tarefa, a informação é atualizada onde precisa estar.",
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

/** As perguntas que a Pólia responde antes de qualquer conversa sobre marca. */
const perguntasDoNumero = [
  "Dá lucro?",
  "Quanto sobra?",
  "Quanto precisa entrar?",
  "Quanto vale o que eu vendo?",
];

const credenciaisSil = [
  "Passagens por C&A, Allied e ArcelorMittal",
  "Consultoria para pequenas empreendedoras: o problema que a Pólia resolve foi visto de perto, muitas vezes",
];

// A faixa de "depoimento reservado" saiu da página a pedido da fundadora, até
// existir depoimento de usuária de verdade. Está no histórico do git se voltar.

const fazSentido = [
  "Você já vende, mas termina o mês sem saber exatamente quanto sobrou.",
  "Seu preço foi definido olhando o mercado ou tentando adivinhar o que o cliente aceita.",
  "Você vende produto, serviço ou os dois.",
  "Você trabalha sozinha ou com ajuda.",
  "Você está começando e quer construir uma base antes da primeira venda.",
  "Você quer tomar decisões com mais clareza, sem precisar virar especialista em planilhas.",
];

const aindaNao = [
  "Você procura uma fórmula para enriquecer rápido.",
  // Não é sobre tamanho de equipe: é sobre já ter um sistema de gestão maduro
  // rodando, que segue sendo critério de exclusão válido (a Pólia não é ERP).
  "Sua empresa já tem uma estrutura robusta de gestão funcionando.",
  "Você procura uma agência ou alguém para decidir e executar tudo no seu lugar.",
];

// Nomes visíveis desde 14/09/2026: Grátis, Premium e Pro. As chaves internas
// (confere/controle/projete) seguem no banco e no Stripe. Os bullets nomeiam só
// o que o código realmente entrega em cada plano (src/lib/planos.ts): Raio-x,
// projeção e plano de conteúdo trancam no Pro; mapa de mercado é do
// Premium e o Caderno abre no plano Grátis.
const planos: {
  nome: string;
  frase: string;
  preco: string;
  ciclo: string;
  /** Linha que abre a lista nos planos pagos ("Tudo do Grátis, mais:"). */
  abre?: string;
  features: string[];
  apoio?: string;
  botao: string;
  href: string;
  destaque: boolean;
}[] = [
  {
    nome: "Grátis",
    frase: "Descubra se o seu negócio dá lucro.",
    preco: "R$ 0",
    ciclo: "· para sempre",
    features: [
      "Os 6 módulos do Planejamento",
      "Painel diário",
      "Calculadora de preço para até 5 produtos",
      "Até 3 metas acompanhadas",
      "Um quadro no Planner",
    ],
    // Pré-lançamento: cadastro e checkout estão fechados, então os três botões
    // levam pra lista de espera. Em outubro voltam pra /auth/cadastro e
    // /assinar?plano=... (destinos originais no histórico do git).
    botao: "Entrar na lista",
    href: "/lista-de-espera",
    destaque: false,
  },
  {
    nome: "Premium",
    frase: "Controle o negócio inteiro, mês a mês.",
    preco: "R$ 29,90",
    ciclo: "/mês",
    abre: "Tudo do Grátis, mais:",
    features: [
      "Calculadora de preço sem limite de produtos",
      "Financeiro com os números que ajudam a decidir o mês",
      "Clientes e pedidos, do orçamento à entrega",
      "Quadros ilimitados no Planner",
    ],
    apoio: "Um desconto dado no chute pode custar mais do que a assinatura.",
    botao: "Entrar na lista",
    href: "/lista-de-espera",
    destaque: true,
  },
  {
    nome: "Pro",
    frase: "Enxergue o que aconteceu e o que vem pela frente.",
    preco: "R$ 47,90",
    ciclo: "/mês",
    abre: "Tudo do Premium, mais:",
    features: [
      "Raio-x do mês",
      "Projeções de vendas",
      "Plano de conteúdo conectado ao negócio",
      "Resumo do mês para o contador",
      "Acesso antecipado a novos recursos",
    ],
    botao: "Entrar na lista",
    href: "/lista-de-espera",
    destaque: false,
  },
];

const perguntas = [
  {
    pergunta: "A Pólia é um curso?",
    resposta:
      "Não. É uma ferramenta de uso diário. O Planejamento organiza as decisões do negócio, as ferramentas colocam essas decisões para funcionar e o painel acompanha o que acontece depois. O aprendizado acontece no caminho, enquanto o próprio negócio vai ficando organizado.",
  },
  {
    pergunta: "Preciso entender de números ou planilhas?",
    resposta:
      "Não. A Pólia pergunta em português claro quanto custa, quanto você cobra e quanto precisa entrar no mês. As contas são feitas pela ferramenta. Quem sabe responder sobre o próprio negócio já tem o que precisa para começar.",
  },
  {
    pergunta: "Meu negócio ainda não vende. A Pólia faz sentido?",
    resposta:
      "Sim. Antes da primeira venda já existem decisões importantes: o que você vai vender, para quem, quanto vai cobrar e quanto precisa entrar. O plano Grátis não custa nada, então dá pra começar a construir essa base sem pagar.",
  },
  {
    pergunta: "Funciona para serviços?",
    resposta:
      "Sim. A Pólia funciona para produtos, serviços e negócios híbridos. As perguntas e os cálculos se adaptam ao tipo de negócio.",
  },
  {
    pergunta: "Quanto tempo preciso dedicar?",
    resposta:
      "Você não precisa parar o negócio inteiro para usar a Pólia. Cada módulo do Planejamento leva cerca de vinte minutos e pode ser pausado a qualquer momento. Depois, o painel e as ferramentas continuam trabalhando com o que você registrou.",
  },
  {
    pergunta: "E se eu cancelar um plano pago?",
    resposta:
      "Sua conta volta para o plano Grátis, sem custo. O que você construiu no Planejamento e os registros do negócio continuam com você.",
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

/** Lista curta com ponto turquesa, usada dentro dos blocos de recurso. */
function ListaCurta({ itens }: { itens: string[] }) {
  return (
    <ul className="mt-5 flex list-none flex-col gap-2">
      {itens.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[16px] font-medium leading-[1.5]">
          <span
            aria-hidden="true"
            className="mt-[9px] h-[6px] w-[6px] flex-none rounded-full bg-[var(--secondary)]"
          />
          {item}
        </li>
      ))}
    </ul>
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
      decoding="async"
      loading="lazy"
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
              Quero descobrir se dá lucro
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
                  <Eyebrow>Gestão para quem vende</Eyebrow>
                </Reveal>
                <h1 className="mb-6 mt-4 text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                  Descubra se o seu negócio dá{" "}
                  <span className="whitespace-nowrap">
                    <HighlightWord delay={0.35}>lucro</HighlightWord>.
                  </span>
                </h1>
                <Reveal delay={0.1}>
                  <p className="max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                    Veja quanto sobra em cada venda, quanto precisa entrar no mês e tome decisões
                    com mais clareza, sem planilha e sem achismo.
                  </p>
                  <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                    A Pólia organiza os números e as decisões do seu negócio em um só lugar, para
                    você saber o que está acontecendo antes de decidir o próximo passo.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href="#planos"
                      data-track="cadastro_cta_clicado"
                      data-track-props='{"contexto":"hero"}'
                      className={BTN_PRIMARIO}
                    >
                      Quero descobrir se dá lucro
                      <span aria-hidden="true">→</span>
                    </a>
                    <a href="#produto" className={BTN_CONTORNO}>
                      Ver o produto
                    </a>
                  </div>
                  {/* Pré-lançamento: o botão leva à lista, então a linha diz que o
                      Grátis é grátis, sem prometer "comece agora". */}
                  <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                    O plano Grátis não pede cartão de crédito.
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
                Você vende. Mas sabe quanto realmente{" "}
                {/* O marcador é inline-block e não quebra, então a pontuação precisa
                    viajar junto com ele, senão a interrogação cai sozinha na linha. */}
                <span className="whitespace-nowrap">
                  <HighlightWord delay={0.3}>sobra</HighlightWord>?
                </span>
              </h2>
            </div>
            <RevealGroup className="flex flex-col gap-6 border-l border-[var(--line)] pl-8">
              <RevealItem>
                <p className="text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  Tem negócio que vende bem e ainda assim termina o mês sem saber quanto sobrou.
                </p>
              </RevealItem>
              <RevealItem>
                <ul className="flex list-none flex-col gap-2">
                  {cenas.map((c) => (
                    <li
                      key={c}
                      className="text-[16px] font-semibold leading-[1.5] text-[var(--ink)]"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </RevealItem>
              <RevealItem>
                <p className="text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  E aí chega a hora de passar um orçamento, fechar uma venda ou decidir se dá para
                  comprar mais. Você decide. E depois fica pensando:
                </p>
              </RevealItem>
              <RevealItem>
                <blockquote className="font-fraunces text-[clamp(1.4rem,2.4vw,2rem)] italic leading-[1.3] text-[var(--ink)]">
                  “Será que eu cobrei certo?”
                </blockquote>
              </RevealItem>
              <RevealItem>
                <p className="text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  <b className="font-semibold text-[var(--ink)]">
                    O problema não é falta de esforço.
                  </b>{" "}
                  É tomar decisões importantes sem conseguir enxergar o negócio inteiro.
                </p>
              </RevealItem>
            </RevealGroup>
          </div>
        </section>

        {/* A SOLUÇÃO */}
        <section className="pb-[clamp(72px,9vw,128px)]">
          <div className={`${CONTAINER} border-t border-[var(--line)] pt-[clamp(56px,7vw,96px)]`}>
            <Reveal>
              <Eyebrow>A solução</Eyebrow>
              <h2 className="mt-4 max-w-[18ch] text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                Um lugar onde o negócio inteiro cabe.
              </h2>
              <p className="mt-6 text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                A Pólia conecta o que normalmente fica separado:
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ol className="mt-6 flex list-none flex-wrap items-center gap-x-4 gap-y-3">
                {cadeia.map((c, i) => (
                  <li
                    key={c}
                    className="flex items-center gap-4 text-[clamp(1.35rem,2.8vw,2.2rem)] font-bold leading-none tracking-[-0.02em]"
                  >
                    {c}
                    {i < cadeia.length - 1 && (
                      <span aria-hidden="true" className="text-[var(--secondary-text)]">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr] md:gap-[clamp(32px,5vw,64px)]">
                <p className="max-w-[46ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  Você organiza as decisões uma vez. As respostas viram ferramentas conectadas, e a
                  Pólia usa o que o negócio registra para mostrar o que está acontecendo.
                </p>
                <p className="max-w-[46ch] text-[16px] leading-[1.65] text-[var(--ink)]">
                  Assim, você não precisa começar do zero toda vez que precisa tomar uma decisão.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className={`scroll-mt-[88px] bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Como funciona</Eyebrow>
              <h2 className="mt-4 max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Do papel em branco à rotina que roda.
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
                    {m.itens && <ListaCurta itens={m.itens} />}
                    {m.depois && (
                      <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                        {m.depois}
                      </p>
                    )}
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
                Um documento vivo, não um formulário.
              </h2>
              <p className="max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                O Planejamento cresce junto com o negócio. Cada resposta fica guardada, pode ser
                editada e se conecta com a ferramenta que precisa daquela informação.
              </p>
              <p className="mt-4 max-w-[56ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                Você não constrói uma estratégia para esquecer depois.
              </p>
              <p className="mt-2 max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] font-semibold leading-[1.5] text-[var(--ink)]">
                O Planejamento vira uma base que continua trabalhando.
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

        {/* RECURSOS: preço, metas e rotina */}
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
                  <h3
                    className={`mb-4 mt-3 font-bold tracking-[-0.02em] text-balance ${
                      r.grande
                        ? "text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.08]"
                        : "text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.15]"
                    }`}
                  >
                    {r.titulo}
                  </h3>
                  <p className="max-w-[44ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                    {r.body}
                  </p>
                  {r.trio && (
                    <p className="mt-6 text-[clamp(1.5rem,2.8vw,2.2rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                      {r.trio.map((linha, j) => (
                        <span key={linha} className="block">
                          {j === (r.trio?.length ?? 0) - 1 ? (
                            <HighlightWord delay={0.2}>{linha}</HighlightWord>
                          ) : (
                            linha
                          )}
                        </span>
                      ))}
                    </p>
                  )}
                  {r.itens && <ListaCurta itens={r.itens} />}
                  {r.depois && (
                    <p className="mt-4 max-w-[44ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                      {r.depois}
                    </p>
                  )}
                  <p className="mt-4 text-[14px] font-semibold text-[var(--secondary-text)]">
                    {r.resultado}
                  </p>
                  {r.fecho && (
                    <p className="mt-4 max-w-[44ch] border-l-2 border-[var(--secondary)] pl-4 text-[15px] leading-[1.6] text-[var(--ink)]">
                      {r.fecho}
                    </p>
                  )}
                  {r.cta && (
                    <a
                      href={r.cta.href}
                      data-track="cadastro_cta_clicado"
                      data-track-props={`{"contexto":"${r.cta.contexto}"}`}
                      className={`${BTN_CONTORNO} mt-6`}
                    >
                      {r.cta.texto}
                    </a>
                  )}
                </Reveal>
                <Reveal delay={0.1} y={28} className={i % 2 === 1 ? "md:order-1" : ""}>
                  {r.mock}
                </Reveal>
              </article>
            ))}
          </div>
        </section>

        {/* NÚMERO + MARCA */}
        <section className="bg-[var(--ink)] py-[clamp(80px,10vw,140px)] text-[var(--bg)]">
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow claro>Número e marca</Eyebrow>
              <h2 className="mb-6 mt-4 max-w-[20ch] text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Preço, meta e rotina também são{" "}
                <em className="font-fraunces font-normal italic text-[var(--secondary-light)]">
                  decisões de marca
                </em>
                .
              </h2>
              <p className="max-w-[52ch] text-[16px] leading-[1.7] text-[var(--bg)]/70">
                Quando você sabe quem a sua marca serve, o que ela entrega e quanto precisa receber
                por isso, o preço deixa de ser chute. A meta deixa de ser desejo. E a rotina deixa
                de ser uma lista infinita de coisas para fazer.
              </p>
            </Reveal>

            <RevealGroup className="mt-[clamp(48px,6vw,80px)] grid grid-cols-1 gap-8 border-t border-white/[0.18] pt-8 md:grid-cols-2 md:gap-[clamp(32px,5vw,64px)]">
              <RevealItem>
                <p className="max-w-[16ch] text-[clamp(1.6rem,3.2vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  O número dá chão para a decisão.
                </p>
              </RevealItem>
              <RevealItem>
                <p className="max-w-[18ch] text-[clamp(1.6rem,3.2vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  A marca dá sentido para o que você está{" "}
                  <span className="text-[var(--secondary-light)]">construindo</span>.
                </p>
              </RevealItem>
            </RevealGroup>

            <Reveal delay={0.1}>
              <p className="mt-10 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--bg)]/85">
                A Pólia existe para ajudar essas duas coisas a trabalharem juntas.
              </p>
            </Reveal>
          </div>
          <FaixaFerramentas />
        </section>

        {/* O DIFERENCIAL */}
        <section className={SECAO}>
          <div
            className={`${CONTAINER} grid grid-cols-1 items-start gap-[clamp(32px,5vw,80px)] md:grid-cols-[1fr_1fr]`}
          >
            <Reveal>
              <Eyebrow>O diferencial</Eyebrow>
              <h2 className="mt-4 max-w-[12ch] text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                O número abre. A marca aprofunda.
              </h2>
              <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                A Pólia não começa dizendo para você postar mais, vender mais ou faturar mais.
                Primeiro, ela ajuda você a entender:
              </p>
            </Reveal>

            <div>
              <RevealGroup className="flex flex-col">
                {perguntasDoNumero.map((q, i) => (
                  <RevealItem
                    key={q}
                    className={`flex items-baseline gap-5 py-5 ${
                      i > 0 ? "border-t border-[var(--line)]" : ""
                    }`}
                  >
                    <span className="font-accent text-[13px] font-bold tracking-[0.1em] text-[var(--secondary-text)]">
                      0{i + 1}
                    </span>
                    <p className="text-[clamp(1.4rem,2.6vw,2.1rem)] font-bold leading-[1.15] tracking-[-0.02em]">
                      {q}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>
              <Reveal delay={0.1}>
                <p className="mt-8 max-w-[44ch] border-t border-[var(--line)] pt-6 text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  Depois, essa clareza sustenta as outras decisões do negócio.
                </p>
                <p className="mt-3 max-w-[44ch] text-[16px] font-semibold leading-[1.6] text-[var(--ink)]">
                  Porque uma marca forte também precisa saber sustentar o preço que cobra.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PARA QUEM É */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Para quem é</Eyebrow>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Para quem vende. E para quem está começando.
              </h2>
            </Reveal>

            <div className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl border border-[var(--line)] bg-white p-8">
                  <h3 className="mb-6 text-[20px] font-bold tracking-[-0.01em]">
                    A Pólia faz sentido se
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
                    Talvez não seja para você se
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

            <Reveal delay={0.1}>
              <div className="mt-[clamp(40px,5vw,64px)] max-w-[720px]">
                <p className="text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  A Pólia organiza os números e mostra o cenário.
                </p>
                <p className="mt-2 text-[clamp(1.6rem,3.2vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.02em]">
                  <HighlightWord delay={0.2}>A decisão continua sendo sua.</HighlightWord>
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* QUEM FEZ */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,80px)] md:grid-cols-[1.15fr_0.85fr]">
              <Reveal>
                <Eyebrow>Quem fez</Eyebrow>
                <h2 className="mt-4 max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  Feita por quem conhece o outro lado da conta.
                </h2>
                <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  A Pólia nasceu depois de anos vendo pequenas empreendedoras tomarem decisões
                  importantes sem ter clareza sobre os próprios números.
                </p>
                <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                  Sil, fundadora da Pólia, passou 14 anos dentro do e-commerce, sendo 8 deles
                  tocando o próprio negócio. Ela viu de perto a diferença entre ter informação para
                  decidir e simplesmente torcer para a conta fechar.
                </p>
                <blockquote className="mt-8 max-w-[30ch] font-fraunces text-[clamp(1.35rem,2.3vw,1.9rem)] italic leading-[1.4]">
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
                  <p className="text-[14px] text-[var(--ink-soft)]">Fundadora da Pólia</p>
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
                  <div className="flex flex-1 flex-col gap-3">
                    {p.abre && (
                      <p className="text-[14px] font-semibold leading-[1.6] text-[var(--ink)]">
                        {p.abre}
                      </p>
                    )}
                    <ul className="flex list-none flex-col gap-3">
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
                  </div>
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
              {/* Enquanto os planos não abrem, a linha de apoio responde à
                  objeção certa (quando dá pra entrar), não à de cancelamento. */}
              <p className="mx-auto mt-6 max-w-[64ch] text-center text-[14px] leading-[1.65] text-[var(--ink)]">
                Os planos abrem em breve. Quem está na lista entra primeiro.
              </p>
            </Reveal>
          </div>
        </section>

        {/* CTA DE FECHAMENTO */}
        <section className="py-[clamp(80px,10vw,140px)] text-center">
          <div className={CONTAINER}>
            <Reveal className="flex flex-col items-center">
              <Eyebrow>Pólia</Eyebrow>
              <h2 className="mb-6 mt-4 max-w-[18ch] text-[clamp(2.5rem,5.8vw,4.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                O próximo orçamento vai chegar de qualquer jeito.
              </h2>
              <p className="max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                A questão é como você vai chegar nele. Com mais uma conta feita no chute? Ou sabendo
                quanto precisa cobrar?
              </p>
              <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                A Pólia existe para colocar o negócio no lugar certo:
              </p>
              <p className="mt-2 max-w-[24ch] text-[clamp(1.6rem,3.2vw,2.6rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
                na sua frente, com os{" "}
                <span className="whitespace-nowrap">
                  <HighlightWord delay={0.3}>números à vista</HighlightWord>.
                </span>
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/lista-de-espera"
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"cta_final"}'
                  className={BTN_PRIMARIO}
                >
                  Quero descobrir se dá lucro
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
                Sem cartão. Sem prazo. Sem precisar saber de planilha.
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
                Antes de criar sua conta, respostas diretas.
              </h2>
            </Reveal>
            {perguntas.map((p) => (
              <Pergunta key={p.pergunta} pergunta={p.pergunta} resposta={p.resposta} />
            ))}
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
