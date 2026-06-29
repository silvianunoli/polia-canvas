import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_public/blog/")({
  head: () => ({
    meta: [
      { title: "Blog · Pólia" },
      { name: "description", content: "Ideias pra quem constrói com as próprias mãos." },
      { property: "og:title", content: "Blog · Pólia" },
      {
        property: "og:description",
        content: "Identidade, vendas, precificação, conteúdo e gestão.",
      },
    ],
  }),
  component: BlogList,
});

type Post = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  categoria: string | null;
  publicado_em: string | null;
};

const TAGS = ["Todos", "Identidade", "Vendas", "Precificação", "Conteúdo", "Gestão"];

function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filtro, setFiltro] = useState("Todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, titulo, resumo, categoria, publicado_em")
        .eq("publicado", true)
        .order("publicado_em", { ascending: false });
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtrados = filtro === "Todos" ? posts : posts.filter((p) => p.categoria === filtro);

  return (
    <>
      <section className="bg-[#1A1A2E] py-24 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Blog
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[56px] leading-tight">
            Ideias pra quem constrói com as próprias mãos.
          </h1>
        </div>
      </section>

      <section className="bg-[#FDF8F5] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap gap-2 mb-12 justify-center">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setFiltro(tag)}
                className={`font-sans text-[13px] px-4 py-2 rounded-full transition-colors ${
                  filtro === tag
                    ? "bg-[#C96B3E] text-[#FDF8F5]"
                    : "bg-white border border-[#1A1A2E]/15 text-[#1A1A2E]/70 hover:border-[#C96B3E]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center font-sans text-[#1A1A2E]/50">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-center font-sans text-[#1A1A2E]/50">Nenhum post publicado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtrados.map((post) => (
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  key={post.id}
                  className="group bg-white rounded-2xl overflow-hidden border border-[#1A1A2E]/8 hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-video bg-gradient-to-br from-[#C96B3E]/15 to-[#C9407A]/15 flex items-center justify-center">
                    <p className="caveat-informacional text-[#C96B3E]">
                      {post.categoria ?? "Pólia"}
                    </p>
                  </div>
                  <div className="p-6">
                    {post.categoria && (
                      <p className="font-sans font-semibold text-[#C96B3E] text-[11px] uppercase tracking-wider mb-2">
                        {post.categoria}
                      </p>
                    )}
                    <h3 className="font-serif text-[#1A1A2E] text-[22px] leading-tight mb-3 group-hover:text-[#C96B3E] transition-colors">
                      {post.titulo}
                    </h3>
                    {post.resumo && (
                      <p className="font-sans text-[#1A1A2E]/65 text-[14px] leading-relaxed">
                        {post.resumo}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
