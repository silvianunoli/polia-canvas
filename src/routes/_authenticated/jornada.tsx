import { useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { CosmicSky } from "@/components/painel/CosmicSky";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({
    meta: [
      { title: "Jornada · Pólia" },
      {
        name: "description",
        content:
          "Seu mapa completo. Cada etapa que você conclui abre um marco no território.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
  component: JornadaPage,
});

type Fase = "SONHO" | "CONSTRUÇÃO" | "VENDA" | "EVOLUÇÃO";

const ESTRELAS: { n: number; nome: string; fase: Fase }[] = [
  { n: 1, nome: "Descoberta", fase: "SONHO" },
  { n: 2, nome: "Identidade", fase: "SONHO" },
  { n: 3, nome: "Modelo", fase: "SONHO" },
  { n: 4, nome: "Presença", fase: "CONSTRUÇÃO" },
  { n: 5, nome: "Conteúdo", fase: "CONSTRUÇÃO" },
  { n: 6, nome: "Rotina", fase: "CONSTRUÇÃO" },
  { n: 7, nome: "Suas vendas", fase: "VENDA" },
  { n: 8, nome: "Seus clientes", fase: "VENDA" },
  { n: 9, nome: "Sua audiência", fase: "VENDA" },
  { n: 10, nome: "Crescimento", fase: "EVOLUÇÃO" },
  { n: 11, nome: "Sua rede", fase: "EVOLUÇÃO" },
];

const FASES: { nome: Fase; cor: string; etapas: number[] }[] = [
  { nome: "SONHO", cor: "#C9407A", etapas: [1, 2, 3] },
  { nome: "CONSTRUÇÃO", cor: "#1A7FAD", etapas: [4, 5, 6] },
  { nome: "VENDA", cor: "#1A8F5C", etapas: [7, 8, 9] },
  { nome: "EVOLUÇÃO", cor: "#6B50CC", etapas: [10, 11] },
];

const FERRAMENTAS: {
  nome: string;
  rota: string;
  desbloqueio: keyof OrbitFlags;
  tags: string;
}[] = [
  {
    nome: "Sua marca viva",
    rota: "/marca-viva",
    desbloqueio: "orbit_brand_alive_unlocked",
    tags: "identidade, voz, posicionamento",
  },
  {
    nome: "Sua vitrine",
    rota: "/vitrine",
    desbloqueio: "orbit_vitrine_active",
    tags: "presença, rotina, controle",
  },
  {
    nome: "Suas vendas e clientes",
    rota: "/clientes",
    desbloqueio: "orbit_sales_active",
    tags: "vendas, cuidado, conteúdo",
  },
  {
    nome: "Seu painel financeiro",
    rota: "/financeiro",
    desbloqueio: "orbit_financial_active",
    tags: "números, crescimento, rede",
  },
];

interface OrbitFlags {
  orbit_brand_alive_unlocked: boolean;
  orbit_vitrine_active: boolean;
  orbit_sales_active: boolean;
  orbit_financial_active: boolean;
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function previewEntregavel(conteudo: unknown): string {
  if (!conteudo) return "";
  if (typeof conteudo === "string") return conteudo;
  if (typeof conteudo === "object") {
    const obj = conteudo as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 10) return v;
    }
    return JSON.stringify(conteudo).slice(0, 200);
  }
  return "";
}

function JornadaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();
  const [expandida, setExpandida] = useState<number | null>(null);

  const dadosQuery = useQuery({
    queryKey: ["jornada", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, progressRes, entregaveisRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, star_1_completed_at, star_2_completed_at, star_3_completed_at, star_4_completed_at, star_5_completed_at, star_6_completed_at, star_7_completed_at, star_8_completed_at, star_9_completed_at, star_10_completed_at, star_11_completed_at, orbit_brand_alive_unlocked, orbit_vitrine_active, orbit_sales_active, orbit_financial_active",
          )
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("user_progress")
          .select("etapa_atual")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("entregaveis")
          .select("id, titulo, etapa, fase, tipo, conteudo, created_at")
          .eq("user_id", userId!)
          .eq("status", "concluido")
          .order("created_at", { ascending: false }),
      ]);
      return {
        profile: profileRes.data,
        progress: progressRes.data,
        entregaveis: entregaveisRes.data ?? [],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const etapaAtual = dadosQuery.data?.progress?.etapa_atual ?? 1;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];

  const completados = useMemo(() => {
    const map: Record<number, string | null> = {};
    for (let i = 1; i <= 11; i++) {
      const key = `star_${i}_completed_at` as keyof NonNullable<typeof profile>;
      map[i] = (profile?.[key] as string | null) ?? null;
    }
    return map;
  }, [profile]);

  const etapasConcluidas = Object.values(completados).filter(Boolean).length;
  const initial =
    (profile?.full_name ?? user?.user_metadata?.full_name ?? "P")
      .charAt(0)
      .toUpperCase() || "P";

  const entregavelPorEtapa = useMemo(() => {
    const m: Record<number, (typeof entregaveis)[number]> = {};
    for (const e of entregaveis) {
      if (e.etapa && !m[e.etapa]) m[e.etapa] = e;
    }
    return m;
  }, [entregaveis]);

  const handleClickEstrela = (n: number) => {
    if (completados[n]) {
      setExpandida((cur) => (cur === n ? null : n));
    } else if (etapaAtual === n) {
      navigate({ to: `/etapa/${n}` as "/etapa/1" });
    }
  };

  const fraseInferior =
    etapasConcluidas === 0
      ? "seu primeiro marco tá te esperando"
      : etapasConcluidas === 11
        ? "todos os marcos abertos. o mapa é seu."
        : `${11 - etapasConcluidas} marcos no seu horizonte`;

  const estrelaExpandida =
    expandida !== null ? ESTRELAS.find((e) => e.n === expandida) : null;
  const entregavelExpandido =
    expandida !== null ? entregavelPorEtapa[expandida] : null;

  return (
    <div className="min-h-screen bg-[#1A1A2E]">
      <PainelNav initial={initial} streak={0} navActive="/jornada" />

      <div className="relative">
        <CosmicSky density={45} />

        {/* SEÇÃO 1 — CABEÇALHO */}
        <section className="relative px-6 pb-10 pt-16 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <p className="mb-4 font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
              SEU MAPA · {etapasConcluidas} DE 11 MARCOS ABERTOS
            </p>
            <h1 className="mb-4 font-serif text-[40px] leading-[1.1] text-[#FDF8F5] md:text-[56px]">
              Seu mapa tomando forma.
            </h1>
            <p className="max-w-[560px] font-sans text-[17px] text-[#D8D2CC]">
              Cada marco aberto desenha um pedaço do seu mapa.
            </p>

            <p className="mt-8 caveat-decorativo text-[#D8D2CC]">
              {fraseInferior}
            </p>
          </div>
        </section>

        {/* SEÇÃO 2 — MAPA */}
        <section className="relative px-6 pb-16 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              {FASES.map((fase) => (
                <div key={fase.nome} className="flex flex-1 flex-col">
                  <span
                    className="mb-6 self-start rounded-full px-3 py-1 font-accent text-[10px] font-bold uppercase tracking-[2px]"
                    style={{
                      background: `${fase.cor}2E`,
                      color: fase.cor,
                    }}
                  >
                    {fase.nome}
                  </span>
                  <div className="relative flex items-start justify-around gap-4">
                    {/* Linha conectora */}
                    {fase.etapas.length > 1 && (
                      <div
                        className="pointer-events-none absolute top-[26px] left-[12%] right-[12%] h-px"
                        style={{ background: "rgba(255,255,255,0.12)" }}
                      />
                    )}
                    {fase.etapas.map((n) => {
                      const info = ESTRELAS.find((e) => e.n === n)!;
                      const concluida = !!completados[n];
                      const atual = etapaAtual === n && !concluida;
                      return (
                        <EstrelaItem
                          key={n}
                          n={n}
                          nome={info.nome}
                          concluida={concluida}
                          atual={atual}
                          onClick={() => handleClickEstrela(n)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* SEÇÃO 3 — DETALHE EXPANDIDO */}
            {estrelaExpandida && (
              <div className="mx-auto mt-12 max-w-[760px] rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 font-accent text-[10px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
                      ETAPA {estrelaExpandida.n} · {estrelaExpandida.fase}
                    </p>
                    <h3 className="font-serif text-[28px] text-[#FDF8F5]">
                      {estrelaExpandida.nome}
                    </h3>
                    <p className="mt-1 caveat-decorativo text-[#D8D2CC]">
                      concluída em{" "}
                      {completados[estrelaExpandida.n]
                        ? formatarData(completados[estrelaExpandida.n]!)
                        : ""}{" "}
                      · +50 XP
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandida(null)}
                    className="font-sans text-[14px] text-[#D8D2CC] opacity-40 transition-opacity hover:opacity-80"
                  >
                    fechar
                  </button>
                </div>

                {entregavelExpandido ? (
                  <div className="rounded-xl border border-[rgba(232,151,112,0.15)] bg-[rgba(255,255,255,0.04)] p-5">
                    <p className="mb-3 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#C96B3E]">
                      ENTREGÁVEL
                    </p>
                    <p className="mb-1 font-sans text-[16px] font-semibold text-[#FDF8F5]">
                      {entregavelExpandido.titulo}
                    </p>
                    <p className="line-clamp-3 font-sans text-[13px] leading-relaxed text-[#D8D2CC] opacity-70">
                      {previewEntregavel(entregavelExpandido.conteudo)}
                    </p>
                    <a
                      href={`/biblioteca/${entregavelExpandido.id}`}
                      className="mt-3 inline-block font-sans text-[13px] text-[#C96B3E] hover:underline"
                    >
                      Abrir entregável →
                    </a>
                  </div>
                ) : (
                  <p className="caveat-decorativo text-[#D8D2CC]">
                    nenhum entregável vinculado a essa etapa ainda.
                  </p>
                )}

                {estrelaExpandida.n === etapaAtual - 1 && (
                  <div className="mt-4 text-right">
                    <a
                      href={`/etapa/${etapaAtual}`}
                      className="font-sans text-[14px] text-[#FDF8F5] opacity-60 hover:opacity-100"
                    >
                      Continuar na Etapa {etapaAtual} →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SEÇÃO 4 — FERRAMENTAS VIVAS */}
        <section className="relative px-6 py-12 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <p className="mb-2 font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#D8D2CC] opacity-50">
              FERRAMENTAS QUE VIVEM COM VOCÊ
            </p>
            <p className="mb-8 caveat-decorativo text-[#C96B3E]">
              cada fase completa, uma ferramenta anda com você.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {FERRAMENTAS.map((f) => {
                const unlocked = !!profile?.[f.desbloqueio];
                return (
                  <FerramentaCard
                    key={f.nome}
                    nome={f.nome}
                    rota={f.rota}
                    tags={f.tags}
                    unlocked={unlocked}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* SEÇÃO 5 — BIBLIOTECA */}
        <section className="relative px-6 py-12 pb-24 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-[32px] text-[#FDF8F5]">
                  Seus entregáveis
                </h2>
                <p className="mt-1 font-sans text-[14px] text-[#D8D2CC] opacity-60">
                  {entregaveis.length}{" "}
                  {entregaveis.length === 1
                    ? "entregável criado"
                    : "entregáveis criados"}{" "}
                  na sua jornada
                </p>
              </div>
              <a
                href="/biblioteca"
                className="font-sans text-[14px] text-[#C96B3E] hover:underline"
              >
                Ver todos →
              </a>
            </div>

            {entregaveis.length === 0 ? (
              <p className="py-12 text-center caveat-decorativo text-[#D8D2CC] opacity-40">
                seu primeiro entregável aparece quando você completa a Etapa 1.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {entregaveis.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-5"
                  >
                    <p className="mb-2 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#C96B3E]">
                      ETAPA {e.etapa}
                    </p>
                    <p className="mb-2 font-sans text-[15px] font-semibold text-[#FDF8F5]">
                      {e.titulo}
                    </p>
                    <p className="line-clamp-3 font-sans text-[13px] text-[#D8D2CC] opacity-70">
                      {previewEntregavel(e.conteudo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes pulse-star {
          0%, 100% { box-shadow: 0 0 32px rgba(201,107,62,0.6); }
          50%      { box-shadow: 0 0 48px rgba(201,107,62,0.85); }
        }
      `}</style>
    </div>
  );
}

function EstrelaItem({
  n,
  nome,
  concluida,
  atual,
  onClick,
}: {
  n: number;
  nome: string;
  concluida: boolean;
  atual: boolean;
  onClick: () => void;
}) {
  if (concluida) {
    return (
      <button
        onClick={onClick}
        className="relative z-10 flex flex-col items-center gap-2"
      >
        <div
          className="flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full bg-[#C8A96E] transition-transform hover:scale-105"
          style={{ boxShadow: "0 0 20px rgba(200,169,110,0.45)" }}
        >
          <span className="font-serif text-[18px] text-[#1A1A2E]">{n}</span>
        </div>
        <span className="max-w-[80px] text-center font-sans text-[11px] leading-tight text-[#FDF8F5]">
          {nome}
        </span>
        <span className="caveat-decorativo text-[#C8A96E]">
          concluída
        </span>
      </button>
    );
  }
  if (atual) {
    return (
      <button
        onClick={onClick}
        className="relative z-10 flex flex-col items-center gap-2"
      >
        <div
          className="relative flex h-[64px] w-[64px] cursor-pointer items-center justify-center rounded-full bg-[#C96B3E]"
          style={{ animation: "pulse-star 2s infinite" }}
        >
          <span className="font-serif text-[22px] text-[#FDF8F5]">{n}</span>
          <div className="absolute inset-[-4px] rounded-full border-2 border-[rgba(201,107,62,0.35)]" />
        </div>
        <span className="max-w-[80px] text-center font-sans text-[11px] font-semibold leading-tight text-[#FDF8F5]">
          {nome}
        </span>
        <span className="caveat-decorativo text-[#C96B3E]">
          abrindo agora
        </span>
      </button>
    );
  }
  return (
    <div className="relative z-10 flex cursor-default flex-col items-center gap-2 opacity-35">
      <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)]">
        <span className="font-sans text-[16px] text-[#D8D2CC]">{n}</span>
      </div>
      <span className="max-w-[80px] text-center font-sans text-[11px] leading-tight text-[#D8D2CC]">
        {nome}
      </span>
      <span className="caveat-decorativo text-[#D8D2CC]">
        no seu horizonte
      </span>
    </div>
  );
}

function FerramentaCard({
  nome,
  rota,
  tags,
  unlocked,
}: {
  nome: string;
  rota: string;
  tags: string;
  unlocked: boolean;
}) {
  if (unlocked) {
    return (
      <a
        href={rota}
        className="block rounded-xl border border-[rgba(44,106,79,0.3)] bg-[rgba(44,106,79,0.12)] p-5 transition-colors hover:bg-[rgba(44,106,79,0.18)]"
      >
        <span className="mb-3 inline-block rounded-full bg-[rgba(44,106,79,0.4)] px-2 py-0.5 font-accent text-[9px] font-bold tracking-[1.5px] text-[#9ED9B5]">
          ATIVA
        </span>
        <p className="mb-1 font-sans text-[15px] font-semibold text-[#FDF8F5]">
          {nome}
        </p>
        <p className="font-sans text-[12px] text-[#D8D2CC] opacity-70">
          {tags}
        </p>
      </a>
    );
  }
  return (
    <div className="cursor-default rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-5 opacity-35">
      <span className="mb-3 inline-block rounded-full border border-[rgba(255,255,255,0.12)] px-2 py-0.5 font-accent text-[10px] font-semibold text-[#D8D2CC]">
        anda com você
      </span>
      <p className="mb-1 font-sans text-[15px] font-semibold text-[#FDF8F5]">
        {nome}
      </p>
      <p className="font-sans text-[12px] text-[#D8D2CC] opacity-70">{tags}</p>
    </div>
  );
}
