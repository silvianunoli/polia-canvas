import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_public/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", params.slug)
      .eq("publicado", true)
      .maybeSingle();
    if (!data) throw notFound();
    return { post: data };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.post.titulo ?? "Post"} · Pólia` },
      { name: "description", content: loaderData?.post.resumo ?? "Pólia blog." },
      { property: "og:title", content: loaderData?.post.titulo ?? "Pólia" },
      { property: "og:description", content: loaderData?.post.resumo ?? "" },
    ],
  }),
  component: BlogPost,
});

function BlogPost() {
  const { post } = Route.useLoaderData();
  const html = marked.parse(post.conteudo_md ?? "", { async: false }) as string;

  return (
    <article className="bg-[#FDF8F5]">
      <header className="bg-[#1A1A2E] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Link to="/blog" className="font-sans text-[#E89770] text-[14px] hover:underline">
            ← Blog
          </Link>
          {post.categoria && (
            <p className="font-sans font-semibold text-[#E89770] text-[11px] uppercase tracking-[0.18em] mt-6 mb-3">
              {post.categoria}
            </p>
          )}
          <h1 className="font-serif text-[#FDF8F5] text-[36px] md:text-[52px] leading-tight mb-6">
            {post.titulo}
          </h1>
          {post.publicado_em && (
            <p className="font-sans text-[#FDF8F5]/50 text-[13px]">
              {new Date(post.publicado_em).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div
          className="prose prose-lg max-w-none font-sans text-[#1A1A2E] [&_h2]:font-serif [&_h2]:text-[28px] [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:font-serif [&_h3]:text-[22px] [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:text-[17px] [&_p]:leading-relaxed [&_p]:mb-5 [&_a]:text-[#C96B3E] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_li]:mb-2 [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-20 bg-[#1A1A2E] rounded-2xl p-10 text-center">
          <h2 className="font-serif text-[#FDF8F5] text-[28px] mb-4">
            Pronta pra dar o próximo passo?
          </h2>
          <p className="font-sans text-[#FDF8F5]/70 text-[15px] mb-6 max-w-md mx-auto">
            A Pólia transforma o que você leu aqui em estrutura real pra o seu negócio.
          </p>
          <Link to="/lista-de-espera" className="inline-block bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] px-7 py-4 rounded-xl hover:bg-[#B85A2D] transition-colors">
            Entrar na lista de espera
          </Link>
        </div>
      </div>
    </article>
  );
}
