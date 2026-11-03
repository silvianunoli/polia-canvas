import { useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Eyebrow } from "@/components/site/Editorial";
import { Reveal } from "@/components/site/Reveal";
import {
  BarraCtaMobile,
  BotaoCadastro,
  CORPO,
  EtiquetaPlano,
  FaqLanding,
  FotoLanding,
  FraseAncora,
  H2,
  PlanosLanding,
  Rotulo,
  Secao,
  type BuscaCadastro,
} from "@/components/landing/BlocosLanding";
import {
  MockCalculadoraHero,
  MockFluxoMarcaPrecoMes,
  MockFraseMes,
  MockQuadroPedidos,
  MockTresNumeros,
  MockVendaEstoque,
  MockVendasMeta,
} from "@/components/landing/MocksLanding";
import { PERGUNTAS_HOME, montarPlanos } from "@/components/landing/PaginaMarcaB";
import { precoBR } from "@/components/landing/preco";
import { PlayerVsl } from "@/components/landing/VideoVsl";
import { depoisDaVirada, tiersPagos } from "@/lib/planos";

/**
 * Home da Pólia One reestruturada em 03/11/2026 (pedido da Sil, COPY-43), na ordem
 * da página do Pode Postar que ela marcou no bench: topo que diz pra quem é e mostra
 * os recursos em etiquetas, a dor com meme, a notícia boa, o mecanismo e tudo que tem
 * no sistema. Bench em Campanhas/polia-conteudo-redes-sociais/refs/
 * bench-podepostar-site-2026-11-03.md, na raiz do workspace.
 *
 * Só a home. A /landing-b e os nichos seguem no PaginaMarcaB, com o teste de
 * campanha rodando.
 */

/* ───────────────────────────── conteúdo ───────────────────────────── */

/** Os módulos que existem hoje, como estão no menu do app. */
const modulos = [
  "Calculadora de preço",
  "Pedidos",
  "Catálogo online",
  "Estoque",
  "Vendas",
  "Financeiro",
  "Metas",
  "Clientes",
];

/** O que uma entrega atualiza sozinha (src/lib/vendas.ts). */
const efeitosDaEntrega = [
  "Entregue",
  "Estoque baixou",
  "Entrou no Financeiro",
  "Meta do mês andou",
];

const canaisHoje = ["WhatsApp", "Instagram", "Catálogo online"];
/** Em breve no Pro (VND-05, VND-17, VND-30). */
const canaisEmBreve = ["TikTok Shop", "Mercado Livre", "Shopee"];

// Raio-x e Projeção descem pro Premium na virada de preços (01/12/2026).
const PLANO_DOS_NUMEROS = depoisDaVirada() ? "Premium" : "Pro";

type Recurso = { titulo: string; texto: string; plano: string; mock: ReactNode };

/** Um bloco por módulo, com a etiqueta do plano que libera (src/lib/planos.ts). */
const recursos: Recurso[] = [
  {
    titulo: "Calculadora de preço",
    texto:
      "O custo do produto, a taxa da maquininha e o lucro que a marca precisa viram o preço. O desconto pode ser testado antes de ser dado.",
    plano: "Grátis",
    mock: <MockCalculadoraHero />,
  },
  {
    titulo: "Pedidos",
    texto:
      "O pedido do WhatsApp, da feira ou do Instagram entra no quadro com a cliente e o dia da entrega, e anda de A fazer até Entregue.",
    plano: "Grátis",
    mock: <MockQuadroPedidos />,
  },
  {
    titulo: "Estoque e Vendas",
    texto:
      "A peça vendida sai da prateleira, o kit baixa cada item e o dinheiro entra no Financeiro já sem a taxa.",
    plano: "Premium",
    mock: <MockVendaEstoque />,
  },
  {
    titulo: "Financeiro",
    texto:
      "O lado B da marca: o que entrou, o que saiu e quanto a marca lucrou no mês, sem misturar com a conta de casa.",
    plano: "Premium",
    mock: <MockTresNumeros />,
  },
  {
    titulo: "Catálogo online",
    texto:
      "A vitrine da marca num link. A cliente escolhe, e o pedido cai direto no quadro de Pedidos.",
    plano: "Pro",
    mock: <MockVitrine />,
  },
  {
    titulo: "Metas, Raio-x e Projeção",
    texto:
      "A meta do mês anda a cada venda. O Raio-x lê o mês, e a Projeção testa o cenário antes da decisão.",
    plano: PLANO_DOS_NUMEROS,
    mock: <MockVendasMeta />,
  },
];

