import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Camera, MousePointerClick, RotateCcw, Tag, Wallet } from "lucide-react";
import { TIERS_PAGOS } from "@/lib/planos";
import { SiteFooter } from "@/components/site/SiteFooter";
import {
  BarraCtaMobile,
  BotaoPremium,
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
  NumeroProva,
  PlanosLanding,
  Rotulo,
  Secao,
  type BuscaCadastro,
  type ItemLista,
  type PlanoLanding,
} from "@/components/landing/BlocosLanding";
import {
  MockCustosProduto,
  MockPedidos,
  MockPerguntaMarca,
  MockPlannerSemana,
  MockTresNumeros,
} from "@/components/landing/MocksLanding";
import { PlayerVsl } from "@/components/landing/VideoVsl";
import { precoBR } from "@/components/landing/preco";

/**
 * Landings que vendem o Premium (15/10/2026), pra uma campanha própria no Meta,
 * otimizada pra compra. As landings de cadastro (/landing-a, /landing-b) seguem
 * como estão na campanha de cadastro, que traz conta Grátis barata.
 *
 * Uma página, dois ângulos de topo: "a" (o próximo orçamento) e "b" (a marca vale
 * mais). Daqui pra baixo é igual. Estrutura e copy aprovadas pela Sil no
 * wireframe WIREFRAME-LANDINGS-PREMIUM.html (raiz do workspace).
 *
 * O botão principal vai direto pro pagamento do Premium em /planos (só e-mail e
 * cartão; a conta nasce depois). O Grátis fica como link, nunca com o mesmo peso.
 */

const premium = TIERS_PAGOS.controle;
const pro = TIERS_PAGOS.projete;
const PRECO_PREMIUM = precoBR(premium.precoMensal);

const TOPO = {
  a: {
    rotulo: "Pólia One Premium · pra hora do orçamento",
    titulo: "O orçamento chegou. A Pólia One faz a conta antes de você responder.",
  },
  b: {
    rotulo: "Pólia One Premium · pra quem toca a própria marca",
    titulo: "Sua marca já vale mais do que você está cobrando.",
  },
} as const;

const dores: ItemLista[] = [
  {
    icone: Tag,
    titulo: "O preço sai no susto.",
    texto:
      "O orçamento chega no WhatsApp, o valor muda três vezes antes de ir, e o desconto sai do que ia sobrar.",
  },
  {
    icone: Camera,
    titulo: "O pedido mora num print.",
    texto: "A encomenda da cliente fica perdida entre a conversa de ontem e a de hoje.",
  },
  {
    icone: Wallet,
    titulo: "O mês acaba sem resposta.",
    texto:
      "O dinheiro entrou, saiu, se misturou com a conta de casa, e ninguém sabe quanto foi lucro.",
  },
];

const semRisco: ItemLista[] = [
  {
    icone: RotateCcw,
    titulo: "7 dias pra desistir.",
    texto:
      "Nos primeiros 7 dias depois de assinar, dá pra desistir sem explicar o motivo, e o valor volta inteiro.",
  },
  {
    icone: MousePointerClick,
    titulo: "Cancelar é um clique.",
    texto: "Fica em Configurações, sem ligação e sem precisar falar com ninguém.",
  },
  {
    icone: Archive,
    titulo: "Nada se perde.",
    texto: "Cancelou, a conta volta pro Grátis e o que foi escrito continua lá.",
  },
];

const planos: PlanoLanding[] = [
  {
    nome: "Grátis",
    praQuem: "Pra pôr a marca no papel e fazer os primeiros preços.",
    mensal: "R$ 0",
    itens: [
      "Calculadora de preço, pra produto e serviço, com simulação de desconto",
      "Até 5 produtos e 3 metas",
      "Os 6 módulos do Planejamento (os documentos de Marca e Mercado são do Premium)",
    ],
  },
  {
    nome: "Premium",
    etiqueta: "Pra quem já vende",
    praQuem: "Pra quem tem pedido toda semana e quer ver o lucro do mês.",
    mensal: precoBR(premium.precoMensal),
    anual: precoBR(premium.precoAnual),
    itemForte: 2,
    itens: [
      "Documentos de Marca e Mercado, escritos a partir do Planejamento",
      "Catálogo sem limite, cada produto com custo, preço e quanto sobra",
      "Financeiro com os três números que decidem o mês",
      "Clientes com o status de cada pedido, da espera à entrega",
      "Planner sem limite, e o Calendário com a agenda do Google junto",
    ],
  },
  {
    nome: "Pro",
    praQuem: "Pra quem quer saber quantas vendas faltam pra marca pagar a dona.",
    mensal: precoBR(pro.precoMensal),
    anual: precoBR(pro.precoAnual),
    itens: [
      "Tudo do Premium",
      "Projeção: quantas vendas faltam pra empatar, pra se pagar e pra bater a meta",
      "Raio-x do mês e resumo pro contador, em PDF e CSV",
      "Calculadora de encomenda sob medida e plano de conteúdo do ano",
    ],
  },
];

