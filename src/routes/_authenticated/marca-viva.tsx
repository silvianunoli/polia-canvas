import { useMemo } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/marca-viva")({
  head: () => ({
    meta: [
      { title: "Sua Marca Viva · Pólia" },
      {
        name: "description",
        content:
          "Sua identidade, voz e posicionamento reunidos num só lugar.",
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
  component: MarcaVivaPage,
});

interface Entregavel {
  id: string;
  etapa: number;
  tipo: string;
  conteudo: Record<string, unknown> | null;
}

function MarcaVivaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const dadosQuery = useQuery({
    queryKey: ["marca-viva", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, entregaveisRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, business_name, streak, etapa_atual, orbit_brand_alive_unlocked, star_1_completed_at, star_2_completed_at, star_3_completed_at, profile_story, problem_solved, target_customer",
          )
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("entregaveis")
          .select("id, etapa, tipo, conteudo")
          .eq("user_id", userId!)
          .in("etapa", [1, 2, 3])
          .eq("status", "concluido"),
      ]);
      return {
        profile: profileRes.data,
        entregaveis: (entregaveisRes.data ?? []) as Entregavel[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];

  const e1 = useMemo(() => entregaveis.find((e) => e.etapa === 1), [entregaveis]);
  const e2 = useMemo(() => entregaveis.find((e) => e.etapa === 2), [entregaveis]);
  const e3 = useMemo(() => entregaveis.find((e) => e.etapa === 3), [entregaveis]);

  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = (profile as { streak?: number } | null)?.streak ?? 0;

  if (dadosQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
        <p className="caveat-decorativo text-[#1A1A2E] opacity-40">
          carregando...
        </p>
      </div>
    );
  }

  if (!profile?.orbit_brand_alive_unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center text-center px-8">
        <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-4">
          SUA MARCA VIVA
        </p>
        <h1 className="font-serif text-[#FDF8F5] text-[48px] leading-tight mb-4 max-w-[520px]">
          Essa ferramenta entra em órbita quando você completar a Etapa 1.
        </h1>
        <p className="font-sans text-[#D8D2CC] text-[16px] max-w-[440px] mb-8">
          Sua identidade, voz e posicionamento reunidos num só lugar.
        </p>
        <button
          onClick={() => navigate({ to: "/etapa/1" })}
          className="bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[16px] px-8 py-3.5 rounded-xl hover:bg-[#B85A2D] transition-colors"
        >
          Começar Etapa 1 →
        </button>
      </div>
    );
  }

  const chips = [
    { etapa: 1, done: !!profile.star_1_completed_at },
    { etapa: 2, done: !!profile.star_2_completed_at },
    { etapa: 3, done: !!profile.star_3_completed_at },
  ];

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} navActive="/painel" />

      <div className="px-6 pt-8 pb-12 max-w-[1280px] mx-auto md:px-12 md:pt-10 md:pb-16">
        {/* Cabeçalho */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-2">
              SUA MARCA VIVA
            </p>
            <h1 className="font-serif text-[#1A1A2E] text-[28px] leading-tight md:text-[44px]">
              {profile.business_name || "Seu negócio"}
            </h1>
            <p className="caveat-decorativo text-[#C96B3E] mt-2">
              identidade, voz e posicionamento.
            </p>
          </div>
        </div>

        {/* Chips */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {chips.map((item) => (
            <div
              key={item.etapa}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border ${
                item.done
                  ? "bg-[rgba(44,106,79,0.08)] border-[rgba(44,106,79,0.2)] text-[#2D6A4F]"
                  : "bg-[rgba(26,26,46,0.04)] border-[rgba(26,26,46,0.08)] text-[#1A1A2E] opacity-35"
              }`}
            >
              <span className="font-accent text-[9px] tracking-[1.5px] uppercase font-bold">
                {item.done
                  ? `Etapa ${item.etapa}`
                  : `Etapa ${item.etapa} · pendente`}
              </span>
            </div>
          ))}
        </div>

        {/* CARD E1 — Mini-Pitch */}
        <CardMiniPitch
          entregavel={e1}
          profile={profile}
          onIr={() => navigate({ to: "/etapa/1" })}
        />

        {/* CARD E2 — Voz de Marca */}
        <CardVozMarca
          entregavel={e2}
          done={!!profile.star_2_completed_at}
          onIr={() => navigate({ to: "/etapa/2" })}
        />

        {/* CARD E3 — Mapa de Posicionamento */}
        <CardMapa
          entregavel={e3}
          done={!!profile.star_3_completed_at}
          onIr={() => navigate({ to: "/etapa/3" })}
        />
      </div>
    </div>
  );
}

/* ============== Card Mini-Pitch (E1) ============== */
function CardMiniPitch({
  entregavel,
  profile,
  onIr,
}: {
  entregavel?: Entregavel;
  profile: {
    profile_story?: string | null;
    problem_solved?: string | null;
    target_customer?: string | null;
  };
  onIr: () => void;
}) {
  const pitchTexto =
    (entregavel?.conteudo as { texto?: string } | null)?.texto ?? "";
  const temPitch = !!pitchTexto;

  return (
    <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,46,0.06)] mb-6 max-w-[760px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#C9407A] opacity-70 mb-1">
            ETAPA 1 · SONHO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Seu mini-pitch
          </h2>
        </div>
      </div>

      {temPitch ? (
        <>
          {[
            { label: "QUEM VOCÊ AJUDA", conteudo: profile.target_customer },
            { label: "O QUE VOCÊ FAZ", conteudo: profile.problem_solved },
            { label: "O QUE TRANSFORMA", conteudo: profile.profile_story },
          ]
            .filter((item) => !!item.conteudo)
            .map((item, i, arr) => (
              <div
                key={item.label}
                className={`mb-4 pb-4 ${
                  i === arr.length - 1
                    ? "border-none mb-0 pb-0"
                    : "border-b border-[rgba(26,26,46,0.06)]"
                }`}
              >
                <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-1">
                  {item.label}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
                  {item.conteudo}
                </p>
              </div>
            ))}

          <div className="mt-5 bg-[rgba(201,64,122,0.04)] border border-[rgba(201,64,122,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#C9407A] opacity-70 mb-2">
              SEU PITCH COMPLETO
            </p>
            <p className="caveat-decorativo text-[#1A1A2E] leading-relaxed">
              "{pitchTexto}"
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 1 pra gerar seu mini-pitch."
          cta="Ir pra Etapa 1 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

/* ============== Card Voz de Marca (E2) ============== */
function CardVozMarca({
  entregavel,
  done,
  onIr,
}: {
  entregavel?: Entregavel;
  done: boolean;
  onIr: () => void;
}) {
  const voz = entregavel?.conteudo as
    | { palavras?: { palavra: string; subtitulo: string }[]; frase?: string }
    | null;
  const temVoz = !!voz?.frase;

  return (
    <div
      className={`bg-white rounded-2xl p-8 border mb-6 max-w-[760px] ${
        !done
          ? "border-dashed border-[rgba(26,26,46,0.08)] opacity-60"
          : "border-[rgba(26,26,46,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#C9407A] opacity-70 mb-1">
            ETAPA 2 · SONHO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Sua voz de marca
          </h2>
        </div>
      </div>

      {temVoz && voz ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(voz.palavras ?? []).map((p, i) => (
              <div
                key={i}
                className="bg-[rgba(26,26,46,0.03)] rounded-xl p-4 text-center border border-[rgba(26,26,46,0.06)]"
              >
                <p className="font-serif text-[#C96B3E] text-[20px] mb-1">
                  {p.palavra}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[11px] opacity-40">
                  {p.subtitulo}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-[rgba(201,64,122,0.04)] border border-[rgba(201,64,122,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#C9407A] opacity-70 mb-2">
              SUA VOZ EM UMA FRASE
            </p>
            <p className="caveat-decorativo text-[#1A1A2E] leading-relaxed">
              "{voz.frase}"
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 2 pra descobrir sua voz de marca."
          cta="Ir pra Etapa 2 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

/* ============== Card Mapa de Posicionamento (E3) ============== */
function CardMapa({
  entregavel,
  done,
  onIr,
}: {
  entregavel?: Entregavel;
  done: boolean;
  onIr: () => void;
}) {
  const mapa = entregavel?.conteudo as
    | {
        declaracao?: string;
        diferencial?: string;
        naoAlcancam?: string;
        anguloUnico?: string;
      }
    | null;
  const temMapa = !!mapa?.declaracao;

  return (
    <div
      className={`bg-white rounded-2xl p-8 border mb-6 max-w-[760px] ${
        !done
          ? "border-dashed border-[rgba(26,26,46,0.08)] opacity-60"
          : "border-[rgba(26,26,46,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#C9407A] opacity-70 mb-1">
            ETAPA 3 · SONHO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Seu mapa de posicionamento
          </h2>
        </div>
      </div>

      {temMapa && mapa ? (
        <>
          <div className="mb-5 pb-5 border-b border-[rgba(26,26,46,0.06)]">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
              SUA DECLARAÇÃO
            </p>
            <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
              {mapa.declaracao}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <div>
              <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                SEU DIFERENCIAL
              </p>
              <p className="font-sans text-[#1A1A2E] text-[14px] leading-relaxed">
                {mapa.diferencial}
              </p>
            </div>
            <div>
              <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                O QUE OUTRAS NAO ALCANCAM
              </p>
              <p className="font-sans text-[#1A1A2E] text-[14px] leading-relaxed">
                {mapa.naoAlcancam}
              </p>
            </div>
          </div>

          <div className="bg-[rgba(201,64,122,0.04)] border border-[rgba(201,64,122,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#C9407A] opacity-70 mb-2">
              SEU ANGULO UNICO
            </p>
            <p className="caveat-decorativo text-[#1A1A2E] leading-relaxed">
              "{mapa.anguloUnico}"
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 3 pra mapear seu posicionamento."
          cta="Ir pra Etapa 3 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

function EstadoVazio({
  texto,
  cta,
  onClick,
}: {
  texto: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="text-center py-8">
      <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40 mb-3">
        {texto}
      </p>
      <button
        onClick={onClick}
        className="font-sans text-[#C96B3E] text-[13px] hover:underline"
      >
        {cta}
      </button>
    </div>
  );
}
