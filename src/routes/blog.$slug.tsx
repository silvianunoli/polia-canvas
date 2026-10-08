import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { renderBlogMarkdown } from "@/lib/blogRenderMarkdown";
import { linkCanonico, urlCanonica, HOST_CANONICO } from "@/lib/seo";
import { jsonLdBlogPosting, jsonLdBreadcrumb, tagJsonLd } from "@/lib/jsonld";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CONTAINER, SECAO, BTN_PRIMARIO } from "@/components/site/Editorial";
import { Rotulo } from "@/components/landing/BlocosLanding";
import {
  AssinaturaSil,
  ChamadaBlog,
  SumarioPosts,
  TituloSecaoBlog,
} from "@/components/site/BlogBlocos";
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
  | "updated_at"
>;

type RelatedPost = Pick<
  Tables<"blog_posts">,
  "id" | "slug" | "titulo" | "categoria" | "capa_url" | "tempo_leitura" | "publicado_em"
>;

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
  "[&_blockquote]:my-10 [&_blockquote]:rounded-xl [&_blockquote]:bg-[var(--surface)] [&_blockquote]:px-6 [&_blockquote]:py-5",
  "[&_blockquote_p]:text-[clamp(1.25rem,2.2vw,1.6rem)] [&_blockquote_p]:font-medium [&_blockquote_p]:leading-[1.3] [&_blockquote_p]:text-[var(--ink)]",
  "[&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-[var(--line)]",
  "[&_hr]:my-10 [&_hr]:h-px [&_hr]:border-0 [&_hr]:bg-[var(--line)]",
  "[&_code]:rounded-md [&_code]:bg-[var(--surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px] [&_code]:text-[var(--ink)]",
  "[&_.blog-embed]:overflow-hidden [&_.blog-embed]:rounded-2xl [&_.blog-embed]:border [&_.blog-embed]:border-[var(--line)]",
  "[&_.blog-embed_iframe]:aspect-video [&_.blog-embed_iframe]:w-full [&_.blog-embed_iframe]:border-0",
].join(" ");

// Sem resumo cadastrado a description caía em "Pólia blog." e o og:description
// em string vazia: o link circulava no WhatsApp sem nada que fizesse clicar.
const DESCRICAO_PADRAO =
  "Texto de quem toca o próprio negócio sobre as decisões que dá pra tomar com mais clareza.";
const TITULO_PADRAO = "Blog da Pólia · Preço, marca e o que sobra no fim do mês";

