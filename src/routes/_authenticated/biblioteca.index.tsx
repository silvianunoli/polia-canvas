import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { SidebarAside } from "@/components/layout/SidebarAside";
import { CadernoCard } from "@/components/caderno/CadernoCard";
import { getMarginalia } from "@/lib/marginaliaText";

export const Route = createFileRoute("/_authenticated/biblioteca/")({
  head: () => ({
    meta: [
      { title: "Seus entregáveis · Pólia" },
      { name: "description", content: "Tudo que você construiu fica aqui." },
    ],
  }),
  component: BibliotecaPage,
});

type Fase = "Todos" | "Sonho" | "Construção" | "Venda" | "Evolução";
const FASES: Fase[] = ["Todos", "Sonho", "Construção", "Venda", "Evolução"];

interface Entregavel {
  id: string;
  titulo: string;
  tipo: string;
  fase: string;
  etapa: number;
  conteudo: Record<string, unknown> | null;
  created_at: string;
}

function badgeFase(fase: string): string {
  const f = (fase || "").toLowerCase();
  if (f.includes("sonho"))
    return "bg-[rgba(201,64,122,0.12)] text-[#C9407A] border border-[rgba(201,64,122,0.3)]";
  if (f.includes("constru"))
    return "bg-[rgba(26,127,173,0.12)] text-[#1A7FAD] border border-[rgba(26,127,173,0.3)]";
  if (f.includes("venda"))
    return "bg-[rgba(26,143,92,0.12)] text-[#1A8F5C] border border-[rgba(26,143,92,0.3)]";
  if (f.includes("evolu"))
    return "bg-[rgba(107,80,204,0.12)] text-[#6B50CC] border border-[rgba(107,80,204,0.3)]";
  return "bg-[rgba(26,26,46,0.06)] text-[#1A1A2E] border border-[rgba(26,26,46,0.12)]";
}

function badgeAtivo(fase: Fase): string {
  switch (fase) {
    case "Todos":
      return "bg-polia-terracota text-polia-creme border-polia-terracota";
    case "Sonho":
      return "bg-[rgba(201,64,122,0.12)] text-[#C9407A] border-[rgba(201,64,122,0.3)]";
    case "Construção":
      return "bg-[rgba(26,127,173,0.12)] text-[#1A7FAD] border-[rgba(26,127,173,0.3)]";
    case "Venda":
      return "bg-[rgba(26,143,92,0.12)] text-[#1A8F5C] border-[rgba(26,143,92,0.3)]";
    case "Evolução":
      return "bg-[rgba(107,80,204,0.12)] text-[#6B50CC] border-[rgba(107,80,204,0.3)]";
  }
}

function normalizarFase(fase: string): Fase | null {
  const f = (fase || "").toLowerCase();
  if (f.includes("sonho")) return "Sonho";
  if (f.includes("constru")) return "Construção";
  if (f.includes("venda")) return "Venda";
  if (f.includes("evolu")) return "Evolução";
  return null;
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function extrairPreview(conteudo: Record<string, unknown> | null): string {
  if (!conteudo) return "";
  for (const v of Object.values(conteudo)) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.length > 100 ? v.slice(0, 100) + "..." : v;
    }
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === "string") {
        return first.length > 100 ? first.slice(0, 100) + "..." : first;
      }
      if (first && typeof first === "object") {
        const inner = Object.values(first as Record<string, unknown>).find(
          (x) => typeof x === "string",
        );
        if (typeof inner === "string") {
          return inner.length > 100 ? inner.slice(0, 100) + "..." : inner;
        }
      }
    }
  }
  return "";
}

function BibliotecaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();
  const [faseAtiva, setFaseAtiva] = useState<Fase>("Todos");

  const dadosQuery = useQuery({
    queryKey: ["biblioteca", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, entregaveisRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, business_name, streak")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("entregaveis")
          .select("id, titulo, tipo, fase, etapa, conteudo, created_at")
          .eq("user_id", userId!)
          .eq("status", "concluido")
          .order("created_at", { ascending: false }),
      ]);
      return {
        profile: profileRes.data,
        entregaveis: (entregaveisRes.data ?? []) as Entregavel[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];

  const entregaveisFiltrados = useMemo(() => {
    if (faseAtiva === "Todos") return entregaveis;
    return entregaveis.filter((e) => normalizarFase(e.fase) === faseAtiva);
  }, [entregaveis, faseAtiva]);

  const initial =
    (profile?.full_name?.trim()?.[0] ||
      profile?.business_name?.trim()?.[0] ||
      "P").toUpperCase();
  const streak = profile?.streak ?? 0;
  const total = entregaveis.length;

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} navActive="/biblioteca" />

      <main className="mx-auto max-w-[1280px] px-6 pt-8 pb-12 md:px-12 md:pt-10 md:pb-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-8">
              <h1 className="font-serif text-[#1A1A2E] text-[28px] leading-tight mb-2 md:text-[44px]">
                Seus entregáveis.
              </h1>
              <p className="caveat-decorativo text-[#C96B3E]">
                tudo que você construiu fica aqui. com você.
              </p>
              <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40 mt-2">
                {total} {total === 1 ? "entregável" : "entregáveis"} criados
              </p>
            </div>

            <div className="flex gap-2 mb-8 flex-wrap">
              {FASES.map((fase) => (
                <button
                  key={fase}
                  onClick={() => setFaseAtiva(fase)}
                  className={`font-sans text-[13px] px-4 py-2 rounded-xl border transition-colors cursor-pointer ${
                    faseAtiva === fase
                      ? badgeAtivo(fase)
                      : "bg-white text-[#1A1A2E] opacity-50 border-[rgba(26,26,46,0.08)] hover:opacity-80"
                  }`}
                >
                  {fase}
                </button>
              ))}
            </div>

            {dadosQuery.isLoading ? (
              <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40">
                Carregando...
              </p>
            ) : total === 0 ? (
              <div className="text-center py-24 border-2 border-dashed border-[rgba(26,26,46,0.06)] rounded-2xl">
                <p className="font-serif text-[#1A1A2E] text-[24px] opacity-30 mb-3">
                  seus entregáveis aparecem aqui.
                </p>
                <p className="caveat-decorativo text-[#C96B3E] mb-6">
                  complete a Etapa 1 pra criar o primeiro.
                </p>
                <button
                  onClick={() => navigate({ to: "/etapa/1" })}
                  className="font-sans text-[#C96B3E] text-[14px] hover:underline cursor-pointer"
                >
                  Ir pra Etapa 1
                </button>
              </div>
            ) : entregaveisFiltrados.length === 0 ? (
              <div className="text-center py-16">
                <p className="caveat-decorativo text-[#1A1A2E] opacity-35">
                  nenhum entregável da fase {faseAtiva} ainda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {entregaveisFiltrados.map((entregavel) => {
                  const marginalia = getMarginalia({
                    primeiraVez: entregavel.created_at,
                    ultimaVisita: entregavel.created_at,
                    visitas: 2,
                  });
                  const seed = entregavel.id
                    .split("")
                    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
                  return (
                    <CadernoCard
                      key={entregavel.id}
                      dobrada
                      marginalia={marginalia}
                      seed={seed}
                      className="group"
                      onClick={() => navigate({ to: `/biblioteca/${entregavel.id}` })}
                    >
                      <span
                        className={`inline-block font-accent text-[9px] tracking-[1.5px] uppercase font-bold px-3 py-1 rounded-full mb-4 ${badgeFase(
                          entregavel.fase,
                        )}`}
                      >
                        {entregavel.fase} · Etapa {entregavel.etapa}
                      </span>
                      <h3 className="font-serif text-[#1A1A2E] text-[20px] mb-3 group-hover:text-[#C96B3E] transition-colors">
                        {entregavel.titulo}
                      </h3>
                      <p className="font-sans text-[#1A1A2E] text-[13px] leading-relaxed line-clamp-2 opacity-50 mb-4">
                        {extrairPreview(entregavel.conteudo)}
                      </p>
                      <div className="flex items-center justify-between pt-4 border-t border-[rgba(26,26,46,0.05)]">
                        <p className="font-sans text-[#1A1A2E] text-[11px] opacity-30">
                          {formatarData(entregavel.created_at)}
                        </p>
                        <span className="font-sans text-[#C96B3E] text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">
                          abrir
                        </span>
                      </div>
                    </CadernoCard>
                  );
                })}
              </div>
            )}
          </div>

          <SidebarAside
            label="DICA DA RAPOSA"
            caveat="filtre por fase pra revisitar marcos. cada entregável é um capítulo seu."
          >
            <p className="font-sans text-[13px] leading-relaxed text-polia-noite/70">
              {total} entregável{total === 1 ? "" : "s"} no total
              {faseAtiva !== "Todos" && (
                <>
                  <br />
                  {entregaveisFiltrados.length} na fase {faseAtiva}
                </>
              )}
            </p>
          </SidebarAside>
        </div>
      </main>
    </div>
  );
}
