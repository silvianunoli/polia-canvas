import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog · Pólia" },
      {
        name: "description",
        content:
          "Textos da Pólia pra quem toca a marca sozinha. Sem hack de faturamento, sem promessa de seis dígitos. Uma coisa de cada vez.",
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

// Rotação de cor de fundo do card quando o post não tem capa (peach/turquesa/rosa
// alternados, sempre como fundo, nunca como texto).
const CAPAS = ["var(--secondary)", "var(--accent)", "var(--surface-pink)"];

// Cartão de post: borda de linha, canto 2xl, hover discreto. Sem sombra.
const CARTAO =
  "overflow-hidden rounded-2xl border border-[var(--line)] bg-white no-underline transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

function CoverBlock({ post, index }: { post: Post; index: number }) {
  if (post.capa_url) {
    return <img src={post.capa_url} alt="" className="aspect-video w-full object-cover" />;
  }
  return <div className="aspect-video" style={{ background: CAPAS[index % CAPAS.length] }} />;
}

function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);

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

  const categorias = useMemo(
    () => [...new Set(posts.map((p) => p.categoria).filter((c): c is string => !!c))],
    [posts],
  );

  const postsFiltrados = categoriaAtiva
    ? posts.filter((p) => p.categoria === categoriaAtiva)
    : posts;

  const [destaque, ...resto] = postsFiltrados;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-[clamp(32px,4vw,48px)] pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Blog</Eyebrow>
            </Reveal>
            <h1 className="mt-4 max-w-[16ch] text-[clamp(2.4rem,5.4vw,4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
              Pra quem toca a marca sozinha.
            </h1>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[60ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Sem hack de faturamento, sem promessa de seis dígitos. Textos diretos sobre o que
                trava de verdade quando o time é uma pessoa só: a razão de existir, quem a marca
                serve, o que vende, quanto vale, como te acharem e onde ela vai.
              </p>
            </Reveal>

            {categorias.length > 0 && (
              <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva(null)}
                  aria-pressed={categoriaAtiva === null}
                  className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                    categoriaAtiva === null
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                  }`}
                >
                  Todos os posts
                </button>
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaAtiva(cat)}
                    aria-pressed={categoriaAtiva === cat}
                    className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                      categoriaAtiva === cat
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </Reveal>
            )}
          </div>
        </section>

        {loading ? (
          <section className="pb-[clamp(48px,6vw,72px)]">
            <div className={CONTAINER}>
              <p className="text-[var(--ink-soft)]">Carregando…</p>
            </div>
          </section>
        ) : postsFiltrados.length === 0 ? (
          <section className="pb-[clamp(48px,6vw,72px)]">
            <div className={CONTAINER}>
              <Reveal>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
                  <p className="font-semibold">
                    {posts.length === 0
                      ? "Nenhum post publicado ainda."
                      : "Nenhum post nessa categoria ainda."}
                  </p>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                    {posts.length === 0
                      ? "O primeiro texto sai em breve. Enquanto isso, dá pra conhecer a Pólia por dentro."
                      : "Vale conferir as outras categorias ou voltar pra lista completa."}
                  </p>
                </div>
              </Reveal>
            </div>
          </section>
        ) : (
          <>
            {/* DESTAQUE */}
            <section className="pb-[clamp(32px,4vw,48px)]">
              <div className={CONTAINER}>
                <Reveal>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: destaque.slug }}
                    className={`${CARTAO} grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr]`}
                  >
                    <div className="md:h-full md:min-h-[320px] [&>*]:h-full [&>img]:md:h-full">
                      <CoverBlock post={destaque} index={0} />
                    </div>
                    <div className="flex flex-col gap-3 p-[clamp(24px,3vw,40px)]">
                      {destaque.categoria && <Eyebrow>{destaque.categoria}</Eyebrow>}
                      <h2 className="max-w-[20ch] text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
                        {destaque.titulo}
                      </h2>
                      {destaque.resumo && (
                        <p className="max-w-[52ch] leading-[1.6] text-[var(--ink-soft)]">
                          {destaque.resumo}
                        </p>
                      )}
                      <p className="text-[13px] text-[var(--ink-soft)]">
                        Por Sil
                        {destaque.tempo_leitura
                          ? ` · ${destaque.tempo_leitura} min de leitura`
                          : ""}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[15px] font-semibold">
                        Ler o texto
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              </div>
            </section>

            {/* GRADE */}
            {resto.length > 0 && (
              <section className="pb-[clamp(48px,6vw,72px)]">
                <div className={CONTAINER}>
                  <Reveal>
                    <Eyebrow>Mais textos</Eyebrow>
                  </Reveal>
                  <RevealGroup className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                    {resto.map((post, i) => (
                      <RevealItem key={post.id} className="h-full">
                        <Link
                          to="/blog/$slug"
                          params={{ slug: post.slug }}
                          className={`${CARTAO} flex h-full flex-col`}
                        >
                          <CoverBlock post={post} index={i + 1} />
                          <div className="flex flex-1 flex-col gap-2 p-6">
                            {post.categoria && <Eyebrow>{post.categoria}</Eyebrow>}
                            <h3 className="text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-balance">
                              {post.titulo}
                            </h3>
                            {post.resumo && (
                              <p className="text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                                {post.resumo}
                              </p>
                            )}
                            <p className="text-[13px] text-[var(--ink-soft)]">
                              Por Sil{post.tempo_leitura ? ` · ${post.tempo_leitura} min` : ""}
                            </p>
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
          </>
        )}

        {/* CAPTURA */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-pink)] p-[clamp(28px,4vw,56px)]">
                <Eyebrow>Pólia</Eyebrow>
                <h2 className="mt-4 max-w-[22ch] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  A Pólia é isso na prática.
                </h2>
                <p className="mt-4 max-w-[52ch] leading-[1.6] text-[var(--ink-soft)]">
                  Uma marca construída com clareza, decisão por decisão. Dá pra começar agora, sem
                  cartão.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/" hash="planos" className={BTN_PRIMARIO}>
                    Criar conta grátis
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
