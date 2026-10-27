import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  FileText,
  Gauge,
  LayoutGrid,
  MessageSquareQuote,
  NotebookPen,
  PackageCheck,
  Percent,
  Tag,
  Wallet,
} from "lucide-react";
import { BENEFICIOS_GRATIS, TIERS_PAGOS, beneficiosNaOrdem } from "@/lib/planos";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import {
  BarraCtaMobile,
  BotaoCadastro,
  ComoFuncionaPassos,
  CORPO,
  EtiquetaPlano,
  FaqLanding,
  FontePesquisa,
  FotoLanding,
  FraseAncora,
  H2,
  ListaEditorial,
  NotaPesquisa,
  NumeroProva,
  ParaQuem,
  PlanosLanding,
  Rotulo,
  Secao,
  type BuscaCadastro,
  type ItemLista,
  type PlanoLanding,
} from "@/components/landing/BlocosLanding";
import {
  MockCalculadoraHero,
  MockDescontoSimulado,
  MockFluxoMarcaPrecoMes,
  MockFraseMes,
  MockPerguntaMarca,
  MockTresNumeros,
  MockVendaEstoque,
} from "@/components/landing/MocksLanding";
import { precoBR } from "@/components/landing/preco";
import { HeroComVideo } from "@/components/landing/VideoVsl";
import type { NichoLanding } from "@/lib/nichosLanding";

/**
 * Página "a marca sustenta o preço" (Ângulo B), a copy aprovada em 06/10/2026.
 * Uma página só, duas portas: a home (`/`, com o menu do site e indexada) e a
 * landing de anúncio (`/landing-b`, sem menu e fora do índice). A rota monta o
 * cabeçalho; daqui pra baixo é igual nas duas.
 *
 * Copy: COPY-LANDING-POLIA-ONE.md e COPY-SITE-HOME-SOBRE.md (Parte 1).
 * Layout: WIREFRAME-LANDINGS-POLIA-ONE.md. Todos na raiz do workspace.
 */

/* ───────────────────────────── conteúdo ───────────────────────────── */

/*
 * Home reestruturada pro escritório da marca (COPY-37, aprovada em 27/10/2026).
 * Proposta bloco a bloco na seção 8 de POSICIONAMENTO-POLIA-ONE.md, na raiz do
 * workspace. Tudo o que tem "Escritorio" no nome vale só com `escritorio` (home);
 * a /landing-b segue com o conteúdo original até o teste de campanha acabar.
 */

/** A semana da dona, com o preço como uma das cenas, não a única. */
const semanaDaCena = [
  "Segunda, o pedido fica anotado na conversa.",
  "Terça, o estoque é conferido no caderno.",
  "Quarta, o Pix da cliente cai na conta de casa.",
  "Sexta, o orçamento sai no chute, porque não deu tempo de fazer a conta.",
];

/** Falas literais da pesquisa (leva 2): dinheiro, estoque e preço. */
const notasEscritorio = [
  "vendo bastante mas é a maior bagunça, dinheiro tudo misturado e eu sem saber quanto de fato é meu",
  "comprei um lote grande de bolsa achando que ia voar e ficou meses parado",
  "mandei um valor meio no chute e a cliente sumiu",
];

const jeitoDeHojeEscritorio: ItemLista[] = [
  {
    icone: NotebookPen,
    titulo: "O caderno",
    texto: "guarda o que aconteceu, mas não soma sozinho e some na bolsa.",
  },
  {
    icone: FileSpreadsheet,
    titulo: "A planilha",
    texto: "funciona até a primeira fórmula quebrar. Aí vira planilha perdida.",
  },
  {
    icone: LayoutGrid,
    titulo: "Um app pra cada coisa:",
    texto: "o estoque num, o pedido no WhatsApp, o dinheiro no banco.",
  },
  {
    icone: Building2,
    titulo: "O programa de gestão de empresa grande",
    texto:
      "é feito pra quem tem contador e estoquista. Assusta no primeiro dia e fica pago e parado.",
  },
  {
    icone: Tag,
    titulo: "O preço da concorrente",
    texto: "vem de uma conta que não é a sua.",
  },
];

const operacao: ItemLista[] = [
  {
    icone: Boxes,
    titulo: "O estoque que se conta sozinho.",
    texto:
      "Cada venda baixa a peça, o kit baixa cada item, e a Pólia One mostra o que repor e quanto.",
    planos: ["Premium"],
  },
  {
    icone: ClipboardCheck,
    titulo: "O orçamento que vira venda.",
    texto: "Com a cara da marca, aprovado pela cliente no link.",
    planos: ["Premium"],
  },
  {
    icone: CalendarClock,
    titulo: "O boleto que não vence esquecido.",
    texto: "Contas a pagar com vencimento, e as que repetem todo mês.",
    planos: ["Premium"],
  },
];

