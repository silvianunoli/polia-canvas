import { useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Eyebrow } from "@/components/site/Editorial";
import { Reveal } from "@/components/site/Reveal";
import {
  BarraCtaMobile,
  BotaoCadastro,
  CORPO,
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
  MockFraseMes,
  MockQuadroPedidos,
  MockTresNumeros,
  MockVendaEstoque,
  MockVendasMeta,
} from "@/components/landing/MocksLanding";
import { PERGUNTAS_HOME, montarPlanos } from "@/components/landing/PaginaMarcaB";
import { precoBR } from "@/components/landing/preco";
import { PlayerVsl } from "@/components/landing/VideoVsl";
import { tiersPagos } from "@/lib/planos";

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
  "Vitrine online",
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

const canaisHoje = ["WhatsApp", "Instagram", "Vitrine online", "Pedido feito pessoalmente"];
/** Em breve no Pro (VND-05, VND-17, VND-30). */
const canaisEmBreve = ["TikTok Shop", "Mercado Livre", "Shopee"];

type Recurso = { titulo: string; texto: string; gratis?: boolean; mock: ReactNode };

/**
 * Um bloco por módulo. Quem chega pela primeira vez não conhece os planos, então o
 * bloco só diz quando o módulo já vem no grátis (src/lib/planos.ts).
 */
const recursos: Recurso[] = [
  {
    titulo: "Pedidos",
    texto:
      "Cada pedido num cartão, com o nome da cliente e o dia da entrega. Do WhatsApp, do Instagram ou feito pessoalmente. Nada de rolar conversa às 23h.",
    gratis: true,
    mock: <MockQuadroPedidos />,
  },
  {
    titulo: "Vitrine online",
    texto:
      "A vitrine da marca num link, pronto pra bio do Instagram. A cliente escolhe, e o pedido chega no WhatsApp da cliente.",
    mock: <MockVitrine />,
  },
  {
    titulo: "Estoque e Vendas",
    texto:
      "Vendeu, baixou. A peça sai da prateleira sozinha, e a Pólia One avisa o que está acabando antes de faltar.",
    mock: <MockVendaEstoque />,
  },
  {
    titulo: "Financeiro",
    texto:
      "O lado B da marca. O que entrou, o que saiu e quanto a marca lucrou de verdade, separado da conta de casa.",
    mock: <MockTresNumeros />,
  },
  {
    titulo: "Calculadora de preço",
    texto:
      "Chega de mudar o valor três vezes antes de mandar. O custo, a taxa da maquininha e o lucro que a marca precisa viram o preço, e o desconto pode ser testado antes de ser dado.",
    gratis: true,
    mock: <MockCalculadoraHero />,
  },
  {
    titulo: "Metas, Raio-x e Projeção",
    texto:
      "Você diz quanto quer ganhar no mês, e a Pólia One mostra quanto falta a cada venda. Antes de uma decisão grande, dá pra testar o cenário.",
    mock: <MockVendasMeta />,
  },
];

/** As três cenas da seção da dor (texto da Sil, 04/11/2026). */
const cenasDaDor = [
  {
    titulo: "O desespero das 23h",
    texto:
      "A cliente quer saber se dá pra entregar na sexta, e você perde um tempão caçando o pedido dela no meio de mil mensagens.",
  },
  {
    titulo: "Preço no susto",
    texto:
      "Você passa o valor da encomenda na pressa, na ansiedade de responder logo, e o seu lucro vai embora.",
  },
  {
    titulo: "Dinheiro misturado",
    texto: "O Pix da venda cai na sua conta pessoal e vira pão, leite e boleto de casa.",
  },
];

/** O que a dona usa hoje, espalhado, e a Pólia One junta (sem número de economia sem fonte). */
const ferramentasEspalhadas = [
  "Caderno de pedidos",
  "Planilha",
  "Bloco de notas do celular",
  "App de estoque",
  "App de catálogo",
  "Controle financeiro em outro app",
];

