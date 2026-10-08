import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useRef } from "react";
import {
  Archive,
  BadgePercent,
  Brain,
  Calculator,
  PackageCheck,
  Percent,
  Ruler,
  Tag,
  TrendingUp,
} from "lucide-react";
import { linkCanonico } from "@/lib/seo";
import { lerUtmsDaQuery } from "@/lib/origemCampanha";
import { TIERS_PAGOS } from "@/lib/planos";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import {
  BarraCtaMobile,
  BotaoCadastro,
  ComoFuncionaPassos,
  CORPO,
  FaqLanding,
  FontePesquisa,
  FotoLanding,
  FraseAncora,
  H2,
  HeaderCampanha,
  LinkCadastro,
  ListaEditorial,
  NotaPesquisa,
  ParaQuem,
  PlanosLanding,
  Rotulo,
  Secao,
  type BuscaCadastro,
  type ItemLista,
  type PlanoLanding,
} from "@/components/landing/BlocosLanding";
import {
  MockCustosProduto,
  MockDescontoHero,
  MockDescontoSimulado,
  MockVendasMeta,
} from "@/components/landing/MocksLanding";
import { precoBR } from "@/components/landing/preco";

// Landing A de campanha (06/10/2026): Ângulo A, "o próximo orçamento". Copy em
// COPY-LANDING-A-POLIA-ONE.md e layout em WIREFRAME-LANDINGS-POLIA-ONE.md, na raiz
// do workspace. Tudo puxa pra Calculadora, que está no Grátis; a marca entra no
// meio da página como o que segura o preço quando a cliente diz que tá caro.