const notasProblema = [
  "um cliente me pediu orçamento e eu mudei o preço umas três vezes antes de mandar, de tão insegura que eu tava",
  "toda vez que falo o valor a pessoa acha caro, aí eu amoleço e quase dou de graça",
  "uma aluna me pediu desconto e eu congelei... acabei dando na hora e depois fiquei remoendo",
];

const jeitoDeHoje: ItemLista[] = [
  {
    icone: Tag,
    titulo: "O preço da concorrente",
    texto: "não sabe quanto custa a sua embalagem, nem quanto você precisa levar pra casa.",
  },
  {
    icone: NotebookPen,
    titulo: "O caderno e a planilha",
    texto:
      "registram o que já passou. Na hora do orçamento, ninguém abre os dois pra fazer a conta inteira com a cliente esperando.",
  },
  {
    icone: Copy,
    titulo: "A fórmula pronta",
    texto: "serve pra qualquer marca. Por isso não serve pra sua.",
  },
];

/**
 * Agrupado pela tríade do "Como funciona" (23/10/2026): a marca, o preço, o mês.
 * As mesmas três palavras aparecem no subtítulo do topo e nos passos 01 a 03.
 */
const oQueMuda: Array<{ grupo: string; itens: ItemLista[] }> = [
  {
    grupo: "A marca",
    itens: [
      {
        icone: MessageSquareQuote,
        titulo: "A resposta pro “tá caro”.",
        texto:
          "O Planejamento pergunta por que a marca existe, pra quem ela é e o que entrega. No Premium, as respostas viram os documentos de Marca e Mercado.",
        planos: ["Grátis", "Premium"],
      },
    ],
  },
  {
    grupo: "O preço",
    itens: [
      {
        icone: Calculator,
        titulo: "Orçamento sem chute.",
        texto:
          "A Calculadora sugere o preço a partir do custo real, das taxas e do lucro que a marca precisa. Funciona pra produto e pra serviço cobrado por hora.",
        planos: ["Grátis"],
      },
      {
        icone: Percent,
        titulo: "Desconto com a conta feita.",
        texto: "Antes de ceder, a Pólia One mostra quanto aquele desconto tira do seu lucro.",
        planos: ["Grátis"],
      },
    ],
  },
  {
    grupo: "O mês",
    itens: [
      {
        icone: Gauge,
        titulo: "O mês em três números.",
        texto:
          "O mínimo pra fechar as contas, o mês bom e o mês de celebrar. O Financeiro mostra em qual deles você está.",
        planos: ["Premium"],
      },
      {
        icone: PackageCheck,
        titulo: "Pedido por pedido.",
        texto:
          "Cada cliente com o status da encomenda, da espera à entrega. Entregou, vira venda no Financeiro com um clique.",
        planos: ["Premium"],
      },
      {
        icone: Wallet,
        titulo: "O seu salário entra na conta.",
        texto:
          "A meta começa por quanto você quer receber. A Projeção mostra quantas vendas faltam pra empatar, pra se pagar e pra bater a meta.",
        planos: ["Pro"],
      },
      {
        icone: FileText,
        titulo: "Contador sem caça ao papel.",
        texto: "O resumo do mês sai em PDF e CSV, pronto pra mandar.",
        planos: ["Pro"],
      },
    ],
  },
];

/**
 * Home: entra o grupo "A operação" entre o preço e o mês, e o "Pedido por pedido."
 * sai do mês, porque o orçamento e a venda agora moram na operação.
 */
const oQueMudaEscritorio: Array<{ grupo: string; itens: ItemLista[] }> = [
  ...oQueMuda.filter((g) => g.grupo !== "O mês"),
  { grupo: "A operação", itens: operacao },
  ...oQueMuda
    .filter((g) => g.grupo === "O mês")
    .map((g) => ({ ...g, itens: g.itens.filter((i) => i.titulo !== "Pedido por pedido.") })),
];

/**
 * O escritório da marca (COPY-34, 27/10/2026): o que um ERP faz, dito pelo efeito.
 * Os quatro lugares são os que a venda registrada já atualiza hoje (src/lib/vendas.ts).
 * Texto em POSICIONAMENTO-POLIA-ONE.md, seção 6, na raiz do workspace.
 */
const quatroLugares: ItemLista[] = [
  {
    icone: Boxes,
    titulo: "O estoque.",
    texto: "A peça vendida sai da prateleira, e o kit ou combo baixa cada item.",
    planos: ["Premium"],
  },
  {
    icone: Wallet,
    titulo: "O Financeiro.",
    texto: "O dinheiro entra no mês certo, já sem a taxa da maquininha ou do marketplace.",
    planos: ["Premium"],
  },
  {
    icone: BarChart3,
    titulo: "Os mais vendidos.",
    texto: "A venda entra na Curva ABC, e o que está parado na prateleira aparece.",
    planos: ["Premium"],
  },
  {
    icone: Gauge,
    titulo: "O Painel.",
    texto: "A meta do mês anda, e o Painel mostra quanto falta pra fechar as contas.",
    planos: ["Premium"],
  },
];