const praVoceQue = [
  "Já respondeu “deixa eu ver aqui e te falo” quando a cliente perguntou o preço.",
  "Tem pedido anotado no caderno, no WhatsApp e no bloco de notas do celular.",
  "Já pagou o mercado com o Pix da marca, e depois não soube quanto era de quem.",
  "Vende bem, trabalha muito e no fim do mês se pergunta pra onde foi o dinheiro.",
];

const riscoZero = [
  "Começa grátis, sem cartão.",
  "Nos 7 primeiros dias, todas as funções vêm liberadas pra você testar.",
  "Cancelou? Você volta pro plano grátis, e nada do que anotou se perde.",
  "Assinou e se arrependeu? Em 7 dias o dinheiro volta inteiro, sem explicar nada.",
];

/* ───────────────────────────── peças ───────────────────────────── */

/** A vitrine online: o produto com preço e o pedido que vai pelo WhatsApp. */
function MockVitrine() {
  const itens = [
    { nome: "Caderno de aquarela A5", preco: "R$ 49,00" },
    { nome: "Kit 3 cadernos A5", preco: "R$ 147,00" },
    { nome: "Agenda 2027 pintada à mão", preco: "R$ 89,00" },
  ];
  return (
    <div
      role="img"
      aria-label="Vitrine online da marca com três produtos e preços, e o aviso de que o pedido da cliente foi enviado pelo WhatsApp."
      className="rounded-xl border border-[var(--line)] bg-white p-6"
    >
      <p className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        Vitrine online · Ateliê da Ana
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
        Pedido da Marina enviado pelo WhatsApp.
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
            <Rotulo>Pólia One · o sistema da sua marca</Rotulo>
          </div>
          <ul className="mx-auto mt-6 flex max-w-[760px] list-none flex-wrap justify-center gap-3">
            {modulos.map((m) => (
              <Etiqueta key={m}>{m}</Etiqueta>
            ))}
          </ul>
          <h1 className="mx-auto mt-8 max-w-[22ch] text-center text-[clamp(32px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance">
            A gestão do seu negócio não precisa mais morar no caderno.
          </h1>
          <p className={`mx-auto mt-6 text-center ${CORPO} !text-[18px]`}>
            Pra quem faz quase tudo sozinha: o pedido, a entrega, o estoque e o Pix. A Pólia One
            junta a gestão inteira da marca num lugar só,{" "}
            <b className="font-semibold text-[var(--ink)]">e cabe no celular.</b>
          </p>
          <div className="mt-8 flex flex-col items-center text-center">
            <BotaoCadastro busca={busca} contexto="hero" botaoRef={heroCta}>
              Quero organizar a minha marca
            </BotaoCadastro>
            <p className="mt-3 text-[13px] text-[var(--muted)]">
              Grátis pra começar, sem cartão. E os 7 primeiros dias com tudo liberado.
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
              <span className="text-[var(--muted)]">Vitrine online</span>
              <br />
              <b className="font-semibold">Pedido novo da Marina</b>
            </Flutuante>
          </div>
          <p className="mt-4 text-center text-[13px] text-[var(--muted)]">Números de exemplo.</p>
        </Secao>

        {/* 2 · A DOR: as três cenas, o meme do dia 30 e a virada (texto da Sil, 04/11/2026). */}
        <Secao fundo="surface">
          <h2 className={`mx-auto max-w-[26ch] text-center ${H2}`}>
            Me diz uma coisa: a sua rotina de vendas hoje tá parecida com isso?
          </h2>
          <ul className="mt-12 grid list-none grid-cols-1 gap-4 md:grid-cols-3">
            {cenasDaDor.map((c) => (
              <li
                key={c.titulo}
                className="rounded-xl border border-[var(--line)] bg-white p-6 text-[17px] leading-[1.55] text-[var(--ink-soft)]"
              >
                <b className="block text-[18px] font-semibold text-[var(--ink)]">{c.titulo}</b>
                <span className="mt-2 block">{c.texto}</span>
              </li>
            ))}
          </ul>
          <Reveal>
            <MemeRoss />
          </Reveal>
          <p className={`mx-auto mt-12 text-center ${CORPO}`}>
            Chega o dia 30 e você olha pro teto com aquela frustração que ninguém merece passar:{" "}
            <b className="font-semibold text-[var(--ink)]">“Vendi bem, mas cadê o dinheiro?”</b>
          </p>
          <p className="mx-auto mt-6 max-w-[34ch] text-center text-[clamp(20px,2vw,24px)] font-bold leading-[1.3] tracking-[-0.02em] text-balance text-[var(--ink)]">
            Chega de trabalhar só pra apagar incêndio. Tá na hora de ver o seu negócio dar lucro de
            verdade.
          </p>
        </Secao>

        {/* 3 · A NOTÍCIA BOA: faixa tinta com a virada, e o produto logo embaixo. */}
        <section className="bg-[var(--ink)] py-[clamp(48px,6vw,64px)] text-center">
          <div className="flex justify-center">
            <Eyebrow claro>A notícia boa é que</Eyebrow>
          </div>
          <h2 className="mx-auto mt-4 max-w-[22ch] px-6 text-[clamp(28px,3.2vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance text-[var(--bg)]">
            Dá pra ter tudo isso num lugar só. E sem virar especialista em planilha.
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
              A Pólia One é o sistema da sua marca: o pedido no quadro, a vitrine no link da bio, o
              estoque que baixa sozinho, o financeiro longe da conta de casa e o preço calculado com
              o custo de verdade.
            </p>
            <div>
              <ul className="flex list-none flex-col gap-3">
                {[
                  "Funciona no celular, no intervalo entre um pedido e outro.",
                  "Feita pra quem não entende de números.",
                  "Você pode testar gratuitamente.",
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
                <BotaoCadastro busca={busca} contexto="noticia-boa">
                  Quero organizar a minha marca
                </BotaoCadastro>
              </div>
            </div>
          </div>
        </Secao>

        {/* 4 · O MECANISMO: uma entrega e o que ela atualiza sozinha. */}
        <Secao fundo="surface" id="produto" className="scroll-mt-[88px]">
          <h2 className={`mx-auto max-w-[24ch] text-center ${H2}`}>
            Entregou o pedido? Pronto. O resto se atualiza sozinho.
          </h2>
          <MockPedidoEntregue />
          <p className={`mx-auto mt-12 text-center ${CORPO}`}>
            Antes, uma venda virava quatro anotações: no caderno, na planilha, no estoque e na
            cabeça.{" "}
            <b className="font-semibold text-[var(--ink)]">
              Agora ela entra uma vez, e a Pólia One leva pra cada lugar.
            </b>
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
        </Secao>

        {/* 5 · TUDO QUE TEM: um bloco por módulo, e o VSL no fim ("por dentro"). */}
        <Secao id="como-funciona" className="scroll-mt-[88px]">
          <div className="flex justify-center text-center">
            <Rotulo>Tudo o que tem na Pólia One</Rotulo>
          </div>
          <h2 className={`mx-auto mt-4 max-w-[24ch] text-center ${H2}`}>
            Tudo o que a sua marca precisa pra parar de depender da memória.
          </h2>
          <div className="mt-12 flex flex-col">
            {recursos.map((r, i) => (
              <Reveal key={r.titulo}>
                <div className="grid grid-cols-1 items-center gap-8 border-t border-[var(--line)] py-12 md:grid-cols-2 md:gap-16">
                  <div className={i % 2 === 1 ? "md:order-2" : ""}>
                    <h3 className="flex flex-wrap items-center gap-3 text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)]">
                      {r.titulo}
                      {r.gratis && (
                        <span className="font-accent rounded-full bg-[var(--secondary-light)] px-3 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--ink)]">
                          Já vem no grátis
                        </span>
                      )}
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
              Quer ver funcionando? É menos de dois minutos.
            </h3>
            <PlayerVsl busca={busca} className="mx-auto mt-8 max-w-[960px]" />
            <div className="mt-8 flex flex-col items-center text-center">
              <BotaoCadastro busca={busca} contexto="por-dentro">
                Quero organizar a minha marca
              </BotaoCadastro>
              <p className="mt-3 text-[13px] text-[var(--muted)]">
                Grátis pra começar, sem cartão.
              </p>
            </div>
          </div>
        </Secao>

        {/* A seção "A marca abre. O número prova." saiu em 03/11/2026 (pedido da Sil):
            sem o Planejamento, ela não tinha mais o que mostrar. */}

        {/* 6 · UMA ASSINATURA NO LUGAR DE VÁRIAS (03/11/2026, pedido da Sil, inspirado no
            "deixando de usar outras ferramentas" do Pode Postar). Sem depoimento nem número
            de economia até ter fonte. */}
        <Secao fundo="surface">
          <h2 className={`mx-auto max-w-[24ch] text-center ${H2}`}>
            Uma assinatura no lugar de um monte de coisa.
          </h2>
          <ul className="mx-auto mt-10 flex max-w-[760px] list-none flex-wrap justify-center gap-3">
            {ferramentasEspalhadas.map((f) => (
              <li
                key={f}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[15px] text-[var(--muted)] line-through decoration-[var(--danger)] decoration-2 max-md:text-[14px]"
              >
                {f}
              </li>
            ))}
          </ul>
          <p className={`mx-auto mt-10 text-center ${CORPO}`}>
            Cada app cobra a sua mensalidade e nenhum conversa com o outro.{" "}
            <b className="font-semibold text-[var(--ink)]">
              Na Pólia One fica tudo junto, e dá pra começar sem pagar nada.
            </b>
          </p>
        </Secao>

        {/* 7 · É PRA VOCÊ QUE: quatro cenas que a dona reconhece. */}
        <Secao fundo="secondary-light">
          <h2 className={`text-center ${H2}`}>A Pólia One foi feita pra você que:</h2>
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
              {/* Sem o link pro /sobre (pedido da Sil, 03/11/2026): a cliente não sai da página. */}
            </div>
          </div>
        </Secao>

        {/* 9 · RISCO ZERO: era uma linha de 13 px embaixo do botão. */}
        <section className="bg-[var(--ink)] py-[clamp(64px,8vw,96px)]">
          <div className="mx-auto w-full max-w-[720px] px-[clamp(20px,4vw,48px)] text-center">
            <h2 className="text-[clamp(28px,3.2vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-balance text-[var(--bg)]">
              Experimenta. Se não for pra você, tudo bem.
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
          <h2 className={`mt-4 mb-8 ${H2}`}>
            Comece grátis. Mude de plano quando a marca pedir mais.
          </h2>
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
          {/* 12 · CTA FINAL (texto da Sil, 04/11/2026) */}
          <Secao fundo="secondary">
            <div className="grid grid-cols-1 items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-[7fr_4fr]">
              <div>
                <h2 className="text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)]">
                  O mais difícil você já fez: provar que o seu produto é incrível e que tem cliente
                  querendo comprar.
                </h2>
                <p className="mt-5 text-[18px] leading-[1.6] text-[var(--ink)]">
                  Agora, o seu negócio merece uma organização à altura do seu talento.
                </p>
                <p className="mt-4 text-[18px] leading-[1.6] text-[var(--ink)]">
                  Vem botar ordem na casa hoje mesmo. São 7 dias totalmente grátis com tudo
                  liberado. E o melhor: você nem precisa cadastrar o cartão de crédito pra começar.
                </p>
                <div className="mt-8">
                  <BotaoCadastro busca={busca} contexto="final" invertido>
                    Quero organizar a minha marca
                  </BotaoCadastro>
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
