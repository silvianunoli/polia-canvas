import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BotaoCadastro, CORPO, H2, Rotulo, Secao } from "@/components/landing/BlocosLanding";
import {
  MockCalculadoraHero,
  MockPerguntaMarca,
  MockTresNumeros,
} from "@/components/landing/MocksLanding";
import { MockPlanner } from "@/components/site/ProdutoMock";

/**
 * Blocos do blog (07/10/2026): sumário de revista no lugar da grade de cards,
 * assinatura com a foto da Sil e a chamada final que muda com o assunto do texto.
 * Copy em COPY-BLOG-POLIA-ONE.md, na raiz do workspace.
 */

export type PostResumo = {
  id: string;
  slug: string;
  titulo: string;
  resumo?: string | null;
  categoria: string | null;
  publicado_em?: string | null;
  capa_url: string | null;
  tempo_leitura: number | null;
};

/** Mesma foto do /sobre e da home: um arquivo só, já em cache em quem navega. */
const FOTO_SIL = "/marketing/landing/quemfez-sil-retrato-640.webp";

// Data curta ("12 set") pro sumário. A data completa fica no topo do post.
function dataCurta(publicadoEm: string | null | undefined): string {
  if (!publicadoEm) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).formatToParts(
    new Date(publicadoEm),
  );
  const dia = partes.find((p) => p.type === "day")?.value;
  const mes = partes.find((p) => p.type === "month")?.value.replace(".", "");
  return dia && mes ? `${dia} ${mes}` : "";
}

function Meta({ post }: { post: PostResumo }) {
  const data = dataCurta(post.publicado_em);
  return (
    <p className="text-[13px] text-[var(--muted)]">
      Sil
      {data ? ` · ${data}` : ""}
      {post.tempo_leitura ? ` · ${post.tempo_leitura} min de leitura` : ""}
    </p>
  );
}

const LINK_POST =
  "group block no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]";
// Hover só no título: sublinhado turquesa, sem cartão pulando.
const TITULO_HOVER =
  "decoration-[var(--secondary)] decoration-2 underline-offset-[6px] group-hover:underline";

/** Texto mais recente, como manchete. Capa só entra quando é foto de verdade. */
export function ManchetePost({ post }: { post: PostResumo }) {
  return (
    <Link to="/blog/$slug" params={{ slug: post.slug }} className={LINK_POST}>
      <article
        className={`grid grid-cols-1 items-center gap-8 ${post.capa_url ? "md:grid-cols-[6fr_5fr]" : ""}`}
      >
        <div>
          {post.categoria && <Rotulo>{post.categoria}</Rotulo>}
          <h2
            className={`mt-4 max-w-[22ch] text-[clamp(32px,4vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-[var(--ink)] ${TITULO_HOVER}`}
          >
            {post.titulo}
          </h2>
          {post.resumo && <p className={`mt-5 ${CORPO}`}>{post.resumo}</p>}
          <div className="mt-5">
            <Meta post={post} />
          </div>
        </div>
        {post.capa_url && (
          <img
            src={post.capa_url}
            alt=""
            loading="eager"
            decoding="async"
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
        )}
      </article>
    </Link>
  );
}