const perguntas = [
  {
    pergunta: "Por que não começar pelo Grátis?",
    resposta:
      "Dá pra começar. O Grátis faz o preço de até 5 produtos. O Premium é pra quem já vende e quer o mês inteiro na mesma conta: pedidos, dinheiro do mês e catálogo sem limite.",
  },
  {
    pergunta: "Pago e depois crio a conta?",
    resposta:
      "Isso. Depois do pagamento chega um e-mail com o link pra criar a senha e entrar na Pólia One.",
  },
  {
    // Termos, seção 8 (06/10/2026): só na contratação, não na renovação.
    pergunta: "E se eu assinar e me arrepender?",
    resposta:
      "Nos primeiros 7 dias depois de assinar, dá pra desistir sem explicar o motivo, e o valor volta inteiro. Vale pro mensal e pro anual. O pedido é feito pelo e-mail privacidade@usepolia.com.br, a partir do e-mail da conta.",
  },
  {
    pergunta: "Conecta com banco, marketplace ou Instagram?",
    resposta:
      "Ainda não. As vendas entram à mão, uma linha por venda. No Premium, a agenda do Google aparece junto das tarefas.",
  },
  {
    pergunta: "A IA inventa o meu preço?",
    resposta:
      "Não. O preço vem de conta: custo, taxas e quanto precisa sobrar. A IA só ajuda a completar textos do Planejamento e responde dúvidas do dia a dia.",
  },
  {
    pergunta: "É pra mim?",
    resposta:
      "É pra quem vende produto ou serviço, sozinha ou com alguém ajudando, e passa orçamento toda semana. Não é pra quem procura fórmula pra enriquecer rápido.",
  },
];