/** Em breve no Pro (VND-05, VND-17, VND-30). Sem data até o primeiro canal abrir pra cliente. */
const canaisEmBreve = ["TikTok Shop", "Mercado Livre", "Shopee"];

const praQuemSim = [
  "Vende produto ou serviço, físico ou digital, sozinha ou com alguém ajudando.",
  "Passa orçamento toda semana e às vezes trava no valor.",
  "Já ouviu “tá caro” e cedeu.",
  "Mistura a conta da casa com a do negócio e não sabe quanto é seu.",
  "Ainda não vende, mas quer começar com o preço feito na conta.",
];

/**
 * Pra que negócio (pedido da Sil em 07/10/2026): o nome do negócio como a dona
 * chama o próprio, em etiqueta solta. Cobre os nichos do banco de ideias
 * (src/lib/bancoIdeias) mais comida de balcão e saúde, que ela pediu. Não importa
 * de lá pra não levar as 480 ideias pro pacote da home.
 */
const negocios = [
  "Confeitaria",
  "Lanchonete",
  "Hamburgueria",
  "Restaurante",
  "Marmita",
  "Nail design",
  "Estética",
  "Sobrancelha",
  "Salão de beleza",
  "Dentista",
  "Psicóloga",
  "Nutricionista",
  "Fisioterapeuta",
  "Cerâmica",
  "Crochê",
  "Bordado",
  "Velas",
  "Papelaria",
  "Lembrancinhas",
  "Moda",
  "Bijuterias",
  "Brechó",
  "Cosméticos naturais",
  "Social media",
  "Design",
  "Fotografia",
  "Cursos online",
  "Templates",
];

/** Home: a primeira linha do "sim" fala da operação espalhada. */
const praQuemSimEscritorio = [
  "Vende pelo WhatsApp, Instagram, feira ou marketplace, e anota cada venda num lugar diferente.",
  ...praQuemSim,
];

const praQuemNao = [
  "Você procura uma fórmula pra enriquecer rápido.",
  "A sua empresa já tem uma estrutura de gestão completa, com sistema e equipe cuidando do financeiro.",
  "Você procura alguém pra decidir e fazer tudo no seu lugar.",
];

const premium = TIERS_PAGOS.controle;
const pro = TIERS_PAGOS.projete;

const planos: PlanoLanding[] = [
  {
    nome: "Grátis",
    praQuem: "Pra quem está pondo a marca no papel.",
    mensal: "R$ 0",
    itens: BENEFICIOS_GRATIS,
  },
  {
    nome: "Premium",
    etiqueta: "Pra quem já vende",
    praQuem: "Pra quem já vende e quer o mês sob controle.",
    mensal: precoBR(premium.precoMensal),
    anual: precoBR(premium.precoAnual),
    base: premium.base,
    itens: beneficiosNaOrdem(premium.beneficios),
  },
  {
    nome: "Pro",
    praQuem: "Pra quem quer saber quanto falta pra marca pagar a dona.",
    mensal: precoBR(pro.precoMensal),
    anual: precoBR(pro.precoAnual),
    base: pro.base,
    itens: beneficiosNaOrdem(pro.beneficios, ["projecao"]),
  },
];

/** Exportado pro FAQPage (JSON-LD) da home: o schema sai do mesmo texto da tela. */
export const PERGUNTAS_MARCA_B = [
  {
    pergunta: "A Pólia One é um curso?",
    resposta:
      "Não. Não tem aula pra assistir. Tem o seu preço, a sua meta e o seu mês, num lugar só, pra usar no dia a dia.",
  },
  {
    pergunta: "Preciso entender de número ou de planilha?",
    resposta:
      "Não. A Pólia One faz a conta. Você responde o que já sabe: quanto pagou no material, quanto a maquininha cobra, quanto quer receber.",
  },
  {
    pergunta: "Não tenho tempo. Quanto isso toma?",
    resposta:
      "Cada módulo do Planejamento leva cerca de vinte minutos e fica salvo onde você parou. A Calculadora não depende dele: um produto já mostra o preço. Depois, registrar uma venda é uma linha.",
  },
  {
    pergunta: "Tenho tudo num caderno. Vou ter que passar tudo pra lá?",
    resposta:
      "Não. Começa pelo próximo produto e pela próxima venda. O caderno pode continuar onde está.",
  },
  {
    pergunta: "Conecta com o banco, com marketplace ou com o Instagram?",
    resposta:
      "Com o banco, dá pra importar o extrato (OFX ou CSV) no Financeiro, no Premium. Com marketplace, ainda não: as vendas entram à mão, uma linha por venda, e a ligação com TikTok Shop, Mercado Livre e Shopee vem em breve no Pro. Com o Instagram, não. Dá pra entrar com a conta Google, e no Premium a agenda do Google aparece junto das tarefas.",
  },
  {
    pergunta: "A IA inventa o meu preço?",
    resposta:
      "Não. O preço vem de conta: custo, taxas e meta. A IA só ajuda a completar textos que você começou no Planejamento e responde dúvidas do dia a dia. Imposto, contrato e investimento ficam fora.",
  },
  {
    pergunta: "Ainda não vendo. Serve pra mim?",
    resposta:
      "Serve. O Planejamento ajuda a definir pra quem é a marca e o que ela entrega, e o primeiro preço já nasce calculado.",
  },
  {
    pergunta: "Quem me ajuda no negócio pode entrar na mesma conta?",
    resposta: "Hoje cada conta é de uma pessoa.",
  },
  {
    // Termos, seção 8 (06/10/2026): vale só na contratação, não na renovação nem
    // na troca de Premium pro Pro. A resposta não promete mais do que isso.
    pergunta: "E se eu assinar e me arrepender?",
    resposta:
      "Nos primeiros 7 dias depois de assinar, dá pra desistir sem explicar o motivo, e o valor volta inteiro. Vale pro mensal e pro anual. O pedido é feito pelo e-mail privacidade@usepolia.com.br, a partir do e-mail da conta.",
  },
  {
    pergunta: "E se eu cancelar um plano pago?",
    resposta:
      "O plano vale até o fim do período pago. Depois a conta volta pro Grátis, com tudo o que você escreveu guardado.",
  },
];