/** Tela curta de aviso do blog, com as saídas que o estado de erro não tinha. */
function BlogAviso({ titulo, corpo, acao }: { titulo: string; corpo: string; acao?: ReactNode }) {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo" className={SECAO}>
        <div className={CONTAINER}>
          <div className="border-t border-[var(--line)] pt-8">
            <p className="text-[20px] font-bold tracking-[-0.02em]">{titulo}</p>
            <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--ink-soft)]">
              {corpo}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {/* Quem chegou por link quebrado quer outro texto, não um plano. */}
              {acao ?? (
                <Link to="/blog" className={BTN_PRIMARIO}>
                  Ver todos os textos
                </Link>
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
        "id, slug, titulo, resumo, categoria, conteudo_md, capa_url, publicado_em, tempo_leitura, updated_at",
      )
      .eq("slug", params.slug)
      .eq("publicado", true)
      .maybeSingle<PostRow>();
    if (!post) throw notFound();

    // Pega os 9 mais recentes e põe os da mesma categoria na frente: com poucos
    // textos no ar, filtrar só pela categoria deixaria a lista vazia.
    const { data: recentes } = await supabase
      .from("blog_posts")
      .select("id, slug, titulo, categoria, capa_url, tempo_leitura, publicado_em")
      .eq("publicado", true)
      .neq("id", post.id)
      .order("publicado_em", { ascending: false })
      .limit(9);
    const lista = (recentes as RelatedPost[] | null) ?? [];
    const related = [
      ...lista.filter((r) => r.categoria === post.categoria),
      ...lista.filter((r) => r.categoria !== post.categoria),
    ].slice(0, 3);

    return { post, related };
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post;
    const urlPost = urlCanonica(`/blog/${params.slug}`);

    return {
      meta: [
        { title: post?.titulo ? `${post.titulo} · Blog da Pólia` : TITULO_PADRAO },
        { name: "description", content: post?.resumo || DESCRICAO_PADRAO },
        { property: "og:title", content: post?.titulo ?? TITULO_PADRAO },
        { property: "og:description", content: post?.resumo || DESCRICAO_PADRAO },
        ...(post?.capa_url ? [{ property: "og:image", content: post.capa_url }] : []),
      ],
      links: [linkCanonico(`/blog/${params.slug}`)],
      // Só emite BlogPosting/BreadcrumbList quando o post existe de verdade
      // (loader resolvido): página de erro/pendente não descreve artigo nenhum.
      scripts: post
        ? [
            tagJsonLd(
              jsonLdBlogPosting({
                titulo: post.titulo,
                descricao: post.resumo || DESCRICAO_PADRAO,
                urlCanonica: urlPost,
                imagem: post.capa_url,
                publicadoEm: post.publicado_em,
                atualizadoEm: post.updated_at,
              }),
            ),
            tagJsonLd(
              jsonLdBreadcrumb([
                { nome: "Início", url: HOST_CANONICO },
                { nome: "Blog", url: urlCanonica("/blog") },
                { nome: post.titulo, url: urlPost },
              ]),
            ),
          ]
        : [],
    };
  },
  component: BlogPost,
  // A rota lançava notFound() sem nenhum destes três: link quebrado, falha de
  // rede e a espera do loader caíam todos numa tela em branco.
  notFoundComponent: () => (
    <BlogAviso
      titulo="Esse texto não está aqui."
      corpo="Ou o link veio quebrado, ou o texto saiu do ar."
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
      <main id="conteudo" className={SECAO}>
        <div className={CONTAINER}>
          <p className="text-[var(--ink-soft)]">Abrindo o texto…</p>
        </div>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  ),
});

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

      <main id="conteudo">
        {/* Topo sem Reveal: título, resumo e assinatura chegam visíveis no HTML do
            servidor (antes o resumo só aparecia depois da animação). */}
        <article className="pb-[clamp(48px,6vw,72px)] pt-[clamp(32px,5vw,64px)]">
          <div className={`${CONTAINER} max-w-[68ch]`}>
            <Link
              to="/blog"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-[var(--secondary-text)] no-underline hover:underline"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar pro blog
            </Link>

            <div className="mt-6">
              <Rotulo>{post.categoria ?? "Blog da Pólia"}</Rotulo>
              <h1 className="mt-4 text-[clamp(2.1rem,4.6vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
                {post.titulo}
              </h1>
              {post.resumo && (
                <p className="mt-5 text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                  {post.resumo}
                </p>
              )}

              <div className="mt-8">
                <AssinaturaSil>
                  <p className="font-semibold">Sil</p>
                  <p className="text-[14px] text-[var(--ink-soft)]">
                    {dataPublicada}
                    {dataPublicada && post.tempo_leitura ? " · " : ""}
                    {post.tempo_leitura ? `${post.tempo_leitura} min de leitura` : ""}
                  </p>
                </AssinaturaSil>
              </div>
            </div>
          </div>

          {/* Capa só quando é foto de verdade. Sem capa, o texto começa direto:
              o bloco colorido vazio que ficava aqui ocupava quase uma tela. */}
          {post.capa_url ? (
            <div className={`${CONTAINER} max-w-[68ch]`}>
              <img
                src={post.capa_url}
                alt=""
                aria-hidden="true"
                className="mt-[clamp(32px,5vw,56px)] aspect-[16/7] w-full rounded-xl object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>
          ) : null}

          <div className={`${CONTAINER} mt-[clamp(32px,5vw,56px)] max-w-[68ch]`}>
            {/* Corpo editorial assinado: renderizado como veio do CMS. */}
            <div className={PROSA} dangerouslySetInnerHTML={{ __html: html }} />

            <hr className="my-[clamp(40px,5vw,56px)] h-px border-0 bg-[var(--line)]" />

            <AssinaturaSil tamanho={64}>
              <p className="font-semibold">Sil, fundadora da Pólia</p>
              <p className="mt-1 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                Foram oito anos tocando marca própria, da papelaria ao caderno feito à mão, antes de
                entender quanto daquilo era lucro. A Pólia One nasceu dessa conta.
              </p>
              <Link
                to="/sobre"
                className="mt-1 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Ler a história inteira
              </Link>
            </AssinaturaSil>
          </div>
        </article>

        <ChamadaBlog categoria={post.categoria} />

        {related.length > 0 && (
          <section className={SECAO}>
            <div className={`${CONTAINER} max-w-[880px]`}>
              <TituloSecaoBlog>Pra continuar</TituloSecaoBlog>
              <div className="mt-4">
                <SumarioPosts posts={related} resumo={false} />
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