const praVoceQue = [
  "Fecha o preço no chute e passa o resto do dia torcendo.",
  "Anota pedido no caderno, no WhatsApp e na memória.",
  "Mistura o Pix da marca com a conta de casa.",
  "Vende bem e, no fim do mês, não sabe quanto lucrou.",
];

const riscoZero = [
  "Conta nova começa com 7 dias de Pro.",
  "Sem cartão pra entrar.",
  "Cancelar é um clique, e a conta volta pro Grátis com tudo guardado.",
  "No plano pago, 7 dias pra desistir com o valor de volta, sem explicar o motivo.",
];

/* ───────────────────────────── peças ───────────────────────────── */

/** A vitrine do catálogo online: o produto com preço e o pedido que vai pro quadro. */
function MockVitrine() {
  const itens = [
    { nome: "Caderno de aquarela A5", preco: "R$ 49,00" },
    { nome: "Kit 3 cadernos A5", preco: "R$ 147,00" },
    { nome: "Agenda 2027 pintada à mão", preco: "R$ 89,00" },
  ];
  return (
    <div
      role="img"
      aria-label="Catálogo online da marca com três produtos e preços, e o aviso de que o pedido da cliente foi pro quadro de Pedidos."
      className="rounded-xl border border-[var(--line)] bg-white p-6"
    >
      <p className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        Catálogo online · Ateliê da Ana
      </p>
      <ul className="mt-3 flex list-none flex-col">
        {itens.map((i) => (
          <li
            key={i.nome}
            className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--line)] py-2.5 last:border-b-0"
          >
            <span className="min-w-0 truncate text-[13.5px] font-semibold text-[var(--ink)]">
              {i.nome}
            </span>
            <span className="flex-none text-[13px] text-[var(--ink-soft)]">{i.preco}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-md bg-[var(--secondary-light)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
        Pedido novo da Marina foi pro quadro de Pedidos.
      </p>
    </div>
  );
}

/** Etiqueta solta, como as do topo do Pode Postar. */
function Etiqueta({ children, clara = false }: { children: ReactNode; clara?: boolean }) {
  return (
    <li
      className={`rounded-full px-4 py-2 text-[15px] font-semibold leading-[1.3] max-md:text-[14px] ${
        clara
          ? "border border-[var(--line)] bg-white text-[var(--ink)]"
          : "bg-[var(--ink)] text-[var(--bg)]"
      }`}
    >
      {children}
    </li>
  );
}

/** Cartão pequeno que flutua em volta do mock (até o lg, empilha embaixo dele). */
function Flutuante({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[13px] leading-[1.4] text-[var(--ink)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Meme da dor: Ross, de Friends, garantindo que está tudo bem (temporada 10,
 * episódio 2). GIF oficial do perfil de Friends no Giphy, recortado no Ross e sem
 * a legenda em inglês, salvo como webp animado: o Worker não responde vídeo com
 * Range e o iPhone não toca MP4 sem isso (ver VideoVsl.tsx). Com "reduzir
 * movimento", fica a foto parada. O texto é da página, não do arquivo.
 * Imagem de terceiro aceita pela Sil: "caso alguém reclame, eu removo".
 */
function MemeRoss() {
  const contorno =
    "[text-shadow:2px_0_var(--ink),-2px_0_var(--ink),0_2px_var(--ink),0_-2px_var(--ink),2px_2px_var(--ink),-2px_-2px_var(--ink),2px_-2px_var(--ink),-2px_2px_var(--ink)]";
  const texto = `font-cabinet absolute inset-x-0 px-4 text-center text-[clamp(20px,2.6vw,30px)] font-extrabold uppercase leading-[1.1] text-white ${contorno}`;
  return (
    <figure className="relative mx-auto mt-12 aspect-[5/4] w-full max-w-[560px] overflow-hidden rounded-xl bg-[var(--ink)]">
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet="/marketing/landing/meme-ross-tudo-otimo.jpg"
        />
        <img
          src="/marketing/landing/meme-ross-tudo-otimo.webp"
          alt=""
          className="h-full w-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      </picture>
      <figcaption>
        <span className="sr-only">
          Meme com o Ross, da série Friends, abrindo os braços como quem garante que está tudo
          bem.{" "}
        </span>
        <span className={`${texto} top-4`}>Eu no dia 30 olhando o extrato da marca:</span>
        <span className={`${texto} bottom-4`}>Tá tudo ótimo.</span>
      </figcaption>
    </figure>
  );
}

/** O cartão do pedido com o que a entrega atualiza sozinha em volta. */
function MockPedidoEntregue() {
  return (
    <div className="relative mx-auto mt-12 max-w-[760px]">
      <div className="mx-auto max-w-[340px] rounded-xl border border-[var(--line)] bg-white p-6">
        <p className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          Pedido · Júlia Prado
        </p>
        <p className="mt-2 text-[17px] font-semibold text-[var(--ink)]">
          2 cadernos de aquarela A5
        </p>
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]">R$ 98,00 · entrega na sexta</p>
        <p className="mt-4 inline-block rounded-md bg-[var(--secondary-light)] px-3 py-1 text-[13px] font-semibold text-[var(--ink)]">
          Entregue
        </p>
      </div>
      {/* Até o lg as etiquetas empilham embaixo do cartão; do lg pra cima, flutuam. */}
      <ul className="mt-6 flex list-none flex-wrap justify-center gap-3 lg:mt-0">
        {efeitosDaEntrega.slice(1).map((e, i) => (
          <li
            key={e}
            className={`rounded-full border border-[var(--ink)] bg-[var(--bg)] px-4 py-2 text-[14px] font-semibold text-[var(--ink)] lg:absolute ${
              [
                "lg:left-0 lg:top-6",
                "lg:right-0 lg:top-1/2 lg:-translate-y-1/2",
                "lg:bottom-6 lg:left-8",
              ][i]
            }`}
          >
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────── página ───────────────────────────── */

/**
 * Do `<main>` ao rodapé. Os ids como-funciona, produto, planos e perguntas são as
 * âncoras do menu do SiteHeader; scroll-mt desconta o header fixo.
 */
export function PaginaHome({ busca }: { busca: BuscaCadastro }) {
  const heroCta = useRef<HTMLAnchorElement>(null);
  const zonaPlanos = useRef<HTMLElement>(null);
  const zonaFinal = useRef<HTMLDivElement>(null);
  const zonaRodape = useRef<HTMLDivElement>(null);
  const planos = montarPlanos();
  const { controle: premium, projete: pro } = tiersPagos();

  return (
    <>
      <main id="conteudo">
        {/* 1 · TOPO: pra quem é e os módulos em etiquetas, como o do Pode Postar, com o
            botão que falta lá. Centralizado, como o topo de antes (pedido da Sil). */}
        <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
          <div className="flex justify-center text-center">
            <Rotulo>Pólia One</Rotulo>
          </div>
          <ul className="mx-auto mt-6 flex max-w-[760px] list-none flex-wrap justify-center gap-3">
            {modulos.map((m) => (
              <Etiqueta key={m}>{m}</Etiqueta>
            ))}
          </ul>
          <h1 className="mx-auto mt-8 max-w-[22ch] text-center text-[clamp(32px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance">
            O sistema da sua marca.
          </h1>
          <p className={`mx-auto mt-6 text-center ${CORPO} !text-[18px]`}>
            A Pólia One ajuda quem toca a própria marca, de doce a peça feita à mão, a{" "}
            <b className="font-semibold text-[var(--ink)]">
              cobrar o preço certo, organizar os pedidos e saber quanto a marca lucra no mês.
            </b>
          </p>
          <div className="mt-8 flex flex-col items-center text-center">
            <BotaoCadastro busca={busca} contexto="hero" botaoRef={heroCta} />
            <p className="mt-3 text-[13px] text-[var(--muted)]">
              Sem cartão. Conta nova começa com 7 dias de Pro.
            </p>
          </div>
          <div className="relative mx-auto mt-12 max-w-[520px]">
            <MockQuadroPedidos />
            <Flutuante className="mt-4 lg:absolute lg:-left-48 lg:bottom-8 lg:mt-0 lg:w-[220px]">
              <span className="text-[var(--muted)]">Cliente</span>
              <br />
              <b className="font-semibold">Júlia · 2 cadernos pra sexta</b>
            </Flutuante>
            <Flutuante className="mt-3 lg:absolute lg:-right-48 lg:top-8 lg:mt-0 lg:w-[220px]">
              <span className="text-[var(--muted)]">Preço calculado</span>
              <br />
              <b className="font-semibold">R$ 49,00 · lucra R$ 19,60</b>
            </Flutuante>
          </div>
          <p className="mt-4 text-center text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* 2 · A DOR, com o meme no meio. */}
        <Secao fundo="surface">
          <div className="flex justify-center text-center">
            <Rotulo>Vamos combinar</Rotulo>
          </div>
          <h2 className={`mx-auto mt-4 max-w-[22ch] text-center ${H2}`}>
            Tocar uma marca nunca foi só fazer o produto.
          </h2>
          <Reveal>
            <MemeRoss />
          </Reveal>
          <p className={`mx-auto mt-12 text-center ${CORPO}`}>
            É <b className="font-semibold text-[var(--ink)]">pedido no WhatsApp, preço no chute</b>,
            conta no caderno e Pix misturado com a conta de casa.
          </p>
          <p className={`mx-auto mt-4 text-center ${CORPO}`}>
            Enquanto isso, a cliente pergunta se tem pra sexta, a embalagem acabou e{" "}
            <b className="font-semibold text-[var(--ink)]">
              ninguém sabe dizer quanto a marca lucrou no mês.
            </b>
          </p>
        </Secao>

        {/* 3 · A NOTÍCIA BOA: faixa tinta com a virada, e o produto logo embaixo. */}
        <section className="bg-[var(--ink)] py-[clamp(48px,6vw,64px)] text-center">
          <div className="flex justify-center">
            <Eyebrow claro>A notícia boa é que</Eyebrow>
          </div>
          <h2 className="mx-auto mt-4 max-w-[22ch] px-6 text-[clamp(28px,3.2vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance text-[var(--bg)]">
            Agora a sua marca tem um sistema.
          </h2>
        </section>
        <Secao className="!pt-[clamp(48px,6vw,64px)]">
          <div className="relative mx-auto max-w-[560px]">
            <MockFraseMes />
            <Flutuante className="mt-4 lg:absolute lg:-left-56 lg:top-6 lg:mt-0 lg:w-[240px]">
              <span className="text-[var(--muted)]">Pedido · Bia</span>
              <br />
              <b className="font-semibold">A fazer → Entregue</b>
            </Flutuante>
            <Flutuante className="mt-3 lg:absolute lg:-right-56 lg:bottom-6 lg:mt-0 lg:w-[240px]">
              <span className="text-[var(--muted)]">Mensagem da cliente</span>
              <br />
              <b className="font-semibold">“Amei, quero mais duas pra sábado.”</b>
            </Flutuante>
          </div>
          <p className="mt-4 text-center text-[13px] text-[var(--muted)]">Números de exemplo.</p>
          <div className="mt-12 grid grid-cols-1 items-start gap-8 md:grid-cols-2">
            <p className="text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.25] tracking-[-0.02em] text-balance text-[var(--ink)]">
              A Pólia One junta num lugar só o que estava espalhado no caderno, na planilha perdida
              e no WhatsApp.
            </p>
            <div>
              <ul className="flex list-none flex-col gap-3">
                {[
                  "Funciona no celular.",
                  "Feita pra quem não é do financeiro.",
                  "Começa no Grátis.",
                ].map((l) => (
                  <li key={l} className="flex items-start gap-3 text-[17px] text-[var(--ink)]">
                    <Check
                      aria-hidden="true"
                      className="mt-1 h-5 w-5 flex-none text-[var(--secondary-text)]"
                      strokeWidth={2}
                    />
                    {l}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <BotaoCadastro busca={busca} contexto="noticia-boa" />
              </div>
            </div>
          </div>
        </Secao>

        {/* 4 · O MECANISMO: uma entrega e o que ela atualiza sozinha. */}
        <Secao fundo="surface" id="produto" className="scroll-mt-[88px]">
          <h2 className={`mx-auto max-w-[24ch] text-center ${H2}`}>
            Entregou o pedido, o resto da conta se atualiza sozinho.
          </h2>
          <MockPedidoEntregue />
          <p className={`mx-auto mt-12 text-center ${CORPO}`}>
            O que antes era anotar em quatro lugares,{" "}
            <b className="font-semibold text-[var(--ink)]">agora acontece de uma vez.</b>
          </p>
          <ul className="mx-auto mt-8 flex max-w-[760px] list-none flex-wrap justify-center gap-3">
            {canaisHoje.map((c) => (
              <Etiqueta key={c} clara>
                {c}
              </Etiqueta>
            ))}
            {canaisEmBreve.map((c) => (
              <Etiqueta key={c} clara>
                {c} · em breve
              </Etiqueta>
            ))}
          </ul>
          <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[var(--muted)]">
            Os marketplaces entram no <EtiquetaPlano nome="Pro" />
          </p>
        </Secao>

        {/* 5 · TUDO QUE TEM: um bloco por módulo, e o VSL no fim ("por dentro"). */}
        <Secao id="como-funciona" className="scroll-mt-[88px]">
          <div className="flex justify-center text-center">
            <Rotulo>Tudo o que tem na Pólia One</Rotulo>
          </div>
          <h2 className={`mx-auto mt-4 max-w-[24ch] text-center ${H2}`}>
            Do primeiro preço ao mês que fecha.
          </h2>
          <div className="mt-12 flex flex-col">
            {recursos.map((r, i) => (
              <Reveal key={r.titulo}>
                <div className="grid grid-cols-1 items-center gap-8 border-t border-[var(--line)] py-12 md:grid-cols-2 md:gap-16">
                  <div className={i % 2 === 1 ? "md:order-2" : ""}>
                    <h3 className="flex flex-wrap items-center gap-3 text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)]">
                      {r.titulo}
                      <EtiquetaPlano nome={r.plano} />
                    </h3>
                    <p className={`mt-4 ${CORPO}`}>{r.texto}</p>
                  </div>
                  <div>{r.mock}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-[13px] text-[var(--muted)]">Números de exemplo.</p>

          <div className="mt-16 border-t border-[var(--line)] pt-12">
            <div className="flex justify-center text-center">
              <Rotulo>Por dentro</Rotulo>
            </div>
            <h3 className="mx-auto mt-4 max-w-[26ch] text-center text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.02em] text-balance text-[var(--ink)]">
              Vem ver a Pólia One funcionando.
            </h3>
            <PlayerVsl busca={busca} className="mx-auto mt-8 max-w-[960px]" />
            <div className="mt-8 flex flex-col items-center text-center">
              <BotaoCadastro busca={busca} contexto="por-dentro" />
              <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
            </div>
          </div>
        </Secao>

        {/* 6 · A MARCA ABRE, O NÚMERO PROVA: o eixo marca primeiro, mais curto. */}
        <Secao fundo="secondary-light">
          <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-2">
            <div>
              <Rotulo>A marca abre. O número prova.</Rotulo>
              <h2 className={`mt-4 ${H2}`}>
                Quando a cliente diz que tá caro, quase nunca é sobre o preço.
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              <p className={CORPO}>
                <b className="font-semibold text-[var(--ink)]">A marca dá o argumento.</b> As horas
                da peça, o material escolhido e a embalagem entram no custo de cada produto.
              </p>
              <p className={CORPO}>
                <b className="font-semibold text-[var(--ink)]">O número dá a prova.</b> Todo preço
                calculado na Pólia One é comparado com a meta do mês.
              </p>
            </div>
          </div>
          <MockFluxoMarcaPrecoMes className="mt-12" />
          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">Números de exemplo.</p>
          <FraseAncora className="mt-10">
            A marca dá coragem pro preço. O número prova que a coragem tinha razão.
          </FraseAncora>
        </Secao>

        {/* 7 · É PRA VOCÊ QUE: quatro cenas que a dona reconhece. */}
        <Secao>
          <h2 className={`text-center ${H2}`}>A Pólia One é pra você que:</h2>
          <ul className="mt-12 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {praVoceQue.map((c) => (
              <li
                key={c}
                className="rounded-xl border border-[var(--line)] bg-white p-6 text-[17px] leading-[1.5] text-[var(--ink)]"
              >
                {c}
              </li>
            ))}
          </ul>
        </Secao>

        {/* 8 · QUEM FEZ: a prova enquanto não tem depoimento. */}
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
                A Pólia One é o sistema que eu queria ter tido quando a minha marca cresceu. Eu
                construo a Pólia usando a Pólia.
              </p>
              <Link
                to="/sobre"
                className="mt-6 inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Ler a história inteira
              </Link>
            </div>
          </div>
        </Secao>

        {/* 9 · RISCO ZERO: era uma linha de 13 px embaixo do botão. */}
        <section className="bg-[var(--ink)] py-[clamp(64px,8vw,96px)]">
          <div className="mx-auto w-full max-w-[720px] px-[clamp(20px,4vw,48px)] text-center">
            <h2 className="text-[clamp(28px,3.2vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance text-[var(--bg)]">
              Começa no Grátis. Sem cartão.
            </h2>
            <ul className="mx-auto mt-8 flex max-w-[520px] list-none flex-col gap-3 text-left">
              {riscoZero.map((l) => (
                <li
                  key={l}
                  className="flex items-start gap-3 text-[17px] leading-[1.5] text-[var(--bg)]"
                >
                  <Check
                    aria-hidden="true"
                    className="mt-1 h-5 w-5 flex-none text-[var(--secondary)]"
                    strokeWidth={2}
                  />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 · PLANOS */}
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
        </Secao>

        {/* 11 · FAQ */}
        <Secao id="perguntas" className="scroll-mt-[88px]">
          <h2 className={`mb-8 ${H2}`}>Perguntas frequentes</h2>
          <FaqLanding perguntas={PERGUNTAS_HOME} />
        </Secao>

        <div ref={zonaFinal}>
          {/* 12 · CTA FINAL */}
          <Secao fundo="secondary">
            <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[7fr_4fr]">
              <div>
                <h2 className="text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)]">
                  Por fora, a marca que a cliente lembra. Por dentro, o sistema que fecha a conta.
                </h2>
                <p className="mt-5 text-[18px] leading-[1.6] text-[var(--ink)]">
                  A marca já cresceu. Agora o sistema acompanha. Começa no Grátis, com 7 dias de
                  Pro.
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
