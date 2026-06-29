import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { LayoutGrid, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planner/")({
  head: () => ({
    meta: [
      { title: "Quadros · Pólia" },
      { name: "description", content: "Quadros pra organizar projetos do seu jeito." },
    ],
  }),
  component: PlannerIndex,
});

interface Quadro {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "quadro"
  );
}

function PlannerIndex() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const quadrosQuery = useQuery({
    queryKey: ["quadros", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadros")
        .select("id, nome, slug, ordem")
        .eq("user_id", userId!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as Quadro[];
    },
  });

  const contagemQuery = useQuery({
    queryKey: ["quadros-contagem", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("quadro_id")
        .eq("user_id", userId!)
        .not("quadro_id", "is", null);
      const m = new Map<string, number>();
      for (const t of data ?? []) {
        if (t.quadro_id) m.set(t.quadro_id, (m.get(t.quadro_id) ?? 0) + 1);
      }
      return m;
    },
  });

  const quadros = quadrosQuery.data ?? [];
  const contagem = useMemo(
    () => contagemQuery.data ?? new Map<string, number>(),
    [contagemQuery.data],
  );

  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);

  const criar = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) return null;
      const existentes = new Set(quadros.map((q) => q.slug));
      let slug = slugify(nome);
      let n = 2;
      while (existentes.has(slug)) {
        slug = `${slugify(nome)}-${n++}`;
      }
      const { data } = await supabase
        .from("quadros")
        .insert({ user_id: userId!, nome, slug, ordem: quadros.length })
        .select("slug")
        .single();
      return data?.slug ?? null;
    },
    onSuccess: (slug) => {
      setNovoNome("");
      setCriando(false);
      qc.invalidateQueries({ queryKey: ["quadros", userId] });
      if (slug) navigate({ to: "/planner/$slug", params: { slug } });
    },
  });

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/planner" />

      <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
              Quadros
            </h1>
            <p className="caveat-decorativo text-[#C96B3E]">
              organize projetos do seu jeito, fora da jornada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCriando((v) => !v)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-polia-terracota px-4 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D]"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Novo quadro</span>
          </button>
        </div>

        {criando && (
          <section className="mb-8 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoNome.trim()) criar.mutate();
                }}
                maxLength={60}
                placeholder="Ex: Lançamento de inverno · Feira de artesanato · Conteúdo do mês"
                className="h-[46px] min-w-[220px] flex-1 rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => criar.mutate()}
                disabled={!novoNome.trim() || criar.isPending}
                className="h-[46px] rounded-xl bg-polia-terracota px-5 font-sans text-[14px] font-semibold text-polia-creme hover:bg-[#B85A2D] disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </section>
        )}

        {quadrosQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-white/60" />
            ))}
          </div>
        ) : quadros.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
              <LayoutGrid size={26} className="text-polia-terracota" />
            </div>
            <p className="mb-1.5 font-serif text-[20px] text-[#1A1A2E]">Nenhum quadro ainda</p>
            <p className="mx-auto max-w-[400px] font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
              Quadros são pra projetos que têm vida própria — um lançamento, um evento, uma
              campanha. Suas tarefas da jornada continuam em{" "}
              <a href="/tarefas" className="text-[#C96B3E] hover:underline">
                Tarefas
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quadros.map((q) => (
              <a
                key={q.id}
                href={`/planner/${q.slug}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-polia-terracota/30 hover:shadow-[0_6px_16px_rgba(58,42,31,0.06)]"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(201,107,62,0.1)] text-polia-terracota">
                    <LayoutGrid size={20} />
                  </span>
                  <div>
                    <p className="font-serif text-[18px] text-[#1A1A2E]">{q.nome}</p>
                    <p className="font-sans text-[13px] text-[#1A1A2E] opacity-50">
                      {(() => {
                        const n = contagem.get(q.id) ?? 0;
                        return n === 0 ? "vazio" : `${n} ${n === 1 ? "cartão" : "cartões"}`;
                      })()}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-[#1A1A2E] opacity-25 transition-opacity group-hover:opacity-60"
                />
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
