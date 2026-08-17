import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { renderBlogMarkdown } from "@/lib/blogRenderMarkdown";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import type { ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";

type PostRow = Pick<
  Tables<"blog_posts">,
  | "id"
  | "slug"
  | "titulo"
  | "resumo"
  | "categoria"
  | "conteudo_md"
  | "capa_url"
  | "publicado_em"
  | "tempo_leitura"
>;

type RelatedPost = Pick<
  Tables<"blog_posts">,
  "id" | "slug" | "titulo" | "categoria" | "capa_url" | "tempo_leitura"
>;

// Mesma rotação de cor do card sem capa usada em /blog.
const CAPAS = ["var(--secondary)", "var(--accent)", "var(--surface-pink)"];

// Coluna de leitura: 68ch, corpo 18px, entrelinha folgada.
const PROSA = [
  "max-w-[68ch] text-[18px] leading-[1.7] text-[var(--ink-soft)]",
  "[&>*+*]:mt-6",
  "[&_p]:leading-[1.7]",
  "[&_h2]:mt-12 [&_h2]:text-[clamp(1.4rem,2.4vw,1.75rem)] [&_h2]:font-bold [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.02em] [&_h2]:text-balance [&_h2]:text-[var(--ink)]",
  "[&_h3]:mt-10 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:leading-[1.25] [&_h3]:tracking-[-0.01em] [&_h3]:text-[var(--ink)]",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-3 [&_li]:leading-[1.7]",
  "[&_strong]:font-semibold [&_strong]:text-[var(--ink)]",
  "[&_a]:text-[var(--ink)] [&_a]:underline [&_a]:decoration-[var(--secondary)] [&_a]:decoration-2 [&_a]:underline-offset-[3px]",
  "[&_blockquote]:my-10 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--secondary)] [&_blockquote]:pl-6",
  "[&_blockquote_p]:text-[clamp(1.25rem,2.2vw,1.6rem)] [&_blockquote_p]:font-medium [&_blockquote_p]:leading-[1.3] [&_blockquote_p]:text-[var(--ink)]",
  "[&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-[var(--line)]",
  "[&_hr]:my-10 [&_hr]:h-px [&_hr]:border-0 [&_hr]:bg-[var(--line)]",
  "[&_code]:rounded-md [&_code]:bg-[var(--surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px] [&_code]:text-[var(--ink)]",
  "[&_.blog-embed]:overflow-hidden [&_.blog-embed]:rounded-2xl [&_.blog-embed]:border [&_.blog-embed]:border-[var(--line)]",
  "[&_.blog-embed_iframe]:aspect-video [&_.blog-embed_iframe]:w-full [&_.blog-embed_iframe]:border-0",
].join(" ");

const CARTAO =
  "overflow-hidden rounded-2xl border border-[var(--line)] bg-white no-underline transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

// Sem resumo cadastrado a description caía em "Pólia blog." e o og:description
// em string vazia: o link circulava no WhatsApp sem nada que fizesse clicar.
const DESCRICAO_PADRAO = "Texto da Sil sobre preço, lucro e marca pra quem toca o próprio negócio.";
const TITULO_PADRAO = "Blog da Pólia: preço, lucro e marca";

/** Tela curta de aviso do blog, com as saídas que o estado de erro não tinha. */
function BlogAviso({ titulo, corpo, acao }: { titulo: string; corpo: string; acao?: ReactNode }) {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main className={SECAO}>
        <div className={CONTAINER}>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
            <p className="font-semibold">{titulo}</p>
            <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--ink-soft)]">
              {corpo}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {acao ?? (
                <>
                  <Link to="/lista-de-espera" className={BTN_PRIMARIO}>
                    Entrar na lista
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/sobre" className={BTN_CONTORNO}>
                    Conhecer a Pólia
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  );
}

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data: post } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, titulo, resumo, categoria, conteudo_md, capa_url, publicado_em, tempo_leitura",
      )
      .eq("slug", params.slug)
      .eq("publicado", true)
      .maybeSingle<PostRow>();
    if (!post) throw notFound();

    const { data: related } = await supabase
      .from("blog_posts")
      .select("id, slug, titulo, categoria, capa_url, tempo_leitura")
      .eq("publicado", true)
      .neq("id", post.id)
      .order("publicado_em", { ascending: false })
      .limit(3);

    return { post, related: (related as RelatedPost[] | null) ?? [] };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.post.titulo ? `${loaderData.post.titulo} · Blog · Pólia` : TITULO_PADRAO,
      },
      { name: "description", content: loaderData?.post.resumo || DESCRICAO_PADRAO },
      { property: "og:title", content: loaderData?.post.titulo ?? TITULO_PADRAO },
      { property: "og:description", content: loaderData?.post.resumo || DESCRICAO_PADRAO },
      ...(loaderData?.post.capa_url
        ? [{ property: "og:image", content: loaderData.post.capa_url }]
        : []),
    ],
  }),
  component: BlogPost,
  // A rota lançava notFound() sem nenhum destes três: link quebrado, falha de
  // rede e a espera do loader caíam todos numa tela em branco.
  notFoundComponent: () => (
    <BlogAviso
      titulo="Esse texto não está aqui."
      corpo="Ou o link veio quebrado, ou o texto saiu do ar. Acontece."
    />
  ),
  errorComponent: () => (
    <BlogAviso
      titulo="Não deu pra carregar esse texto agora."
      corpo="Pode ser a conexão. Recarregar a página costuma resolver."
      acao={
        <button type="button" onClick={() => window.location.reload()} className={BTN_PRIMARIO}>
          Tentar de novo
        </button>
      }
    />
  ),
  pendingComponent: () => (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main className={SECAO}>
        <div className={CONTAINER}>
          <p className="text-[var(--ink-soft)]">Abrindo o texto…</p>
        </div>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  ),
});

