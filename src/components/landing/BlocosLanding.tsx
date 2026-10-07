import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, type LucideIcon } from "lucide-react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { BTN_CONTORNO, BTN_PRIMARIO, CONTAINER, Eyebrow } from "@/components/site/Editorial";
import { Reveal } from "@/components/site/Reveal";

/**
 * Blocos das landings de campanha (/landing-a e /landing-b, 06/10/2026).
 * Especificação: WIREFRAME-LANDINGS-POLIA-ONE.md, na raiz do workspace.
 *
 * As duas páginas usam os mesmos blocos e só mudam a copy. Tudo nos tokens do
 * .polia-v3; o botão é o canônico de lib/botoes.ts, o mesmo do resto do site.
 */

export type BuscaCadastro = {
  origem?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

/* ───────────────────────────── botões ───────────────────────────── */

/** Botão principal da campanha: sempre leva ao cadastro, com a origem junto. */
export function BotaoCadastro({
  busca,
  contexto,
  children = "Quero começar grátis",
  className = "",
  compacto = false,
  invertido = false,
  botaoRef,
}: {
  busca: BuscaCadastro;
  contexto: string;
  children?: ReactNode;
  className?: string;
  compacto?: boolean;
  /** Pra faixa turquesa: turquesa sobre turquesa some, então vira tinta. */
  invertido?: boolean;
  botaoRef?: RefObject<HTMLAnchorElement | null>;
}) {
  const base = invertido ? `${BTN_PRIMARIO} !bg-[var(--ink)] !text-[var(--bg)]` : BTN_PRIMARIO;
  return (
    <Link
      ref={botaoRef}
      to="/auth/cadastro"
      search={busca}
      data-track="cadastro_cta_clicado"
      data-track-props={JSON.stringify({ contexto, landing: busca.origem ?? null })}
      className={`${base} ${compacto ? "!min-h-[44px] !px-4 !py-2 !text-[14px]" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Ação secundária em texto: link sublinhado que também leva ao cadastro. */
export function LinkCadastro({
  busca,
  contexto,
  children,
}: {
  busca: BuscaCadastro;
  contexto: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/auth/cadastro"
      search={busca}
      data-track="cadastro_cta_clicado"
      data-track-props={JSON.stringify({ contexto, landing: busca.origem ?? null })}
      className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
    >
      {children}
    </Link>
  );
}

/* ───────────────────────────── estrutura ───────────────────────────── */

/** Topo de campanha: logo e um botão. Sem menu, pra não abrir saída. */
export function HeaderCampanha({ busca }: { busca: BuscaCadastro }) {
  return (
    <header className="z-30 border-b border-[var(--line)] bg-[var(--bg)] md:sticky md:top-0">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-4`}>
        <Link to="/" aria-label="Pólia One, página inicial">
          <PoliaWordmark className="h-6 w-auto" />
        </Link>
        <BotaoCadastro busca={busca} contexto="header" compacto />
      </div>
    </header>
  );
}

/**
 * Barra fixa só no celular. Aparece quando o botão do hero sai da tela e some
 * de novo nos Planos e no CTA final, pra nunca ter dois botões iguais à vista.
 */
export function BarraCtaMobile({
  busca,
  heroCta,
  zonasSemBarra,
}: {
  busca: BuscaCadastro;
  heroCta: RefObject<HTMLElement | null>;
  zonasSemBarra: RefObject<HTMLElement | null>[];
}) {
  const [heroVisivel, setHeroVisivel] = useState(true);
  const [zonasVisiveis, setZonasVisiveis] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const alvoHero = heroCta.current;
    const obsHero = new IntersectionObserver(([e]) => setHeroVisivel(e.isIntersecting));
    if (alvoHero) obsHero.observe(alvoHero);

    const visiveis = new Set<Element>();
    const obsZonas = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) visiveis.add(e.target);
        else visiveis.delete(e.target);
      }
      setZonasVisiveis(visiveis.size);
    });
    for (const z of zonasSemBarra) if (z.current) obsZonas.observe(z.current);

    return () => {
      obsHero.disconnect();
      obsZonas.disconnect();
    };
    // As refs são estáveis; observar uma vez basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visivel = !heroVisivel && zonasVisiveis === 0;

  return (
    // inert (e não só aria-hidden): escondida, a barra sai da ordem do teclado.
    // O padding de baixo respeita a área do indicador de início do iPhone.
    <div
      inert={!visivel}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--bg)] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 transition-transform duration-200 ease-out motion-reduce:transition-none md:hidden ${
        visivel ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <BotaoCadastro busca={busca} contexto="barra_mobile" className="w-full" />
    </div>
  );
}