export function PaginaPremium({ busca, angulo }: { busca: BuscaCadastro; angulo: "a" | "b" }) {
  const heroCta = useRef<HTMLAnchorElement>(null);
  const zonaPlanos = useRef<HTMLElement>(null);
  const zonaFinal = useRef<HTMLDivElement>(null);
  const zonaRodape = useRef<HTMLDivElement>(null);
  const topo = TOPO[angulo];

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <HeaderCampanha busca={busca} premium />

      <main id="conteudo">
        {/* P1 · TOPO: no celular, título, vídeo e botão; no desktop, vídeo à direita. */}
        <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
          <div className="grid grid-cols-1 items-center gap-x-[clamp(32px,5vw,64px)] gap-y-8 md:grid-cols-[5fr_6fr]">
            <div className="md:col-start-1 md:row-start-1 md:self-end">
              <Rotulo>{topo.rotulo}</Rotulo>
              {/* h1 e botão fora do Reveal: chegam visíveis no HTML do servidor. */}
              <h1 className="mt-4 text-[clamp(26px,3vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance max-md:text-[28px]">
                {topo.titulo}
              </h1>
              <p className={`mt-6 ${CORPO}`}>
                No Premium, a Pólia One junta a marca, o preço, os pedidos e o dinheiro do mês.{" "}
                <b className="font-semibold text-[var(--ink)]">O preço sai da conta</b>, e o mês
                mostra se fechou.
              </p>
            </div>
            <PlayerVsl
              busca={busca}
              versao="premium"
              className="md:col-start-2 md:row-span-2 md:row-start-1"
            />
            <div className="md:col-start-1 md:row-start-2 md:self-start">
              <BotaoPremium busca={busca} contexto="hero" botaoRef={heroCta}>
                Quero o Premium · {PRECO_PREMIUM} por mês
              </BotaoPremium>
              <div className="mt-2">
                <LinkCadastro busca={busca} contexto="hero_gratis">
                  ou começar no Grátis, sem cartão
                </LinkCadastro>
              </div>
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                7 dias pra desistir com o valor de volta. Cancelar é um clique.
              </p>
            </div>
          </div>
        </Secao>

        {/* P2 · PROVA */}
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

        {/* P3 · A CENA E O JEITO DE HOJE */}
        <Secao>
          <Rotulo>A cena</Rotulo>
          <h2 className={`mt-4 max-w-[26ch] ${H2}`}>
            O app de tarefas organiza a lista. Não mostra seu lucro.
          </h2>
          <div className="mt-10 max-w-[820px]">
            <ListaEditorial itens={dores} />
          </div>
          <FraseAncora className="mt-8">
            Travar no orçamento não é falta de coragem. É falta do número.
          </FraseAncora>
        </Secao>

        {/* P4 · O QUE O PREMIUM FAZ */}
        <Secao fundo="surface">
          <Rotulo>No Premium</Rotulo>
          <h2 className={`mt-4 mb-10 ${H2}`}>O que o Premium faz pelo seu mês.</h2>
          <ComoFuncionaPassos
            passos={[
              {
                titulo: "A marca escrita",
                texto:
                  "Os documentos de Marca e Mercado saem do Planejamento e viram a resposta pro “tá caro”, com as suas palavras.",
                nota: "No lugar da resposta inventada na hora",
                mock: <MockPerguntaMarca />,
              },
              {
                titulo: "Cada produto com quanto sobra",
                texto:
                  "Catálogo sem limite, com custo, preço e o que fica em cada venda depois das taxas.",
                nota: "No lugar da planilha perdida",
                mock: <MockCustosProduto />,
              },
              {
                titulo: "O mês em três números",
                texto:
                  "O mínimo pra fechar as contas, o mês bom e o mês de celebrar. O Financeiro mostra em qual deles o mês está.",
                nota: "No lugar do caderno de contas",
                mock: <MockTresNumeros />,
              },
              {
                titulo: "Cada pedido com status",
                texto: "Da espera à entrega. Entregou, vira venda no Financeiro com um clique.",
                nota: "No lugar do print no WhatsApp",
                mock: <MockPedidos />,
              },
              {
                titulo: "A semana no mesmo lugar",
                texto: "Planner sem limite, com a agenda do Google junto das tarefas do ateliê.",
                nota: "No lugar do app de tarefas e do planner bonito",
                mock: <MockPlannerSemana />,
              },
            ]}
          />
          <p className="mt-6 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
          <p className={`mt-10 ${CORPO}`}>
            <b className="font-semibold text-[var(--ink)]">Tudo isso por {PRECO_PREMIUM} por mês</b>
            , ou {precoBR(premium.precoAnual)} no ano, que sai por 10 mensalidades.
          </p>
          <div className="mt-6">
            <BotaoPremium busca={busca} contexto="oferta" />
          </div>
        </Secao>

        {/* P5 · A CONTA DA ASSINATURA */}
        <Secao>
          <Rotulo>A conta da assinatura</Rotulo>
          <h2 className={`mt-4 max-w-[28ch] ${H2}`}>
            Um desconto dado no chute custa mais que um mês de Premium.
          </h2>
          <div className="mt-10 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-white p-6">
              <p className="text-[15px] leading-[1.5] text-[var(--ink-soft)]">
                3 pedidos de R$ 100 com 10% de desconto dado no susto
              </p>
              <p className="mt-3 font-cabinet text-[40px] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
                − R$ 30,00
              </p>
            </div>
            <div className="rounded-xl border-2 border-[var(--secondary)] bg-white p-6">
              <p className="text-[15px] leading-[1.5] text-[var(--ink-soft)]">Premium, por mês</p>
              <p className="mt-3 font-cabinet text-[40px] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
                {PRECO_PREMIUM}
              </p>
            </div>
          </div>
          <p className={`mt-8 ${CORPO}`}>
            A Pólia One mostra, antes do desconto sair, quanto ele tira do que sobra em cada venda.
          </p>
          <p className="mt-4 text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* P6 · PLANOS */}
        <Secao id="planos" fundo="surface" secaoRef={zonaPlanos}>
          <Rotulo>Planos</Rotulo>
          <h2 className={`mt-4 mb-8 ${H2}`}>
            Começa pelo Premium. Sobe pro Pro quando o mês pedir.
          </h2>
          <PlanosLanding planos={planos} busca={busca} foco="premium" />
          <p className={`mt-8 ${CORPO}`}>
            No anual, o ano custa 10 mensalidades: Premium {precoBR(premium.precoAnual)}, Pro{" "}
            {precoBR(pro.precoAnual)}.
          </p>
        </Secao>

        {/* P7 · SEM RISCO */}
        <Secao>
          <Rotulo>Sem risco</Rotulo>
          <h2 className={`mt-4 mb-6 ${H2}`}>Assinar não prende ninguém.</h2>
          <div className="max-w-[820px]">
            <ListaEditorial itens={semRisco} />
          </div>
        </Secao>

        {/* P8 · QUEM FEZ */}
        <Secao fundo="surface">
          <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[4fr_7fr]">
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
                meu próprio negócio. A Pólia One é a ferramenta que eu queria ter aberto toda vez
                que um orçamento chegava.
              </p>
            </div>
          </div>
        </Secao>

        {/* P9 · PERGUNTAS */}
        <Secao>
          <h2 className={`mb-8 ${H2}`}>Perguntas frequentes</h2>
          <FaqLanding perguntas={perguntas} />
        </Secao>

        <div ref={zonaFinal}>
          {/* P10 · FECHO */}
          <Secao fundo="secondary">
            <h2 className="max-w-[24ch] text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)]">
              O próximo orçamento vai chegar de qualquer jeito.
            </h2>
            <p className="mt-5 text-[18px] leading-[1.6] text-[var(--ink)]">
              A Pólia One deixa a conta pronta antes dele.
            </p>
            <div className="mt-8">
              <BotaoPremium busca={busca} contexto="final" invertido>
                Quero o Premium · {PRECO_PREMIUM} por mês
              </BotaoPremium>
              <div className="mt-2">
                {/* Link em tinta: o turquesa do texto de link some sobre o fundo turquesa. */}
                <Link
                  to="/auth/cadastro"
                  search={busca}
                  data-track="cadastro_cta_clicado"
                  data-track-props={JSON.stringify({
                    contexto: "final_gratis",
                    landing: busca.origem ?? null,
                  })}
                  className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--ink)] underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  ou começar no Grátis, sem cartão
                </Link>
              </div>
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
        premium
      />
    </div>
  );
}
