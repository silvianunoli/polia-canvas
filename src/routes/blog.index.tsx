import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog · Pólia" },
      {
        name: "description",
        content:
          "Textos da Pólia pra quem toca a marca sozinha. Sem hack de faturamento, sem promessa vazia. Uma coisa de cada vez.",
      },
      { property: "og:title", content: "Blog · Pólia" },
      {
        property: "og:description",
        content: "Textos da Pólia pra quem toca a marca sozinha.",
      },
    ],
  }),
  component: BlogList,
});

type Post = Pick<
  Tables<"blog_posts">,
  "id" | "slug" | "titulo" | "resumo" | "categoria" | "publicado_em" | "capa_url" | "tempo_leitura"
>;

// Rotação de cor de fundo do card quando o post não tem capa (mesma lógica do
// mockup site/blog.html: peach/turquesa/rosa alternados, nunca como texto).
const CAPAS = ["var(--secondary)", "var(--accent)", "var(--surface-pink)"];

function CoverBlock({ post, index }: { post: Post; index: number }) {
  if (post.capa_url) {
    return <img src={post.capa_url} alt="" className="aspect-video w-full object-cover" />;
  }
  return (
    <div
      className="flex aspect-video items-start p-4"
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

function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, titulo, resumo, categoria, publicado_em, capa_url, tempo_leitura")
        .eq("publicado", true)
        .order("publicado_em", { ascending: false });
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const [destaque, ...resto] = posts;

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-8 pt-16 md:pb-10 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Blog
            </p>
            <h1 className="font-cabinet mt-4 max-w-[16ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              Pra quem toca a marca sozinha.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              Sem hack de faturamento, sem "10 passos pra escalar". Textos diretos sobre o que trava
              de verdade quando o time é uma pessoa só, e como voltar pra etapa.
            </p>
          </div>
        </section>

        {loading ? (
          <section className="pb-16">
            <div className="mx-auto max-w-[1120px] px-6">
              <p className="text-center text-[var(--muted)]">Carregando…</p>
            </div>
          </section>
        ) : posts.length === 0 ? (
          <section className="pb-16">
            <div className="mx-auto max-w-[1120px] px-6">
              <p className="text-center text-[var(--muted)]">Nenhum post publicado ainda.</p>
            </div>
          </section>
        ) : (
          <>
            {/* DESTAQUE */}
            <section className="pb-8 md:pb-10">
              <div className="mx-auto max-w-[1120px] px-6">
                <Link
                  to="/blog/$slug"
                  params={{ slug: destaque.slug }}
                  className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--line)] bg-white no-underline transition-colors hover:border-[var(--secondary)] md:grid-cols-[1.1fr_0.9fr]"
                >
                  <div className="md:h-full md:min-h-[300px] [&>*]:h-full [&>img]:md:h-full">
                    <CoverBlock post={destaque} index={0} />
                  </div>
                  <div className="flex flex-col gap-3 p-6 md:p-8">
                    <h2 className="max-w-[20ch] text-[28px] leading-[1.15] text-[var(--ink)]">
                      {destaque.titulo}
                    </h2>
                    {destaque.resumo && <p className="text-[var(--ink-soft)]">{destaque.resumo}</p>}
                    <p className="mt-auto text-[13px] text-[var(--muted)]">
                      Por Sil
                      {destaque.tempo_leitura ? ` · ${destaque.tempo_leitura} min de leitura` : ""}
                    </p>
                  </div>
                </Link>
              </div>
            </section>

            {/* GRADE */}
            {resto.length > 0 && (
              <section className="pb-16">
                <div className="mx-auto max-w-[1120px] px-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {resto.map((post, i) => (
                      <Link
                        key={post.id}
                        to="/blog/$slug"
                        params={{ slug: post.slug }}
                        className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white no-underline transition-colors hover:border-[var(--secondary)]"
                      >
                        <CoverBlock post={post} index={i + 1} />
                        <div className="flex flex-1 flex-col gap-2 p-6">
                          <h3 className="text-[20px] text-[var(--ink)]">
                            {post.titulo}
                          </h3>
                          {post.resumo && (
                            <p className="text-[14px] text-[var(--ink-soft)]">{post.resumo}</p>
                          )}
                          <p className="mt-auto text-[13px] text-[var(--muted)]">
                            Por Sil{post.tempo_leitura ? ` · ${post.tempo_leitura} min` : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* CAPTURA */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-[var(--secondary)] p-8 md:p-12">
              <div>
                <h2 className="max-w-[22ch] text-[28px] text-[var(--secondary-ink)] md:text-[32px]">
                  Gostou de ler? A Pólia é isso na prática.
                </h2>
                <p className="mt-3 max-w-[46ch] text-[var(--secondary-ink)]">
                  Uma marca construída em etapas curtas, no seu ritmo. Dá pra começar agora, sem
                  pressa.
                </p>
              </div>
              <Link
                to="/"
                hash="planos"
                className="inline-flex rounded-lg border border-[var(--ink)] px-8 py-4 text-[18px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-[var(--bg)]"
              >
                Começar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