export const Route = createFileRoute("/landing-a")({
  // Sem validateSearch de propósito: as UTMs são lidas da query crua (lerUtmsDaQuery),
  // porque o router faria JSON.parse e um ID de anúncio longo perderia dígito.
  head: () => ({
    meta: [
      { title: "Pólia One · O orçamento chegou. A conta vem antes da resposta" },
      {
        name: "description",
        content:
          "Custo do material, taxa da maquininha, quanto precisa sobrar: a Pólia One mostra o preço e o que sobra nele antes de você responder a cliente.",
      },
      // Página de campanha: fora do índice e do sitemap, pra não competir com a home.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [linkCanonico("/landing-a")],
  }),
  component: LandingA,
});

/* ───────────────────────────── conteúdo ───────────────────────────── */

const notasCena = [
  "me pediram orçamento de uma festa infantil e eu não sabia quanto cobrar, fiquei com o celular na mão sem saber o que responder",
  "teve um cliente grande que pediu uma proposta e eu simplesmente travei no valor, passei uns três dias sem responder com medo de cobrar demais e ele desistir",
  "fiz a sobrancelha de uma amiga de graça e quando ela me indicou uma cliente eu não sabia quanto pedir, gaguejei e acabei cobrando uma miséria de vergonha",
  "peguei uma vez uma encomenda grande de lembrancinha, topei na hora toda animada, e quando fui fazer as contas vi que quase não ia sobrar nada de tanto material",
];

const contaNaHora: ItemLista[] = [
  {
    icone: Brain,
    titulo: "De cabeça,",
    texto: "entra o material e somem a taxa da maquininha, a embalagem e as horas de trabalho.",
  },
  {
    icone: Tag,
    titulo: "O preço da concorrente",
    texto: "foi feito com o custo dela, não com o seu.",
  },
  {
    icone: BadgePercent,
    titulo: "O desconto dado na hora",
    texto: "sai do que ia sobrar pra você, e quase ninguém faz essa conta antes de ceder.",
  },
];

const oQueMuda: ItemLista[] = [
  {
    icone: Calculator,
    titulo: "Produto ou serviço.",
    texto: "A Calculadora funciona pra peça pronta e pra serviço cobrado por hora.",
    planos: ["Grátis"],
  },
  {
    icone: Percent,
    titulo: "Desconto antes de ceder.",
    texto: "O preço com desconto e o que sobra nele, antes de responder a cliente.",
    planos: ["Grátis"],
  },
  {
    icone: Archive,
    titulo: "O preço guardado.",
    texto: "Cada produto com custo, preço, quanto sobra e o histórico de preço.",
    planos: ["Grátis até 5", "Premium sem limite"],
  },
  {
    icone: PackageCheck,
    titulo: "Pedido acompanhado.",
    texto:
      "Cada cliente com o status da encomenda, da espera à entrega. Entregou, vira venda no Financeiro com um clique.",
    planos: ["Premium"],
  },
  {
    icone: Ruler,
    titulo: "Encomenda sob medida.",
    texto: "Uma calculadora própria pra pedido que foge do catálogo.",
    planos: ["Pro"],
  },
  {
    icone: TrendingUp,
    titulo: "Quantas vendas faltam.",
    texto: "A Projeção mostra quanto falta pra empatar, pra se pagar e pra bater a meta.",
    planos: ["Pro"],
  },
];

const praQuemSim = [
  "Recebe pedido por WhatsApp, Instagram ou no balcão.",
  "Faz encomenda, peça sob medida ou serviço cobrado por hora.",
  "Já mudou o preço antes de mandar, ou cedeu no desconto e se arrependeu.",
  "Vende produto ou serviço, sozinha ou com alguém ajudando.",
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
    praQuem: "Pra ter o próximo orçamento com a conta feita.",
    mensal: "R$ 0",
    itemForte: 0,
    itens: [
      "Calculadora de preço, pra produto e serviço, com simulação de desconto",
      "Até 5 produtos e 3 metas",
      "Os 6 módulos do Planejamento (os documentos de Marca e Mercado são do Premium)",
      "Assistente pra tirar dúvida, com limite por dia",
    ],
  },
  {
    nome: "Premium",
    etiqueta: "Pra quem já vende",
    praQuem: "Pra quem tem pedido toda semana e quer o mês sob controle.",
    mensal: precoBR(premium.precoMensal),
    anual: precoBR(premium.precoAnual),
    itens: [
      "Catálogo sem limite, cada produto com custo, preço e quanto sobra",
      "Clientes com o status de cada pedido, da espera à entrega",
      "Financeiro com os três números que decidem o mês",
      "Documentos de Marca e Mercado, escritos a partir do Planejamento",
      "Planner sem limite, e o Calendário com a agenda do Google junto",
    ],
  },
  {
    nome: "Pro",
    praQuem: "Pra quem faz encomenda sob medida e quer saber quantas vendas faltam.",
    mensal: precoBR(pro.precoMensal),
    anual: precoBR(pro.precoAnual),
    itens: [
      "Calculadora de encomenda sob medida",
      "Projeção: quantas vendas faltam pra empatar, pra se pagar e pra bater a meta",
      "Raio-x do mês: o que puxou o resultado e o que muda no mês seguinte",
      "Resumo do mês pro contador, em PDF e CSV",
      "Plano de conteúdo: 60 ideias do seu nicho espalhadas pelo ano, uma por dia",
    ],
  },
];

const perguntas = [
  {
    pergunta: "Preciso preencher o Planejamento antes de usar a Calculadora?",
    resposta:
      "Não. A Calculadora funciona sozinha logo depois do cadastro. O Planejamento entra quando fizer sentido ligar o preço à meta do mês e à marca.",
  },
  {
    pergunta: "Isso não é só uma calculadora?",
    resposta:
      "Não. A Calculadora é a porta. Atrás dela estão o catálogo com o histórico de preço, a meta do mês, o Planejamento da marca e o Painel que mostra quanto falta pra fechar as contas.",
  },
  {
    pergunta: "A Pólia One me diz o preço certo?",
    resposta:
      "A Pólia One sugere um preço a partir dos seus custos e de quanto precisa sobrar. A decisão continua sua, agora com a conta na frente.",
  },
  {
    pergunta: "Serve pra serviço e pra encomenda?",
    resposta:
      "Serve. Serviço é calculado por hora, no Grátis. Encomenda sob medida tem calculadora própria, no Pro.",
  },
  {
    pergunta: "Preciso entender de número?",
    resposta:
      "Não. Você coloca o que já sabe: quanto pagou no material, quanto a maquininha cobra, quanto quer que sobre. A conta é da Pólia One.",
  },
  {
    pergunta: "Conecta com o WhatsApp ou com o Instagram?",
    resposta:
      "Ainda não. O pedido continua chegando onde chega, e a conta fica na Pólia One, aberta no navegador do celular ao lado.",
  },
  {
    pergunta: "A IA inventa o meu preço?",
    resposta:
      "Não. O preço vem de conta: custo, taxas e quanto precisa sobrar. A IA só ajuda a completar textos do Planejamento e responde dúvidas do dia a dia.",
  },
  {
    // Termos, seção 8 (06/10/2026): só na contratação, não na renovação.
    pergunta: "E se eu assinar e me arrepender?",
    resposta:
      "Nos primeiros 7 dias depois de assinar, dá pra desistir sem explicar o motivo, e o valor volta inteiro. Vale pro mensal e pro anual. O pedido é feito pelo e-mail privacidade@usepolia.com.br, a partir do e-mail da conta.",
  },
  {
    pergunta: "E se eu cancelar um plano pago?",
    resposta:
      "O plano vale até o fim do período pago. Depois a conta volta pro Grátis, com tudo guardado.",
  },
];