/** Uma linha do sumário: categoria, título, resumo e quem escreveu. */
export function LinhaPost({ post, resumo = true }: { post: PostResumo; resumo?: boolean }) {
  return (
    <Link to="/blog/$slug" params={{ slug: post.slug }} className={LINK_POST}>
      <article
        className={`grid grid-cols-1 gap-6 py-8 ${post.capa_url ? "sm:grid-cols-[1fr_160px]" : ""}`}
      >
        <div>
          {post.categoria && <Rotulo>{post.categoria}</Rotulo>}
          <h3
            className={`mt-3 max-w-[32ch] text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.02em] text-balance text-[var(--ink)] ${TITULO_HOVER}`}
          >
            {post.titulo}
          </h3>
          {resumo && post.resumo && (
            <p className="mt-2 max-w-[62ch] text-[16px] leading-[1.6] text-[var(--ink-soft)] line-clamp-2">
              {post.resumo}
            </p>
          )}
          <div className="mt-3">
            <Meta post={post} />
          </div>
        </div>
        {post.capa_url && (
          <img
            src={post.capa_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
        )}
      </article>
    </Link>
  );
}

/** Lista de linhas separadas por 1px, sem cartão. */
export function SumarioPosts({ posts, resumo = true }: { posts: PostResumo[]; resumo?: boolean }) {
  return (
    <ul className="list-none">
      {posts.map((p) => (
        <li key={p.id} className="border-t border-[var(--line)]">
          <LinhaPost post={p} resumo={resumo} />
        </li>
      ))}
    </ul>
  );
}

/** Foto redonda da Sil. `alt` vazio: o nome dela está escrito ao lado. */
export function FotoSil({ tamanho }: { tamanho: 48 | 64 | 96 }) {
  const classe = { 48: "h-12 w-12", 64: "h-16 w-16", 96: "h-24 w-24" }[tamanho];
  return (
    <img
      src={FOTO_SIL}
      alt=""
      width={tamanho}
      height={tamanho}
      decoding="async"
      className={`${classe} flex-none rounded-full object-cover object-[50%_25%]`}
    />
  );
}

export function AssinaturaSil({
  children,
  tamanho = 48,
}: {
  children: ReactNode;
  tamanho?: 48 | 64;
}) {
  return (
    <div className="flex items-center gap-4">
      <FotoSil tamanho={tamanho} />
      <div>{children}</div>
    </div>
  );
}

/* ───────────────────────── chamada final por assunto ───────────────────────── */

type Chamada = {
  /** Sufixo da origem no cadastro: mede qual assunto traz conta. */
  chave: string;
  rotulo: string;
  titulo: string;
  frase: string;
  botao: string;
  mock: ReactNode;
};

// Planner e Financeiro são Premium: a frase deles não diz "no Grátis".
const CHAMADAS: Record<string, Chamada> = {
  Precificação: {
    chave: "precificacao",
    rotulo: "Calculadora",
    titulo: "O preço desse texto, feito com o seu custo.",
    frase:
      "A Calculadora da Pólia One pega custo, taxas e quanto precisa sobrar e devolve o preço sugerido. Funciona no Grátis.",
    botao: "Quero calcular meu preço",
    mock: <MockCalculadoraHero />,
  },
  "Gestão financeira": {
    chave: "financeiro",
    rotulo: "Financeiro",
    titulo: "O que entrou e o que sobrou, mês a mês.",
    frase:
      "A Pólia One compara cada venda com a meta do mês e mostra quanto falta pra fechar as contas.",
    botao: "Quero ver o meu mês",
    mock: <MockTresNumeros />,
  },
  Organização: {
    chave: "organizacao",
    rotulo: "Planner",
    titulo: "A semana organizada pelo que faz o mês fechar.",
    frase:
      "O Planner da Pólia One liga as tarefas às metas que você definiu, pra decisão não ficar só na cabeça.",
    botao: "Quero organizar a semana",
    mock: <MockPlanner />,
  },
  "Validação de ideia": {
    chave: "ideia",
    rotulo: "Planejamento",
    titulo: "A ideia no papel antes do primeiro preço.",
    frase:
      "O Planejamento da Pólia One pergunta pra quem é a marca, o que ela entrega e quanto precisa render. O primeiro preço já nasce calculado.",
    botao: "Quero pôr a ideia no papel",
    mock: <MockPerguntaMarca />,
  },
};

const CHAMADA_GERAL: Chamada = {
  chave: "geral",
  rotulo: "Pólia One",
  titulo: "Da leitura pro seu próprio número.",
  frase:
    "A Pólia One pergunta da marca primeiro e depois faz a conta: custo, taxas e quanto precisa sobrar viram um preço, e cada venda mostra quanto falta pro mês fechar.",
  botao: "Quero começar grátis",
  mock: <MockCalculadoraHero />,
};

/**
 * Faixa de largura cheia no fim do blog e de cada texto: a ferramenta ligada ao
 * assunto, mostrada funcionando (mock em código, sem peso de imagem).
 * Sem categoria (a listagem), usa a chamada geral com origem "blog".
 */
export function ChamadaBlog({ categoria }: { categoria?: string | null }) {
  const c = (categoria && CHAMADAS[categoria]) || CHAMADA_GERAL;
  const origem = categoria ? `blog-${c.chave}` : "blog";
  return (
    <Secao fundo="surface-pink">
      <div className="grid grid-cols-1 items-center gap-x-[clamp(32px,5vw,64px)] gap-y-10 md:grid-cols-[6fr_5fr]">
        <div>
          <Rotulo>{c.rotulo}</Rotulo>
          <h2 className={`mt-4 max-w-[22ch] ${H2}`}>{c.titulo}</h2>
          <p className={`mt-5 ${CORPO} !text-[var(--ink)]`}>{c.frase}</p>
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <div>
              <BotaoCadastro
                busca={{ origem }}
                contexto={`blog_${c.chave}`}
                className="max-md:w-full"
              >
                {c.botao}
              </BotaoCadastro>
            </div>
            <Link
              to="/planos"
              className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2 max-md:justify-center"
            >
              Ver os planos
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-[var(--ink)]">Sem cartão no Grátis.</p>
        </div>
        <div>
          {c.mock}
          <p className="mt-3 text-[13px] text-[var(--ink)]">Números de exemplo.</p>
        </div>
      </div>
    </Secao>
  );
}