function RelatedCover({ post, index }: { post: RelatedPost; index: number }) {
  if (post.capa_url) {
    return <img src={post.capa_url} alt="" className="aspect-video w-full object-cover" />;
  }
  return (
    <div
      className="flex aspect-video items-start p-3"
      style={{ background: CAPAS[index % CAPAS.length] }}
    >
      {post.categoria && (
        <span className="font-accent inline-flex rounded-lg bg-[var(--bg)] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          {post.categoria}
        </span>
      )}
    </div>
  );
}

/** Bloco de assinatura da autora, repetido no topo e no pé do texto. */
function Assinatura({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="font-cabinet flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[var(--accent)] text-[22px] text-[var(--accent-ink)]">
        S
      </div>
      <div>{children}</div>
    </div>
  );
}

function BlogPost() {
  const { post, related } = Route.useLoaderData();
  const html = renderBlogMarkdown(post.conteudo_md);

  const dataPublicada = post.publicado_em
    ? new Date(post.publicado_em).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        <article className="pb-[clamp(48px,6vw,72px)] pt-[clamp(32px,5vw,64px)]">
          <div className={`${CONTAINER} max-w-[68ch]`}>
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--secondary-text)] no-underline hover:underline"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar pro blog
            </Link>

            <div className="mt-8">
              <Reveal>
                <Eyebrow>{post.categoria ?? "Blog"}</Eyebrow>
              </Reveal>
              <h1 className="mt-4 text-[clamp(2.1rem,4.6vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                {post.titulo}
              </h1>
              {post.resumo && (
                <Reveal delay={0.1}>
                  <p className="mt-5 text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                    {post.resumo}
                  </p>
                </Reveal>
              )}

              <div className="mt-8">
                <Assinatura>
                  <p className="font-semibold">Sil</p>
                  <p className="text-[14px] text-[var(--ink-soft)]">
                    {dataPublicada}
                    {dataPublicada && post.tempo_leitura ? " · " : ""}
                    {post.tempo_leitura ? `${post.tempo_leitura} min de leitura` : ""}
                  </p>
                </Assinatura>
              </div>
            </div>
          </div>

          <Reveal delay={0.1} y={28} className={`${CONTAINER} max-w-[68ch]`}>
            {post.capa_url ? (
              <img
                src={post.capa_url}
                alt=""
                aria-hidden="true"
                className="my-[clamp(32px,5vw,56px)] aspect-[16/7] w-full rounded-2xl border border-[var(--line)] object-cover"
              />
            ) : (
              <div
                className="my-[clamp(32px,5vw,56px)] aspect-[16/7] w-full rounded-2xl border border-[var(--line)]"
                style={{ background: CAPAS[0] }}
                aria-hidden="true"
              />
            )}
          </Reveal>

          <div className={`${CONTAINER} max-w-[68ch]`}>
            {/* Corpo editorial assinado: renderizado como veio do CMS. */}
            <div className={PROSA} dangerouslySetInnerHTML={{ __html: html }} />

            <hr className="my-[clamp(40px,5vw,56px)] h-px border-0 bg-[var(--line)]" />

            <Assinatura>
              <p className="font-semibold">Escrito por Sil</p>
              <p className="max-w-[52ch] text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                Escrito por quem toca a própria marca sozinha, sem hack de faturamento e sem
                promessa vazia.
              </p>
            </Assinatura>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/" hash="planos" className={BTN_PRIMARIO}>
                Ver quanto sobra em cada venda
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/blog" className={BTN_CONTORNO}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar pro blog
              </Link>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="pb-[clamp(48px,6vw,72px)]">
            <div className={CONTAINER}>
              <Reveal>
                <Eyebrow>Pra continuar</Eyebrow>
              </Reveal>
              <RevealGroup className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                {related.map((r, i) => (
                  <RevealItem key={r.id} className="h-full">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: r.slug }}
                      className={`${CARTAO} flex h-full flex-col`}
                    >
                      <RelatedCover post={r} index={i + 1} />
                      <div className="flex flex-1 flex-col gap-2 p-6">
                        <h3 className="text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-balance">
                          {r.titulo}
                        </h3>
                        {r.tempo_leitura && (
                          <p className="text-[13px] text-[var(--ink-soft)]">
                            {r.tempo_leitura} min de leitura
                          </p>
                        )}
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold">
                          Ler o texto
                          <ArrowRight size={14} aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </section>
        )}

        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-pink)] p-[clamp(28px,4vw,56px)]">
                <Eyebrow>Pólia</Eyebrow>
                <h2 className="mt-4 max-w-[22ch] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  Do texto pra prática.
                </h2>
                <p className="mt-4 max-w-[52ch] leading-[1.6] text-[var(--ink-soft)]">
                  O preço, a meta e o que sobra no fim do mês num lugar só. Os planos abrem em
                  breve, e quem está na lista entra primeiro.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/lista-de-espera" className={BTN_PRIMARIO}>
                    Entrar na lista
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/sobre" className={BTN_CONTORNO}>
                    Conhecer a Pólia
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