/* ───────────────────────────── página ───────────────────────────── */

function LandingA() {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const busca: BuscaCadastro = { origem: "landing-a", ...lerUtmsDaQuery(searchStr) };
  const heroCta = useRef<HTMLAnchorElement>(null);
  const zonaPlanos = useRef<HTMLElement>(null);
  const zonaFinal = useRef<HTMLDivElement>(null);
  const zonaRodape = useRef<HTMLDivElement>(null);

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <HeaderCampanha busca={busca} />

      <main id="conteudo">
        {/* A1 · HERO */}
        <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
          <div className="grid grid-cols-1 items-center gap-x-[clamp(32px,5vw,64px)] gap-y-12 md:grid-cols-[55fr_45fr]">
            <div>
              <Rotulo>Pólia One · pra hora do orçamento</Rotulo>
              {/* h1, subtítulo e botão fora do Reveal de propósito: chegam visíveis no HTML
                  do servidor, sem esperar o JS. Título longo: override menor. */}
              <h1 className="mt-4 text-[clamp(24px,2.8vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance max-md:text-[28px]">
                O orçamento chegou. A Pólia One faz a conta antes de você responder.
              </h1>
              <p className={`mt-6 ${CORPO}`}>
                Custo do material, taxa da maquininha, quanto precisa sobrar: a Pólia One junta tudo
                e mostra{" "}
                <b className="font-semibold">
                  <HighlightWord delay={0.3}>o preço e o que sobra nele</HighlightWord>
                </b>
                . Se a cliente pedir desconto, mostra quanto fica com o desconto também.
              </p>
              <div className="mt-8">
                <BotaoCadastro busca={busca} contexto="hero" botaoRef={heroCta} />
                <p className="mt-3 text-[13px] text-[var(--muted)]">
                  A Calculadora está no plano Grátis. Sem cartão.
                </p>
              </div>
            </div>

            <div className="relative">
              <FotoLanding
                nome="hero-orcamento-celular"
                alt="Mão segurando o celular com um pedido de orçamento aberto, sobre a mesa de trabalho com cadernos de aquarela."
                proporcao="4/5"
                prioridade
              />
              <Reveal
                delay={0.2}
                className="relative -mt-10 w-[85%] max-w-[320px] md:absolute md:bottom-12 md:left-0 md:mt-0 lg:-left-12"
              >
                <MockDescontoHero />
              </Reveal>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* A2 · A CENA */}
        <Secao fundo="surface">
          <Rotulo>A cena</Rotulo>
          <h2 className={`mt-4 max-w-[28ch] ${H2}`}>
            Celular na mão, cliente esperando, e o valor mudando antes de mandar.
          </h2>
          <div className="mt-10 grid grid-cols-1 items-start gap-[clamp(24px,4vw,48px)] md:grid-cols-[8fr_4fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
              {notasCena.map((n, i) => (
                <Reveal key={n} delay={i * 0.08}>
                  <NotaPesquisa texto={n} fundo="branco" />
                </Reveal>
              ))}
            </div>
            <FotoLanding
              nome="a-cena-encomenda-lembrancinhas"
              alt="Mãos amarrando laço numa mesa cheia de lembrancinhas de festa em produção."
              proporcao="4/5"
            />
          </div>
          <p className={`mt-12 ${CORPO}`}>
            Quando o preço sai no susto, ele erra pros dois lados. Alto demais, a cliente some.{" "}
            <b className="font-semibold text-[var(--ink)]">
              Baixo demais, a encomenda fecha e quase nada sobra.
            </b>{" "}
            E nos dois casos vem a noite remoendo.
          </p>
          <p className="mt-8 max-w-[44ch] text-[clamp(20px,2vw,24px)] leading-[1.45] text-[var(--ink)]">
            Na pesquisa da Pólia,{" "}
            <b className="font-cabinet text-[1.6em] font-bold leading-none">29%</b> disseram que não
            sabem quanto cobrar e{" "}
            <b className="font-cabinet text-[1.6em] font-bold leading-none">28%</b> que a cliente
            acha caro.
          </p>
          <FontePesquisa>
            Pesquisa da Pólia com empreendedoras de grupos de negócio, julho de 2026. 90 respostas.
          </FontePesquisa>
          <FraseAncora className="mt-8">
            Travar no orçamento não é falta de coragem. É falta do número.
          </FraseAncora>
        </Secao>

        {/* A3 · POR QUE A CONTA NÃO SAI NA HORA */}
        <Secao>
          <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[6fr_5fr]">
            <div>
              <Rotulo>O que acontece hoje</Rotulo>
              <h2 className={`mt-4 ${H2}`}>
                Na hora do orçamento, ninguém abre o caderno pra fazer a conta inteira.
              </h2>
              <div className="mt-8">
                <ListaEditorial itens={contaNaHora} />
              </div>
            </div>
            <FotoLanding
              nome="problema-caderno-contas"
              alt="Caderno aberto com contas a lápis riscadas e refeitas, calculadora do celular e embalagens de papel kraft."
              proporcao="3/2"
            />
          </div>
          <FraseAncora className="mt-8">
            A Pólia One foi feita pra esse minuto: entre a mensagem da cliente e a sua resposta.
          </FraseAncora>
        </Secao>

        {/* A4 · COMO FUNCIONA */}
        <Secao fundo="surface">
          <Rotulo>Como funciona</Rotulo>
          <h2 className={`mt-4 mb-10 ${H2}`}>Do pedido ao preço, em três passos.</h2>
          <ComoFuncionaPassos
            passos={[
              {
                n: "01",
                titulo: "Os custos entram uma vez",
                texto:
                  "Material, embalagem, taxa da maquininha ou do marketplace, imposto e, se for serviço, as horas de trabalho. Ficam salvos no produto.",
                mock: <MockCustosProduto />,
              },
              {
                n: "02",
                titulo: "O preço sai da conta",
                texto: (
                  <>
                    A Pólia One mostra o preço sugerido e{" "}
                    <b className="font-semibold">quanto sobra em cada venda</b>. Pediram desconto?
                    Coloque a porcentagem e ela mostra o que fica, e avisa se o desconto dá
                    prejuízo.
                  </>
                ),
                mock: <MockDescontoHero />,
              },
              {
                n: "03",
                titulo: "O mês entra na conta",
                texto:
                  "Com a meta do mês preenchida no Planejamento, a Calculadora mostra quantas vendas daquele produto fecham o mês.",
                mock: <MockVendasMeta />,
              },
            ]}
          />
          <p className="mt-6 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* A5 · POR DENTRO */}
        <Secao>
          <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[4fr_8fr]">
            <div>
              <Rotulo>Por dentro</Rotulo>
              <h2 className={`mt-4 ${H2}`}>Antes de dar o desconto, a conta do desconto.</h2>
              <p className={`mt-6 ${CORPO}`}>
                Exemplo da Ana, que faz cadernos de aquarela. Com 15% de desconto, a Calculadora
                mostra o preço novo e quanto ainda sobra. Se o desconto dá prejuízo, a tela avisa.
              </p>
              <p className="mt-4 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
              <div className="mt-4">
                <LinkCadastro busca={busca} contexto="por_dentro">
                  Quero testar no meu produto
                </LinkCadastro>
              </div>
            </div>
            <MockDescontoSimulado />
          </div>
        </Secao>

        {/* A6 · E QUANDO DIZEM QUE TÁ CARO */}
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
                O número diz quanto cobrar. A marca diz por que custa isso.
              </h2>
              <p className={`mt-6 ${CORPO}`}>
                Ter o preço certo não impede a cliente de achar caro. O que segura o preço é ter a
                resposta pronta: o material escolhido, as horas de mão, o motivo de a sua marca
                existir.
              </p>
              <NotaPesquisa
                fundo="branco"
                className="mt-8"
                texto="uma cliente perguntou porque ela devia comprar comigo e não na loja, e eu não soube responder, fiquei sem chão"
              />
              <p className={`mt-8 ${CORPO}`}>
                No Planejamento, a Pólia One pergunta por que a sua marca existe, pra quem ela é e o
                que ela entrega.{" "}
                <b className="font-semibold text-[var(--ink)]">
                  Dali sai a resposta pro &ldquo;tá caro&rdquo;
                </b>
                , com as suas palavras.
              </p>
              <FraseAncora className="mt-8">
                A marca dá coragem pro preço. O número prova que a coragem tinha razão.
              </FraseAncora>
            </div>
          </div>
        </Secao>

        {/* A7 · O QUE MUDA */}
        <Secao fundo="surface">
          <Rotulo>O que muda</Rotulo>
          <h2 className={`mt-4 mb-10 ${H2}`}>Cada orçamento com a conta feita.</h2>
          <ListaEditorial itens={oQueMuda} colunas={2} />
        </Secao>

        {/* A8 · QUEM FEZ */}
        <Secao>
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
                Meu negócio vendia bem. Eu só não sabia quanto sobrava.
              </h2>
              <p className={`mt-6 ${CORPO}`}>
                Sou a Sil. Foram{" "}
                <b className="font-semibold text-[var(--ink)]">14 anos de e-commerce</b>, 8 deles no
                meu próprio negócio, e projetos com marcas como C&amp;A, Allied, ArcelorMittal e
                Bradesco.
              </p>
              <p className={`mt-4 ${CORPO}`}>
                A Pólia One é a ferramenta que eu queria ter aberto toda vez que um orçamento
                chegava.
              </p>
            </div>
          </div>
        </Secao>

        {/* A9 · PRA QUEM É */}
        <Secao fundo="surface">
          <FotoLanding
            nome="praquem-bancada-pedidos"
            alt="Bancada com pedidos embalados em papel kraft, etiquetas escritas à mão e fita turquesa."
            proporcao="21/9"
            largura={2100}
          />
          <div className="mt-12">
            <Rotulo>Pra quem é</Rotulo>
            <h2 className={`mt-4 mb-8 ${H2}`}>Feita pra quem passa orçamento toda semana.</h2>
            <ParaQuem sim={praQuemSim} nao={praQuemNao} />
          </div>
        </Secao>

        {/* A10 · PLANOS */}
        <Secao id="planos" secaoRef={zonaPlanos}>
          <Rotulo>Planos</Rotulo>
          <h2 className={`mt-4 mb-8 ${H2}`}>A Calculadora já vem no Grátis.</h2>
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

        {/* A11 · FAQ */}
        <Secao fundo="surface">
          <h2 className={`mb-8 ${H2}`}>Perguntas frequentes</h2>
          <FaqLanding perguntas={perguntas} />
        </Secao>
        <div ref={zonaFinal}>
          {/* A12 · CTA FINAL */}
          <Secao fundo="secondary">
            <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[7fr_4fr]">
              <div>
                <h2 className="text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)]">
                  O próximo orçamento vai chegar de qualquer jeito.
                </h2>
                <p className="mt-5 text-[18px] leading-[1.6] text-[var(--ink)]">
                  A Pólia One deixa a conta pronta antes dele.
                </p>
                <div className="mt-8">
                  <BotaoCadastro busca={busca} contexto="final" invertido />
                  <p className="mt-3 text-[13px] text-[var(--ink)]">
                    A Calculadora está no plano Grátis. Sem cartão.
                  </p>
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
    </div>
  );
}
