import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PainelNav } from "@/components/painel/PainelNav";
import { LayoutGrid, Plus, ArrowRight, Lock } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { COTAS_CONFERE } from "@/lib/planos";

export const Route = createFileRoute("/_authenticated/planner/")({
  head: () => ({
    meta: [
      { title: "Planner · Pólia" },
      { name: "description", content: "Planner pra organizar os seus projetos sem se perder." },
    ],
  }),
  component: PlannerIndex,
});

interface Quadro {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  created_at: string;
}

// Mesma ordem de colunas do quadro kanban (planner.$slug.tsx), usada só pra
// desenhar a barrinha de distribuição — não é a fonte de verdade dos status.
const ORDEM_STATUS = [
  "ideias",
  "planejado",
  "hoje",
  "em_progresso",
  "pausado",
  "concluido",
] as const;

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
  const meta = useUserMeta();
  const ehConfere = meta.plano === "confere";

  const quadrosQuery = useQuery({
    queryKey: ["quadros", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadros")
        .select("id, nome, slug, ordem, created_at")
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
        .select("quadro_id, status")
        .eq("user_id", userId!)
        .not("quadro_id", "is", null);
      const m = new Map<string, number>();
      const porStatus = new Map<string, Map<string, number>>();
      for (const t of data ?? []) {
        if (!t.quadro_id) continue;
        m.set(t.quadro_id, (m.get(t.quadro_id) ?? 0) + 1);
        const status =
          t.status && ORDEM_STATUS.includes(t.status as (typeof ORDEM_STATUS)[number])
            ? t.status
            : "ideias";
        if (!porStatus.has(t.quadro_id)) porStatus.set(t.quadro_id, new Map());
        const statusMap = porStatus.get(t.quadro_id)!;
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
      }
      return { total: m, porStatus };
    },
  });

  const quadros = quadrosQuery.data ?? [];
  const contagem = useMemo(
    () => contagemQuery.data?.total ?? new Map<string, number>(),
    [contagemQuery.data],
  );
  const distribuicao = useMemo(
    () => contagemQuery.data?.porStatus ?? new Map<string, Map<string, number>>(),
    [contagemQuery.data],
  );

  // Cota do Confere: 1 quadro. O(s) mais antigo(s) por created_at ficam
  // dentro da cota; o excedente (de um downgrade, por ex.) fica marcado como
  // somente-leitura — mesma regra que a trigger do banco aplica na tabela
  // quadros (migração 20260727130000).
  const idsExcedentes = useMemo(() => {
    if (!ehConfere) return new Set<string>();
    const porCriacao = [...quadros].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return new Set(porCriacao.slice(COTAS_CONFERE.planner).map((q) => q.id));
  }, [ehConfere, quadros]);
  const cotaAtingida = ehConfere && quadros.length >= COTAS_CONFERE.planner;

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
      const { data, error } = await supabase
        .from("quadros")
        .insert({ user_id: userId!, nome, slug, ordem: quadros.length })
        .select("slug")
        .single();
      if (error) throw error;
      return data?.slug ?? null;
    },
    onSuccess: (slug) => {
      track("planner_quadro_criado");
      setNovoNome("");
      setCriando(false);
      qc.invalidateQueries({ queryKey: ["quadros", userId] });
      if (slug) navigate({ to: "/planner/$slug", params: { slug } });
    },
    onError: () => {
      toastErro("Não consegui criar o quadro agora. Tenta de novo.");
    },
  });

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav navActive="/planner" />

      <div className="mx-auto max-w-[900px] px-6 py-12 md:px-10">
        <div className="flex items-start justify-between gap-4">
          <header>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Planner
            </p>
            <h1 className="font-cabinet mt-1 text-[clamp(28px,5vw,42px)] leading-[1.08] text-[var(--ink)]">
              Planner
            </h1>
            <p className="mt-1 italic text-[var(--ink-soft)]">
              organize os seus projetos como quiser, fora do planejamento.
            </p>
          </header>
          <button
            type="button"
            onClick={() => setCriando((v) => !v)}
            disabled={cotaAtingida}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Novo quadro</span>
          </button>
        </div>

        {cotaAtingida && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
            No Confere você tem 1 quadro. Suba pro Controle pra deixar ilimitado.{" "}
            <Link
              to="/upgrade"
              search={{ rota: "/planner", tier: "controle" }}
              className="font-medium text-[var(--secondary-text)] no-underline"
            >
              Assinar o Controle
            </Link>
          </div>
        )}

        {criando && (
          <section className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5">
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
                className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => criar.mutate()}
                disabled={!novoNome.trim() || criar.isPending}
                className="rounded-xl bg-[var(--secondary)] px-5 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </section>
        )}

        {quadrosQuery.isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        ) : quadros.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--secondary-light)] text-[var(--secondary-text)]">
              <LayoutGrid size={24} aria-hidden="true" />
            </div>
            <p className="text-[20px] text-[var(--ink)]">Nenhum quadro ainda</p>
            <p className="mx-auto mt-1.5 max-w-[400px] text-[14px] leading-relaxed text-[var(--muted)]">
              Quadros são pra projetos que têm vida própria · um lançamento, um evento, uma
              campanha.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quadros.map((q) => {
              const statusMap = distribuicao.get(q.id);
              const valores = ORDEM_STATUS.map((s) => statusMap?.get(s) ?? 0);
              const maior = Math.max(1, ...valores);
              const temCartoes = (contagem.get(q.id) ?? 0) > 0;
              return (
                <a
                  key={q.id}
                  href={`/planner/${q.slug}`}
                  className="group flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-white p-5 transition-colors hover:border-[var(--secondary)] hover:bg-[var(--secondary-light)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary-light)] text-[var(--secondary-text)]">
                        <LayoutGrid size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="flex items-center gap-1.5 text-[18px] text-[var(--ink)]">
                          {q.nome}
                          {idsExcedentes.has(q.id) && (
                            <Lock size={13} className="text-[var(--muted)]" aria-hidden="true" />
                          )}
                        </p>
                        <p className="text-[13px] text-[var(--muted)]">
                          {idsExcedentes.has(q.id)
                            ? "somente leitura · acima da cota do Confere"
                            : (() => {
                                const n = contagem.get(q.id) ?? 0;
                                return n === 0 ? "vazio" : `${n} ${n === 1 ? "cartão" : "cartões"}`;
                              })()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--secondary-text)]"
                    />
                  </div>
                  {temCartoes && (
                    <div className="flex h-7 items-end gap-1" aria-hidden="true">
                      {valores.map((v, i) => (
                        <i
                          key={ORDEM_STATUS[i]}
                          className="block w-2.5 rounded-t-[2px] bg-[var(--accent)]"
                          style={{ height: `${Math.max(12, (v / maior) * 100)}%` }}
                        />
                      ))}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
