import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/cms")({
  component: AdminCms,
});

function AdminCms() {
  const [tab, setTab] = useState<"blog" | "espera">("blog");
  const [posts, setPosts] = useState<any[]>([]);
  const [espera, setEspera] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
      setPosts(p ?? []);
      const { data: e } = await supabase.from("lista_espera").select("*").order("criado_em", { ascending: false });
      setEspera(e ?? []);
    })();
  }, []);

  const togglePublicar = async (post: any) => {
    const novo = !post.publicado;
    await supabase
      .from("blog_posts")
      .update({ publicado: novo, publicado_em: novo ? new Date().toISOString() : null })
      .eq("id", post.id);
    setPosts((arr) => arr.map((x) => (x.id === post.id ? { ...x, publicado: novo } : x)));
  };

  const exportarCsv = () => {
    const linhas = [["nome", "email", "tipo_negocio", "data"]];
    espera.forEach((e) => linhas.push([e.nome, e.email, e.tipo_negocio ?? "", e.criado_em]));
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-espera.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">CMS</h1>
      <div className="flex gap-2 mb-8">
        {[
          { key: "blog", label: "Blog" },
          { key: "espera", label: "Lista de espera" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`font-mono text-[10px] tracking-[1.5px] uppercase px-5 py-2 rounded-full transition-all ${
              tab === t.key ? "bg-[#1A1A2E] text-[#FDF8F5]" : "border border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "blog" && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50">Nenhum post ainda. Crie um pelo SQL Editor por enquanto.</p>
          )}
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)] flex items-center justify-between">
              <div>
                <p className="font-sans text-[#1A1A2E] text-[14px] font-medium">{post.titulo}</p>
                <p className="font-sans text-[#1A1A2E] text-[12px] opacity-40">
                  {post.categoria ?? "sem categoria"} ·{" "}
                  {post.publicado ? `publicado em ${new Date(post.publicado_em).toLocaleDateString("pt-BR")}` : "rascunho"}
                </p>
              </div>
              <button
                onClick={() => togglePublicar(post)}
                className={`font-mono text-[9px] tracking-[1px] uppercase px-3 py-1 rounded-full ${
                  post.publicado ? "bg-[rgba(44,106,79,0.1)] text-[#2D6A4F]" : "bg-[rgba(26,26,46,0.06)] text-[#1A1A2E] opacity-50"
                }`}
              >
                {post.publicado ? "Publicado" : "Rascunho"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "espera" && (
        <>
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-serif text-[#1A1A2E] text-[28px]">{espera.length} na lista</h2>
            <button
              onClick={exportarCsv}
              className="font-sans text-[#C96B3E] text-[14px] border border-[rgba(201,107,62,0.3)] rounded-xl px-5 py-2 hover:bg-[rgba(201,107,62,0.06)] transition-colors"
            >
              Exportar CSV
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[rgba(26,26,46,0.06)]">
                  {["Nome", "Email", "Tipo de negócio", "Data"].map((h) => (
                    <th key={h} className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 px-5 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {espera.map((item) => (
                  <tr key={item.id} className="border-b border-[rgba(26,26,46,0.04)]">
                    <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">{item.nome}</td>
                    <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-60">{item.email}</td>
                    <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-60">{item.tipo_negocio ?? "—"}</td>
                    <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[12px] opacity-40">
                      {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
