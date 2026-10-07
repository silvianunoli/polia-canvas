import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { linkCanonico, urlCanonica, HOST_CANONICO } from "@/lib/seo";
import { jsonLdBreadcrumb, tagJsonLd } from "@/lib/jsonld";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { BotaoCadastro, CORPO, Rotulo, Secao } from "@/components/landing/BlocosLanding";
import { ChamadaBlog, FotoSil, ManchetePost, SumarioPosts } from "@/components/site/BlogBlocos";
import type { Tables } from "@/integrations/supabase/types";

const TITULO = "Blog da Pólia · Preço, marca e o que sobra no fim do mês";
const DESCRICAO =
  "Textos curtos pra quem vende produto ou serviço: por que a cliente compra de você, quanto cobrar, quanto sobra e o que fazer primeiro. Escritos pela Sil.";

export const Route = createFileRoute("/blog/")({
  // A busca mora no loader (e não num useEffect) pra que o HTML servido já
  // saia com os links dos posts: sem isso o Google recebia uma listagem vazia
  // e nunca chegava em /blog/$slug. O post individual já fazia assim.
  loader: async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, slug, titulo, resumo, categoria, publicado_em, capa_url, tempo_leitura")
      .eq("publicado", true)
      .order("publicado_em", { ascending: false });
    if (error) {
      console.error("blog_posts_listar", error);
      // Devolve a falha como dado em vez de lançar: a tela de erro do /blog
      // mora dentro da própria página (cabeçalho, hero e aviso), e um
      // errorComponent trocaria esse layout.
      return { posts: [] as Post[], erro: true };
    }
    return { posts: (data as Post[]) ?? [], erro: false };
  },
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/blog")],
    scripts: [
      tagJsonLd(
        jsonLdBreadcrumb([
          { nome: "Início", url: HOST_CANONICO },
          { nome: "Blog", url: urlCanonica("/blog") },
        ]),
      ),
    ],
  }),
  component: BlogList,
});

type Post = Pick<
  Tables<"blog_posts">,
  "id" | "slug" | "titulo" | "resumo" | "categoria" | "publicado_em" | "capa_url" | "tempo_leitura"
>;

// Copy e layout de 07/10/2026 (COPY-BLOG-POLIA-ONE.md): sumário de revista no
// lugar da grade de cards. Sem capa não aparece bloco colorido vazio; o título
// grande faz o papel da imagem.

const FILTRO =
  "min-h-[44px] rounded-full border px-4 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";
const FILTRO_ATIVO = "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]";
const FILTRO_INATIVO =
  "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]";

function Aviso({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Reveal>
      <div className="border-t border-[var(--line)] py-8">
        <p className="text-[20px] font-bold tracking-[-0.02em] text-[var(--ink)]">{titulo}</p>
        {children}
      </div>
    </Reveal>
  );
}

function BlogList() {
  // Sem o "erro", falha de rede caía no mesmo estado vazio e ficava
  // indistinguível de um blog realmente sem post.
  const { posts, erro } = Route.useLoaderData();
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);

  const categorias = useMemo(
    () => [...new Set(posts.map((p) => p.categoria).filter((c): c is string => !!c))],
    [posts],
  );

  const postsFiltrados = categoriaAtiva
    ? posts.filter((p) => p.categoria === categoriaAtiva)
    : posts;

  const [manchete, ...resto] = postsFiltrados;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main id="conteudo">
        {/* HERO: h1 e texto fora do Reveal, visíveis no HTML do servidor. */}
        <Secao className="!pb-[clamp(32px,4vw,48px)] !pt-[clamp(40px,5vw,64px)]">
          <div className="grid grid-cols-1 items-end gap-x-[clamp(32px,5vw,64px)] gap-y-8 md:grid-cols-[8fr_3fr]">
            <div>
              <Rotulo>Blog da Pólia</Rotulo>
              <h1 className="mt-4 max-w-[20ch] text-[clamp(32px,4.4vw,56px)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                O que ninguém explica sobre cobrar pela própria marca.
              </h1>
              <p className={`mt-6 ${CORPO}`}>
                Textos curtos sobre as decisões do dia a dia de quem vende:{" "}
                <b className="font-semibold text-[var(--ink)]">por que a cliente compra de você</b>,
                quanto cobrar, quanto sobra e o que fazer primeiro. Escritos pela Sil, que passou
                oito anos fazendo essa conta no próprio negócio.
              </p>
            </div>
            <Link
              to="/sobre"
              className="group flex items-center gap-4 no-underline md:flex-col md:items-start"
            >
              <FotoSil tamanho={96} />
              <span>
                <span className="block font-semibold text-[var(--ink)]">Escrito pela Sil</span>
                <span className="block text-[14px] text-[var(--secondary-text)] underline decoration-1 underline-offset-4 group-hover:decoration-2">
                  fundadora da Pólia
                </span>
              </span>
            </Link>
          </div>

          {/* Filtro só faz sentido com duas categorias ou mais. */}
          {categorias.length >= 2 && (
            <div
              className="mt-10 flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por assunto"
            >
              <button
                type="button"
                onClick={() => setCategoriaAtiva(null)}
                aria-pressed={categoriaAtiva === null}
                className={`${FILTRO} ${categoriaAtiva === null ? FILTRO_ATIVO : FILTRO_INATIVO}`}
              >
                Todos
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaAtiva(cat)}
                  aria-pressed={categoriaAtiva === cat}
                  className={`${FILTRO} ${categoriaAtiva === cat ? FILTRO_ATIVO : FILTRO_INATIVO}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </Secao>

        <Secao className="!pt-0">
          {erro ? (
            <Aviso titulo="Não deu pra carregar os textos agora.">
              <p className={`mt-2 ${CORPO}`}>Recarregar a página costuma resolver.</p>
            </Aviso>
          ) : postsFiltrados.length === 0 ? (
            posts.length === 0 ? (
              <Aviso titulo="Os primeiros textos estão sendo escritos.">
                <p className={`mt-2 ${CORPO}`}>
                  Enquanto isso, a Pólia One já mostra quanto sobra em cada venda.
                </p>
                <div className="mt-6">
                  <BotaoCadastro busca={{ origem: "blog" }} contexto="blog_vazio" />
                </div>
              </Aviso>
            ) : (
              <Aviso titulo="Essa categoria ainda não tem texto.">
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva(null)}
                  className="mt-4 inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  Ver todos os textos
                </button>
              </Aviso>
            )
          ) : (
            <>
              <div className="border-t border-[var(--line)] pt-10">
                <ManchetePost post={manchete} />
              </div>
              {resto.length > 0 && (
                <div className="mt-16">
                  <Rotulo>Mais textos</Rotulo>
                  <div className="mt-4">
                    <SumarioPosts posts={resto} />
                  </div>
                </div>
              )}
            </>
          )}
        </Secao>

        <ChamadaBlog />
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