/** Seção com fundo de token e padding da escala. */
export function Secao({
  children,
  fundo = "bg",
  respiro = false,
  id,
  secaoRef,
  className = "",
}: {
  children: ReactNode;
  fundo?: "bg" | "surface" | "secondary-light" | "secondary";
  respiro?: boolean;
  id?: string;
  secaoRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const cor = {
    bg: "bg-[var(--bg)]",
    surface: "bg-[var(--surface)]",
    "secondary-light": "bg-[var(--secondary-light)]",
    secondary: "bg-[var(--secondary)]",
  }[fundo];
  const pad = respiro ? "py-[clamp(96px,10vw,128px)]" : "py-[clamp(64px,8vw,96px)]";
  return (
    <section ref={secaoRef} id={id} className={`${cor} ${pad} ${className}`}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

/* ───────────────────────────── texto ───────────────────────────── */

export const H2 =
  "text-[clamp(26px,2.6vw,38px)] font-bold leading-[1.12] tracking-[-0.02em] text-balance text-[var(--ink)]";
export const CORPO =
  "max-w-[62ch] text-[17px] leading-[1.7] text-[var(--ink-soft)] max-md:text-[16px]";

export function Rotulo({ children }: { children: ReactNode }) {
  return <Eyebrow>{children}</Eyebrow>;
}

/** Frase-âncora da seção: Fraunces itálico, o único uso dela na página. */
export function FraseAncora({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-fraunces max-w-[40ch] text-[clamp(19px,1.8vw,22px)] italic leading-[1.45] text-[var(--ink)] ${className}`}
    >
      {children}
    </p>
  );
}

/** Fala real da pesquisa, em Anzylna, como nota escrita à mão. */
export function NotaPesquisa({
  texto,
  fundo = "surface",
  className = "",
}: {
  texto: string;
  fundo?: "surface" | "branco";
  className?: string;
}) {
  return (
    <figure
      className={`rounded-xl border border-[var(--line)] p-6 ${
        fundo === "branco" ? "bg-white" : "bg-[var(--surface)]"
      } ${className}`}
    >
      <blockquote
        className="font-anzylna leading-[1.35] text-[var(--ink)]"
        style={{ "--anzylna-size": "25px" } as CSSProperties}
      >
        {texto}
      </blockquote>
      <figcaption className="mt-3 text-[13px] text-[var(--muted)]">
        Resposta anônima da pesquisa da Pólia
      </figcaption>
    </figure>
  );
}

/** Número de pesquisa como imagem tipográfica. */
export function NumeroProva({
  numero,
  texto,
  tamanho = "grande",
}: {
  numero: string;
  texto: string;
  tamanho?: "grande" | "medio";
}) {
  return (
    <div>
      <p
        className={`font-cabinet font-bold leading-none tracking-[-0.03em] text-[var(--ink)] ${
          tamanho === "grande" ? "text-[clamp(56px,7vw,88px)]" : "text-[clamp(44px,4.6vw,56px)]"
        }`}
      >
        {numero}
      </p>
      <p className="mt-3 max-w-[26ch] text-[16px] leading-[1.5] text-[var(--ink-soft)]">{texto}</p>
    </div>
  );
}

export function FontePesquisa({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-[13px] leading-[1.5] text-[var(--muted)]">{children}</p>;
}

/* ───────────────────────────── foto ───────────────────────────── */

/**
 * Fotos que já existem em /marketing/landing/ (<nome>-640.webp, -1080.webp e
 * .jpg). Foto fora desta lista nem é pedida ao servidor: vira bloco liso na
 * proporção certa, sem 404 no tráfego pago. Ao subir uma foto nova, incluir o
 * nome aqui (lista em PROMPTS-FOTOS-LANDINGS.md, na raiz do workspace).
 */
const FOTOS_DISPONIVEIS = new Set<string>([
  "hero-orcamento-celular",
  "problema-caderno-contas",
  "mecanismo-maos-aquarela",
  "praquem-bancada-pedidos",
  "ctafinal-celular-pedido",
  "a-cena-encomenda-lembrancinhas",
  "quemfez-sil-retrato",
]);

export function FotoLanding({
  nome,
  alt,
  proporcao,
  prioridade = false,
  largura = 1080,
  className = "",
  borda = false,
}: {
  nome: string;
  alt: string;
  proporcao: "4/5" | "3/2" | "1/1" | "21/9";
  prioridade?: boolean;
  largura?: 1080 | 2100;
  className?: string;
  borda?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const base = `/marketing/landing/${nome}`;
  const aspecto = {
    "4/5": "aspect-[4/5]",
    "3/2": "aspect-[3/2]",
    "1/1": "aspect-square",
    "21/9": "aspect-[16/9] md:aspect-[21/9]",
  }[proporcao];
  // Fundo pêssego sempre na moldura: é o que aparece enquanto a foto carrega.
  const moldura = `${aspecto} w-full overflow-hidden rounded-xl bg-[var(--surface-pink)] ${
    borda ? "border border-[var(--ink)]" : ""
  } ${className}`;

  // Com SSR, um 404 pode acontecer antes da hidratação, quando o onError do
  // React ainda não existe. Na montagem, confere se a imagem já falhou.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFalhou(true);
  }, []);

  if (falhou || !FOTOS_DISPONIVEIS.has(nome)) {
    // O alt descreve uma foto que ainda não existe: o bloco fica fora do leitor de tela.
    return (
      <div aria-hidden="true" className={`${moldura} grid place-items-center`}>
        {import.meta.env.DEV && (
          <span className="px-4 text-center text-[12px] text-[var(--ink-soft)]">{nome}.jpg</span>
        )}
      </div>
    );
  }

  const srcSet =
    largura === 2100
      ? `${base}-640.webp 640w, ${base}-1080.webp 1080w, ${base}-2100.webp 2100w`
      : `${base}-640.webp 640w, ${base}-1080.webp 1080w`;

  return (
    <div className={moldura}>
      <picture>
        <source type="image/webp" srcSet={srcSet} sizes="(min-width: 768px) 50vw, 100vw" />
        <img
          ref={imgRef}
          src={`${base}.jpg`}
          alt={alt}
          className="h-full w-full object-cover"
          loading={prioridade ? "eager" : "lazy"}
          decoding="async"
          {...(prioridade ? { fetchPriority: "high" as const } : {})}
          onError={() => setFalhou(true)}
        />
      </picture>
    </div>
  );
}

/* ───────────────────────────── listas ───────────────────────────── */

export type ItemLista = {
  icone: LucideIcon;
  titulo: string;
  texto: string;
  planos?: Array<"Grátis" | "Premium" | "Pro" | "Grátis até 5" | "Premium sem limite">;
};

const TOM_PLANO: Record<string, string> = {
  Grátis: "bg-[var(--bg)] border border-[var(--line)]",
  "Grátis até 5": "bg-[var(--bg)] border border-[var(--line)]",
  Premium: "bg-[var(--secondary-light)]",
  "Premium sem limite": "bg-[var(--secondary-light)]",
  Pro: "bg-[var(--accent)]",
};

export function EtiquetaPlano({ nome }: { nome: string }) {
  return (
    <span
      className={`font-accent inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--ink)] ${
        TOM_PLANO[nome] ?? ""
      }`}
    >
      {nome}
    </span>
  );
}

function IconeQuadrado({ icone: Icone }: { icone: LucideIcon }) {
  return (
    <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-[var(--surface-pink)]">
      <Icone aria-hidden="true" className="h-6 w-6 text-[var(--ink)]" strokeWidth={1.5} />
    </span>
  );
}

/** Lista editorial com ícone, linha de 1px entre itens. Nunca 3 cards iguais. */
export function ListaEditorial({ itens, colunas = 1 }: { itens: ItemLista[]; colunas?: 1 | 2 }) {
  return (
    <ul
      className={`grid list-none grid-cols-1 gap-x-[clamp(32px,4vw,64px)] ${
        colunas === 2 ? "md:grid-cols-2" : ""
      }`}
    >
      {itens.map((item, i) => (
        <li key={item.titulo} className="border-t border-[var(--line)] py-6">
          <Reveal delay={i * 0.08}>
            <div className="flex items-start gap-4">
              <IconeQuadrado icone={item.icone} />
              <div className="min-w-0">
                <p className="text-[17px] leading-[1.6] text-[var(--ink-soft)]">
                  <b className="font-semibold text-[var(--ink)]">{item.titulo}</b> {item.texto}
                </p>
                {item.planos && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.planos.map((p) => (
                      <EtiquetaPlano key={p} nome={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

/** Pra quem é / talvez não seja: check e traço, sem cards. */
export function ParaQuem({ sim, nao }: { sim: string[]; nao: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-[clamp(48px,5vw,64px)] md:grid-cols-[7fr_5fr]">
      <ul className="flex list-none flex-col gap-4">
        {sim.map((s) => (
          <li
            key={s}
            className="flex items-start gap-3 text-[17px] leading-[1.55] text-[var(--ink)]"
          >
            <Check aria-hidden="true" className="mt-1 h-5 w-5 flex-none" strokeWidth={1.75} />
            {s}
          </li>
        ))}
      </ul>
      <div>
        <h3 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Talvez não seja pra você se:
        </h3>
        <ul className="mt-4 flex list-none flex-col gap-3">
          {nao.map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]"
            >
              <Minus aria-hidden="true" className="mt-1 h-5 w-5 flex-none" strokeWidth={1.75} />
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────── como funciona ───────────────────────────── */

export type Passo = { n: string; titulo: string; texto: ReactNode; mock: ReactNode };

/**
 * Passos à esquerda; no desktop, o mock do passo em foco fica parado à direita
 * e troca com fade quando outro passo chega ao meio da tela. No celular, cada
 * passo vem seguido do seu mock, sem nada grudado.
 */
export function ComoFuncionaPassos({ passos }: { passos: Passo[] }) {
  const [ativo, setAtivo] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.indice));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-[clamp(32px,5vw,64px)] md:grid-cols-[5fr_6fr]">
      <ol className="flex list-none flex-col">
        {passos.map((p, i) => (
          <li
            key={p.n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-indice={i}
            className="border-t border-[var(--line)] py-8 md:min-h-[38vh]"
          >
            <div
              className={`transition-colors duration-200 md:border-l-[3px] md:pl-6 ${
                ativo === i ? "md:border-[var(--secondary)]" : "md:border-transparent"
              }`}
            >
              <p className="font-cabinet text-[40px] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
                {p.n}
              </p>
              <h3 className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                {p.titulo}
              </h3>
              <p
                className={`mt-2 max-w-[44ch] text-[17px] leading-[1.65] text-[var(--ink-soft)] transition-colors duration-200 ${
                  ativo === i ? "md:text-[var(--ink)]" : ""
                }`}
              >
                {p.texto}
              </p>
            </div>
            <div className="mt-6 md:hidden">{p.mock}</div>
          </li>
        ))}
      </ol>
      <div className="hidden md:block">
        <div className="sticky top-[112px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={ativo}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              {passos[ativo]?.mock}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── planos ───────────────────────────── */

export type PlanoLanding = {
  nome: "Grátis" | "Premium" | "Pro";
  praQuem: string;
  mensal: string;
  anual?: string;
  itens: string[];
  /** Item que a página inteira prometeu, em destaque no card. */
  itemForte?: number;
  etiqueta?: string;
};

export function PlanosLanding({
  planos,
  busca,
  microGratis = "Sem cartão.",
}: {
  planos: PlanoLanding[];
  busca: BuscaCadastro;
  microGratis?: string;
}) {
  const [anual, setAnual] = useState(false);
  return (
    <div>
      <div
        role="group"
        aria-label="Ciclo de cobrança"
        className="mb-6 inline-flex rounded-xl border border-[var(--line)] bg-white p-1"
      >
        {[
          { v: false, t: "Mensal" },
          { v: true, t: "Anual" },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            aria-pressed={anual === o.v}
            onClick={() => setAnual(o.v)}
            className={`min-h-[44px] rounded-md px-4 text-[14px] font-semibold transition-colors duration-150 ${
              anual === o.v
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--bg)]"
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {planos.map((p) => {
          const gratis = p.nome === "Grátis";
          const preco = anual && p.anual ? p.anual : p.mensal;
          const ciclo = gratis ? "" : anual && p.anual ? "por ano" : "por mês";
          return (
            <article
              key={p.nome}
              className={`flex flex-col rounded-xl bg-white p-8 ${
                p.nome === "Premium"
                  ? "border-2 border-[var(--secondary)]"
                  : "border border-[var(--line)]"
              }`}
            >
              {p.etiqueta && (
                <span className="font-accent mb-4 self-start rounded-full bg-[var(--secondary-light)] px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--ink)]">
                  {p.etiqueta}
                </span>
              )}
              <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                {p.nome}
              </h3>
              <p aria-live="polite" className="mt-4 flex items-baseline gap-2">
                <span className="font-cabinet text-[40px] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
                  {preco}
                </span>
                {ciclo && <span className="text-[15px] text-[var(--ink-soft)]">{ciclo}</span>}
              </p>
              {anual && p.anual && (
                <p className="mt-1 text-[13px] text-[var(--muted)]">2 meses grátis</p>
              )}
              <p className="mt-4 text-[16px] font-semibold leading-[1.45] text-[var(--ink)]">
                {p.praQuem}
              </p>
              <ul className="mt-5 flex flex-1 list-none flex-col gap-3">
                {p.itens.map((item, i) => (
                  <li
                    key={item}
                    className={`flex items-start gap-2.5 text-[15px] leading-[1.5] ${
                      p.itemForte === i
                        ? "font-semibold text-[var(--ink)]"
                        : "text-[var(--ink-soft)]"
                    }`}
                  >
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 flex-none"
                      strokeWidth={2}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {gratis ? (
                  <>
                    <BotaoCadastro busca={busca} contexto="planos_gratis" className="w-full" />
                    <p className="mt-3 text-[13px] text-[var(--muted)]">{microGratis}</p>
                  </>
                ) : (
                  <Link
                    to="/planos"
                    // A origem e as UTMs seguem até o Stripe, igual o botão do
                    // Grátis leva até o cadastro: sem isso não dá pra saber
                    // qual landing vendeu.
                    search={{ ...busca, plano: p.nome === "Premium" ? "premium" : "pro" }}
                    data-track="plano_cta_clicado"
                    data-track-props={JSON.stringify({
                      plano: p.nome,
                      landing: busca.origem ?? null,
                    })}
                    className={`${BTN_CONTORNO} w-full`}
                  >
                    {`Quero o ${p.nome}`}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────── FAQ ───────────────────────────── */

/** `details` nativo: abre sem JS e já é acessível pelo teclado. */
export function FaqLanding({ perguntas }: { perguntas: { pergunta: string; resposta: string }[] }) {
  return (
    <div className="max-w-[760px] border-t border-[var(--line)]">
      {perguntas.map((p, i) => (
        <details key={p.pergunta} className="group border-b border-[var(--line)]" open={i === 0}>
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-5 text-[18px] font-semibold tracking-[-0.01em] text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            {p.pergunta}
            <span
              aria-hidden="true"
              className="grid h-7 w-7 flex-none place-items-center rounded-full border border-[var(--line)] text-[16px] text-[var(--ink-soft)] transition-transform duration-200 group-open:rotate-45 group-open:border-[var(--secondary)] group-open:bg-[var(--secondary)] group-open:text-[var(--secondary-ink)]"
            >
              +
            </span>
          </summary>
          <p className="max-w-[62ch] pb-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
            {p.resposta}
          </p>
        </details>
      ))}
    </div>
  );
}
