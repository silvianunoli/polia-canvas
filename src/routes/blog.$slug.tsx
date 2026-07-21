import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { renderBlogMarkdown } from "@/lib/blogRenderMarkdown";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import type { Tables } from "@/integrations/supabase/types";
import { gatePublico } from "@/lib/site-gate";

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

// Mesma rotação de cor do card sem capa usada em /blog (site/blog.html).
const CAPAS = ["var(--secondary)", "var(--accent)", "var(--surface-pink)"];

export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: gatePublico,
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
      { title: `${loaderData?.post.titulo ?? "Post"} · Blog · Pólia` },
      { name: "description", content: loaderData?.post.resumo ?? "Pólia blog." },
      { property: "og:title", content: loaderData?.post.titulo ?? "Pólia" },
      { property: "og:description", content: loaderData?.post.resumo ?? "" },
      ...(loaderData?.post.capa_url
        ? [{ property: "og:image", content: loaderData.post.capa_url }]
        : []),
    ],
  }),
  component: BlogPost,
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
        <span className="inline-flex rounded-sm bg-black/[0.08] px-3 py-1 text-[13px] font-semibold text-[var(--ink)]">
          {post.categoria}
        </span>
      )}
    </div>
  );
}

function BlogPost() {
  const { post, related } = Route.useLoaderData();
  const html = renderBlogMarkdown(post.conteudo_md);

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        <article className="pb-16 pt-10 md:pt-16">
          <div className="mx-auto max-w-[720px] px-6">
            <p className="text-[14px] text-[var(--muted)]">
              <Link to="/blog" className="text-[var(--ink-soft)] no-underline hover:underline">
                Blog
              </Link>
              {post.categoria && ` · ${post.categoria}`}
            </p>

            <div className="mt-4">
              {post.categoria && (
                <span className="inline-flex rounded-sm bg-[var(--highlight)] px-3 py-1 text-[13px] font-semibold text-[var(--highlight-ink)]">
                  {post.categoria}
                </span>
              )}
              <h1 className="font-cabinet mt-4 text-[36px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[48px]">
                {post.titulo}
              </h1>
              {post.resumo && (
                <p className="mt-4 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)]">
                  {post.resumo}
                </p>
              )}
              <div className="mt-6 flex items-center gap-4">
                <div className="font-cabinet flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)] text-[22px] text-[var(--accent-ink)]">
                  S
                </div>
                <div>
                  <p className="m-0 font-semibold text-[var(--ink)]">Sil</p>
                  <p className="m-0 text-[14px] text-[var(--muted)]">
                    {post.publicado_em &&
                      new Date(post.publicado_em).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    {post.publicado_em && post.tempo_leitura ? " · " : ""}
                    {post.tempo_leitura ? `${post.tempo_leitura} min de leitura` : ""}
                  </p>
                </div>
              </div>
            </div>

            {post.capa_url ? (
              <img
                src={post.capa_url}
                alt=""
                className="my-8 aspect-[16/7] w-full rounded-xl object-cover md:my-12"
              />
            ) : (
              <div
                className="my-8 flex aspect-[16/7] items-end rounded-xl p-6 md:my-12"
                style={{ background: CAPAS[0] }}
              >
                {post.categoria && (
                  <span className="inline-flex rounded-sm bg-black/[0.08] px-3 py-1 text-[13px] font-semibold text-[var(--ink)]">
                    {post.categoria}
                  </span>
                )}
              </div>
            )}

            <div
              className="[&>*+*]:mt-6 [&_p]:text-[18px] [&_p]:leading-[1.65] [&_p]:text-[var(--ink-soft)] [&_li]:text-[18px] [&_li]:leading-[1.65] [&_li]:text-[var(--ink-soft)] [&_h2]:mt-12 [&_h2]:text-[26px] [&_h2]:text-[var(--ink)] [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-3 [&_strong]:font-semibold [&_a]:text-[var(--ink)] [&_a]:underline [&_a]:decoration-[var(--secondary)] [&_a]:decoration-2 [&_a]:underline-offset-[3px] [&_blockquote]:my-12 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--secondary)] [&_blockquote]:pl-6 [&_blockquote_p]:text-[26px] [&_blockquote_p]:font-medium [&_blockquote_p]:leading-[1.3] [&_blockquote_p]:text-[var(--ink)]"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            <hr className="my-12 h-px border-0 bg-[var(--line)]" />
            <div className="flex items-center gap-4">
              <div className="font-cabinet flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)] text-[22px] text-[var(--accent-ink)]">
                S
              </div>
              <div>
                <p className="m-0 font-semibold text-[var(--ink)]">Escrito por Sil</p>
                <p className="m-0 max-w-[52ch] text-[14px] text-[var(--ink-soft)]">
                  Escrito por quem toca a própria marca sozinha, sem hack de faturamento e sem
                  promessa vazia.
                </p>
              </div>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="pb-16">
            <div className="mx-auto max-w-[1120px] px-6">
              <h2 className="mb-6 text-[24px] text-[var(--ink)] md:text-[30px]">
                Pra continuar
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {related.map((r, i) => (
                  <Link
                    key={r.id}
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white no-underline transition-colors hover:border-[var(--secondary)]"
                  >
                    <RelatedCover post={r} index={i + 1} />
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h3 className="text-[18px] text-[var(--ink)]">{r.titulo}</h3>
                      {r.tempo_leitura && (
                        <p className="text-[14px] text-[var(--muted)]">{r.tempo_leitura} min</p>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold text-[var(--ink)]">
                        Ler mais
                        <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <div className="rounded-xl bg-[var(--secondary)] p-8 md:p-12">
              <h2 className="mx-auto max-w-[22ch] text-[28px] text-[var(--secondary-ink)] md:text-[32px]">
                Quer uma ferramenta que te ajuda a decidir com clareza?
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/"
                  hash="planos"
                  className="inline-flex rounded-lg border border-[var(--ink)] px-8 py-4 text-[18px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)]"
                >
                  Começar de graça
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