/**
 * FAQ da home: a mesma lista com "A Pólia One é um ERP?" logo depois do "curso".
 * É o único lugar da home onde a palavra aparece (COPY-37). Exportado pro FAQPage
 * (JSON-LD) da home, pelo mesmo motivo do PERGUNTAS_MARCA_B.
 */
export const PERGUNTAS_HOME = [
  PERGUNTAS_MARCA_B[0],
  {
    pergunta: "A Pólia One é um ERP?",
    resposta:
      "Pra quem conhece o termo, funciona como um. Estoque por variação, vendas que baixam o estoque e entram no Financeiro, contas a pagar, clientes e orçamento, tudo ligado. A diferença é a ordem: um ERP começa pelo estoque, a Pólia One começa pela marca e pelo preço.",
  },
  ...PERGUNTAS_MARCA_B.slice(1),
];

/* ───────────────────────────── página ───────────────────────────── */

/**
 * Do `<main>` ao rodapé. Os ids como-funciona, produto, planos e perguntas são as
 * âncoras do menu do SiteHeader (home); scroll-mt desconta o header fixo.
 * `linkSobre` só na home: a landing de anúncio não abre saída pra outra página.
 */
export function PaginaMarcaB({
  busca,
  linkSobre = false,
  nicho = null,
  vsl = false,
  escritorio = false,
}: {
  busca: BuscaCadastro;
  linkSobre?: boolean;
  /**
   * Só a home (COPY-34, 27/10/2026): topo "o escritório da sua marca" e a seção dos
   * quatro lugares com os canais em breve. A /landing-b fica como está, pra não mexer
   * no teste de campanha no meio.
   */
  escritorio?: boolean;
  /** Topo com o VSL no lugar da foto (home e /landing-b desde 16/10/2026); false volta pra foto com o mock. */
  vsl?: boolean;
  /** Topo do nicho do anúncio (só /landing-b); null mostra o topo padrão. */
  nicho?: NichoLanding | null;
}) {
  const heroCta = useRef<HTMLAnchorElement>(null);
  const zonaPlanos = useRef<HTMLElement>(null);
  const zonaFinal = useRef<HTMLDivElement>(null);
  const zonaRodape = useRef<HTMLDivElement>(null);

  return (
    <>
      <main id="conteudo">
        {/* B1 · HERO: na home e na /landing-b o topo é o VSL (título, vídeo grande, botão);
            sem ele, a foto com o mock da Calculadora. */}
        {vsl ? (
          <HeroComVideo
            busca={busca}
            botaoRef={heroCta}
            rotulo={
              nicho
                ? `Pólia One · ${nicho.rotulo}`
                : escritorio
                  ? "Pólia One · o escritório da sua marca"
                  : "Pólia One · para quem toca a própria marca"
            }
            titulo={
              nicho
                ? nicho.titulo
                : escritorio
                  ? "Sua marca cresceu. O escritório dela continua sendo o caderno, a planilha perdida e o WhatsApp."
                  : "Sua marca já vale mais do que você está cobrando."
            }
            subtitulo={
              nicho
                ? nicho.subtitulo
                : escritorio
                  ? "A Pólia One é o escritório da sua marca: preço, estoque, vendas e dinheiro no mesmo lugar."
                  : "A Pólia One liga a sua marca, o custo de cada produto e a meta do mês. Na hora do orçamento, o preço sai dessa conta."
            }
            micro={
              escritorio && !nicho ? "Sem cartão. Conta nova começa com 7 dias de Pro." : undefined
            }
          />
        ) : (
          <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
            <div className="grid grid-cols-1 items-center gap-x-[clamp(32px,5vw,64px)] gap-y-12 md:grid-cols-[55fr_45fr]">
              <div>
                <Rotulo>
                  {nicho
                    ? `Pólia One · ${nicho.rotulo}`
                    : "Pólia One · para quem toca a própria marca"}
                </Rotulo>
                {/* h1, subtítulo e botão fora do Reveal de propósito: chegam visíveis no HTML
                  do servidor, sem esperar o JS (LCP e anúncio em 4G). */}
                <h1 className="mt-4 text-[clamp(30px,3.2vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance max-md:text-[32px]">
                  {nicho ? nicho.titulo : "Sua marca já vale mais do que você está cobrando."}
                </h1>
                {nicho ? (
                  <p className={`mt-6 ${CORPO}`}>{nicho.subtitulo}</p>
                ) : (
                  <p className={`mt-6 ${CORPO}`}>
                    A Pólia One junta o que a sua marca é, quanto ela precisa render no mês e quanto
                    custa cada produto. Na hora do orçamento,{" "}
                    <b className="font-semibold">
                      <HighlightWord delay={0.3}>o preço sai dessa conta</HighlightWord>
                    </b>
                    , não do chute nem da concorrente.
                  </p>
                )}
                <div className="mt-8">
                  <BotaoCadastro busca={busca} contexto="hero" botaoRef={heroCta} />
                  <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
                </div>
              </div>

              <div className="relative">
                <FotoLanding
                  nome={nicho ? nicho.foto : "hero-orcamento-celular"}
                  alt={
                    nicho
                      ? nicho.alt
                      : "Mão segurando o celular com um pedido de orçamento aberto, sobre a mesa de trabalho com cadernos de aquarela."
                  }
                  proporcao="4/5"
                  prioridade
                />
                <Reveal
                  delay={0.2}
                  className="relative -mt-10 w-[85%] max-w-[320px] md:absolute md:bottom-12 md:left-0 md:mt-0 lg:-left-12"
                >
                  <MockCalculadoraHero />
                </Reveal>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
          </Secao>
        )}

        {/* B9b · PRA QUE NEGÓCIO: seção própria pra não espremer o "pra quem é". Desde
            23/10/2026 (pedido da Sil) as duas vêm logo depois do topo, antes da prova. */}
        <Secao fundo="surface-pink">
          <Rotulo>Pra que negócio</Rotulo>
          <h2 className={`mt-4 ${H2}`}>De confeitaria a consultório.</h2>
          <Reveal className="mt-10">
            <ul className="flex list-none flex-wrap gap-3">
              {negocios.map((n) => (
                <li
                  key={n}
                  className="rounded-full bg-white px-4 py-2 text-[16px] leading-[1.4] text-[var(--ink)] max-md:text-[15px]"
                >
                  {n}
                </li>
              ))}
            </ul>
          </Reveal>
          <p className={`mt-10 ${CORPO} !text-[var(--ink)]`}>
            Não achou o seu? Se tem custo, preço e cliente, a Pólia One é pra você.
          </p>
        </Secao>

        {/* B10 · PRA QUEM É */}
        <Secao>
          <FotoLanding
            nome="praquem-bancada-pedidos"
            alt="Bancada com pedidos embalados em papel kraft, etiquetas escritas à mão e fita turquesa."
            proporcao="21/9"
            largura={2100}
          />
          <div className="mt-12">
            <Rotulo>Pra quem é</Rotulo>
            <h2 className={`mt-4 mb-8 ${H2}`}>Feita pra quem toca a própria marca.</h2>
            <ParaQuem sim={escritorio ? praQuemSimEscritorio : praQuemSim} nao={praQuemNao} />
          </div>
        </Secao>

        {/* B2 · PROVA */}
        <Secao fundo="surface" className="!py-[clamp(48px,6vw,64px)]">
          <Rotulo>O que a pesquisa da Pólia ouviu</Rotulo>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[3fr_4fr_5fr] md:items-start">
            <NumeroProva
              numero="44%"
              texto="não fazem ideia de quanto tiram pra si no fim do mês."
            />
            <div className="md:border-l md:border-[var(--line)] md:pl-8">
              <NumeroProva numero="57%" texto="misturam o dinheiro da casa com o do negócio." />
            </div>
            <NotaPesquisa
              fundo="branco"
              className="col-span-2 md:col-span-1"
              texto="...entra e sai dinheiro e eu não enxergo se lucro ou só fico girando"
            />
          </div>
          <FontePesquisa>
            Pesquisa da Pólia com empreendedoras de grupos de negócio, julho de 2026. Respostas
            anônimas.
          </FontePesquisa>
        </Secao>

        {/* B3 · O PROBLEMA */}
        <Secao>
          <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[6fr_5fr]">
            {escritorio ? (
              <div>
                <Rotulo>A cena</Rotulo>
                <h2 className={`mt-4 ${H2}`}>
                  O pedido chega no WhatsApp. A conta se espalha pela semana.
                </h2>
                <ul className="mt-6 flex list-none flex-col gap-2">
                  {semanaDaCena.map((linha) => (
                    <li key={linha} className={CORPO}>
                      {linha}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <Rotulo>A cena</Rotulo>
                <h2 className={`mt-4 ${H2}`}>
                  O orçamento chega no WhatsApp. O preço sai no susto.
                </h2>
                <p className={`mt-6 ${CORPO}`}>
                  Você muda o valor umas três vezes antes de mandar. A cliente diz que tá caro, você
                  amolece, e o desconto sai do seu lucro. Depois vem a noite remoendo se cobrou
                  certo.
                </p>
              </div>
            )}
            <FotoLanding
              nome="problema-caderno-contas"
              alt="Caderno aberto com contas a lápis riscadas e refeitas, calculadora do celular e embalagens de papel kraft."
              proporcao="3/2"
            />
          </div>
          <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
            {(escritorio ? notasEscritorio : notasProblema).map((n, i) => (
              <Reveal key={n} delay={i * 0.08} className={["", "md:mt-6", "md:mt-12"][i]}>
                <NotaPesquisa texto={n} />
              </Reveal>
            ))}
          </div>
          <p className={`mt-12 ${CORPO}`}>
            E o custo disso não aparece no dia. Aparece no fim do mês, quando o dinheiro entrou,
            saiu, <b className="font-semibold text-[var(--ink)]">se misturou com a conta de casa</b>{" "}
            e ninguém sabe dizer quanto foi lucro.
          </p>
        </Secao>

        {/* B4 · O JEITO DE HOJE (na home, com o diagnóstico fechando o bloco) */}
        <Secao fundo="surface" respiro>
          <Rotulo>O jeito de hoje</Rotulo>
          <h2 className={`mt-4 max-w-[24ch] ${H2}`}>
            {escritorio
              ? "Cada ferramenta resolve um pedaço. Nenhuma conversa com a outra."
              : "O caderno guarda o que aconteceu. Não diz se o próximo preço fecha o mês."}
          </h2>
          <div className="mt-10 max-w-[820px]">
            <ListaEditorial itens={escritorio ? jeitoDeHojeEscritorio : jeitoDeHoje} />
          </div>
          {escritorio && (
            <FraseAncora className="mt-12 !max-w-[44ch]">
              Não é falta de organização. Quem não se organiza não dá conta de 50 peças numa semana.
              É uma marca que virou empresa e um escritório que ficou no caderno.
            </FraseAncora>
          )}
        </Secao>

        {/* B5 · O MECANISMO */}
        <Secao fundo="secondary-light">
          <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[4fr_7fr]">
            <FotoLanding
              nome="mecanismo-maos-aquarela"
              alt="Mãos pintando uma aquarela numa página de caderno feito à mão."
              proporcao="4/5"
            />
            <div>
              <Rotulo>A marca abre. O número prova.</Rotulo>
              <h2 className={`mt-4 ${H2}`}>
                Quando a cliente diz que tá caro, quase nunca é sobre o preço.
              </h2>
              <p className={`mt-6 ${CORPO}`}>
                É sobre o que ela ainda não viu: as horas da peça feita à mão, o material escolhido,
                o motivo de a sua marca existir. Por isso a Pólia One começa pela marca.
              </p>
              <NotaPesquisa
                fundo="branco"
                className="mt-8"
                texto="uma cliente perguntou porque ela devia comprar comigo e não na loja, e eu não soube responder, fiquei sem chão"
              />
            </div>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            <p className={CORPO}>
              <b className="font-semibold text-[var(--ink)]">A marca dá o argumento.</b> No
              Planejamento, a Pólia One pergunta por que a sua marca existe, pra quem ela é e o que
              ela entrega. Dali sai a resposta pro &ldquo;tá caro&rdquo;, com as suas palavras.
            </p>
            <p className={CORPO}>
              <b className="font-semibold text-[var(--ink)]">O número dá a prova.</b> Depois vem a
              conta: quanto você quer receber e quanto custa manter a marca de pé. Isso vira a meta
              do mês, e{" "}
              <b className="font-semibold text-[var(--ink)]">
                todo preço calculado na Pólia One é comparado com ela
              </b>
              .
            </p>
          </div>
          <MockFluxoMarcaPrecoMes className="mt-12" />
          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">Números de exemplo.</p>
          <FraseAncora className="mt-10">
            A marca dá coragem pro preço. O número prova que a coragem tinha razão.
          </FraseAncora>
        </Secao>

        {/* B5b · O ESCRITÓRIO: só na home. Depois da marca (eixo marca primeiro), o que a
            venda faz sozinha e o que vem aí nos canais. */}
        {escritorio && (
          <Secao fundo="surface" id="produto" className="scroll-mt-[88px]">
            <Rotulo>O escritório da marca</Rotulo>
            <h2 className={`mt-4 ${H2}`}>Uma venda. Quatro lugares em dia.</h2>
            <p className={`mt-6 max-w-[60ch] ${CORPO}`}>
              A venda entra uma vez. A Pólia One leva ela pra cada lugar que depende dela, e ninguém
              digita a mesma coisa duas vezes.
            </p>
            <div className="mt-10">
              <ListaEditorial itens={quatroLugares} colunas={2} />
            </div>

            <div className="mt-16 border-t border-[var(--line)] pt-12">
              <Rotulo>O que vem aí</Rotulo>
              <h3 className="mt-4 max-w-[30ch] text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.02em] text-balance text-[var(--ink)]">
                Vendeu no TikTok Shop, no Mercado Livre ou na Shopee. A conta fecha num lugar só.
              </h3>
              <p className={`mt-5 max-w-[60ch] ${CORPO}`}>
                O pedido do canal vira venda na Pólia One, com a taxa daquele canal já descontada, e
                o estoque baixa nos dois lados.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ul className="flex list-none flex-wrap gap-3">
                  {canaisEmBreve.map((c) => (
                    <li
                      key={c}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[16px] leading-[1.4] text-[var(--ink)] max-md:text-[15px]"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
                <span className="flex items-center gap-2 text-[14px] text-[var(--muted)]">
                  <EtiquetaPlano nome="Pro" />
                  Em breve
                </span>
              </div>
            </div>
          </Secao>
        )}

        {/* B6 · COMO FUNCIONA */}
        <Secao id="como-funciona" className="scroll-mt-[88px]">
          <Rotulo>Como funciona</Rotulo>
          <h2 className={`mt-4 mb-10 max-w-[26ch] ${H2}`}>
            {escritorio
              ? "Da razão de existir da marca ao mês que fecha."
              : "Da razão de existir da marca ao preço que fecha o mês."}
          </h2>
          <ComoFuncionaPassos
            passos={[
              {
                n: "01",
                titulo: "A marca no papel",
                texto:
                  "Seis módulos curtos, cerca de vinte minutos cada. A Pólia One pergunta da marca primeiro e do dinheiro depois, e guarda onde você parou.",
                mock: <MockPerguntaMarca />,
              },
              {
                n: "02",
                titulo: "O preço na conta",
                texto:
                  "Na Calculadora, o custo do produto, as taxas da maquininha ou do marketplace e o lucro que a marca precisa viram um preço sugerido. O desconto pode ser simulado antes de ser dado.",
                mock: <MockCalculadoraHero />,
              },
              // Home (COPY-37): o caminho passa pela venda antes do mês.
              ...(escritorio
                ? [
                    {
                      n: "03",
                      titulo: "A venda num lugar só",
                      texto:
                        "O orçamento que a cliente aprova pelo link vira venda. A venda baixa o estoque, o kit baixa cada item e o dinheiro entra no Financeiro, já sem a taxa.",
                      mock: <MockVendaEstoque />,
                    },
                  ]
                : []),
              {
                n: escritorio ? "04" : "03",
                titulo: "O mês à vista",
                texto: (
                  <>
                    A cada venda registrada, o Painel mostra{" "}
                    <b className="font-semibold">quanto falta pra fechar as contas do mês</b>.
                  </>
                ),
                mock: <MockFraseMes />,
              },
            ]}
          />
          <p className="mt-6 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* B7 · POR DENTRO: sai da home (COPY-37), repetia o escritório e o como funciona.
            A âncora #produto do menu foi pro bloco do escritório. */}
        {!escritorio && (
          <Secao fundo="surface" id="produto" className="scroll-mt-[88px]">
            <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[4fr_7fr]">
              <div>
                <Rotulo>Por dentro</Rotulo>
                <h2 className={`mt-4 ${H2}`}>O preço, o lucro e o mês, na mesma tela.</h2>
                <p className={`mt-6 ${CORPO}`}>
                  Exemplo da Ana, que faz cadernos de aquarela: a Calculadora mostra o preço
                  sugerido, quanto a marca lucra em cada venda e como esse preço conversa com a meta
                  do mês dela.
                </p>
                <p className="mt-4 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
              </div>
              <MockDescontoSimulado />
            </div>
          </Secao>
        )}

        {/* B8 · O QUE MUDA: na home vira surface, porque sem o "Por dentro" encostaria
            no Como funciona, que é bg. */}
        <Secao fundo={escritorio ? "surface" : "bg"}>
          <Rotulo>O que muda</Rotulo>
          <h2 className={`mt-4 mb-10 max-w-[24ch] ${H2}`}>
            Cada decisão de dinheiro com um número do lado.
          </h2>
          <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[7fr_5fr]">
            <div className="flex flex-col gap-10">
              {(escritorio ? oQueMudaEscritorio : oQueMuda).map(({ grupo, itens }) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-[20px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)]">
                    {grupo}
                  </h3>
                  <ListaEditorial itens={itens} />
                </div>
              ))}
            </div>
            <div className="md:sticky md:top-[112px]">
              <MockTresNumeros />
              <p className="mt-3 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
            </div>
          </div>
        </Secao>

        {/* B9 · QUEM FEZ: rosa porque agora encosta direto nos Planos, que são surface. */}
        <Secao fundo="surface-pink">
          <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[5fr_6fr]">
            <figure>
              <FotoLanding
                nome="quemfez-sil-retrato"
                alt="Sil, fundadora da Pólia, sorrindo, de blusa clara, em casa."
                proporcao="4/5"
              />
              <figcaption className="mt-3 text-[13px] text-[var(--muted)]">
                Sil, fundadora da Pólia
              </figcaption>
            </figure>
            <div>
              <Rotulo>Quem fez</Rotulo>
              <h2 className={`mt-4 ${H2}`}>
                Meu negócio vendia bem. Eu só não sabia quanto lucrava.
              </h2>
              <p className={`mt-6 ${CORPO}`}>
                Sou a Sil. Foram{" "}
                <b className="font-semibold text-[var(--ink)]">14 anos de e-commerce</b>, 8 deles no
                meu próprio negócio, e projetos com marcas como C&amp;A, Allied, ArcelorMittal e
                Bradesco. Depois vieram as consultorias com empreendedoras que viviam a mesma conta
                que eu vivia.
              </p>
              <p className={`mt-4 ${CORPO}`}>
                {escritorio
                  ? "A Pólia One é o escritório que eu queria ter tido quando a minha marca cresceu."
                  : "A Pólia One é a ferramenta que eu queria ter aberto toda vez que um orçamento chegava."}{" "}
                Eu construo a Pólia usando a Pólia.
              </p>
              {linkSobre && (
                <Link
                  to="/sobre"
                  className="mt-6 inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  Ler a história inteira
                </Link>
              )}
            </div>
          </div>
        </Secao>

        {/* B11 · PLANOS */}
        <Secao fundo="surface" id="planos" secaoRef={zonaPlanos} className="scroll-mt-[88px]">
          <Rotulo>Planos</Rotulo>
          <h2 className={`mt-4 mb-8 ${H2}`}>Começa no Grátis. Sobe quando a conta pedir.</h2>
          <PlanosLanding planos={planos} busca={busca} />
          <p className={`mt-8 ${CORPO}`}>
            No anual, o ano custa 10 mensalidades: Premium {precoBR(premium.precoAnual)}, Pro{" "}
            {precoBR(pro.precoAnual)}.
          </p>
          <FraseAncora className="mt-6">
            Um desconto dado no chute pode custar mais do que um mês de assinatura.
          </FraseAncora>
          <p className={`mt-6 ${CORPO}`}>
            Cancelar é um clique. A conta volta pro Grátis e o que você escreveu continua seu.
          </p>
        </Secao>

        {/* B12 · FAQ */}
        <Secao id="perguntas" className="scroll-mt-[88px]">
          <h2 className={`mb-8 ${H2}`}>Perguntas frequentes</h2>
          <FaqLanding perguntas={escritorio ? PERGUNTAS_HOME : PERGUNTAS_MARCA_B} />
        </Secao>
        <div ref={zonaFinal}>
          {/* B13 · CTA FINAL */}
          <Secao fundo="secondary">
            <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[7fr_4fr]">
              <div>
                <h2 className="text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)]">
                  {escritorio
                    ? "Por fora, a marca que a cliente lembra. Por dentro, o escritório que fecha a conta."
                    : "O próximo orçamento vai chegar de qualquer jeito."}
                </h2>
                <p className="mt-5 text-[18px] leading-[1.6] text-[var(--ink)]">
                  {escritorio
                    ? "Começa no Grátis, com 7 dias de Pro pra usar tudo."
                    : "A Pólia One deixa o preço pronto antes dele."}
                </p>
                <div className="mt-8">
                  <BotaoCadastro busca={busca} contexto="final" invertido />
                  <p className="mt-3 text-[13px] text-[var(--ink)]">Sem cartão no Grátis.</p>
                </div>
              </div>
              <FotoLanding
                nome="ctafinal-celular-pedido"
                alt="Celular na mesa com a notificação de um novo pedido de dois cadernos, ao lado de uma etiqueta de preço preenchida."
                proporcao="1/1"
                borda
              />
            </div>
          </Secao>
        </div>
      </main>

      <div ref={zonaRodape}>
        <SiteFooter semMargemTopo />
      </div>

      <BarraCtaMobile
        busca={busca}
        heroCta={heroCta}
        zonasSemBarra={[zonaPlanos, zonaFinal, zonaRodape]}
      />
    </>
  );
}
