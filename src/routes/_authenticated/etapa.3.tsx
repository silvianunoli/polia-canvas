import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarMapaPosicionamento, type PositioningMap } from "@/lib/positioning.functions";

export const Route = createFileRoute("/_authenticated/etapa/3")({
  head: () => ({
    meta: [
      { title: "Etapa 3 — Modelo de Negócio · Pólia" },
      { name: "description", content: "Desenhe seu mapa competitivo e descubra seu lugar único." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_3_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    if ((profile.etapa_atual ?? 1) < 3) {
      throw redirect({ to: "/painel" });
    }
    if (profile.star_3_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa3Page,
});

type ProfileE3 = {
  display_name: string | null;
  business_name: string | null;
  competitors: string | null;
  differentiators: string | null;
  positioning_statement: string | null;
  positioning_finalized_at: string | null;
  star_3_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa3:step";

function Etapa3Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarMapaPosicionamento);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE3 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [competitors, setCompetitors] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [positioningStatement, setPositioningStatement] = useState("");

  const [mapa, setMapa] = useState<PositioningMap | null>(null);
  const [loadingMapa, setLoadingMapa] = useState(false);
  const [mapaError, setMapaError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid || !mounted) return;
      setUserId(uid);
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "display_name, business_name, competitors, differentiators, positioning_statement, positioning_finalized_at, star_3_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE3);
        setCompetitors(p.competitors ?? "");
        setDifferentiators(p.differentiators ?? "");
        setPositioningStatement(p.positioning_statement ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE3).positioning_finalized_at) {
          setStep(5);
        } else if (p.positioning_statement) {
          setStep(4);
        } else if (p.differentiators) {
          setStep(4);
        } else if (p.competitors) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE3).positioning_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "mapa_posicionamento")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setMapa(ent.conteudo as unknown as PositioningMap);
        }
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loaded && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(step));
    }
  }, [step, loaded]);

  const autoSave = useCallback(
    async (campos: Partial<ProfileE3>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarMapa = useCallback(async () => {
    await autoSave({ positioning_statement: positioningStatement });
    setStep(5);
    setLoadingMapa(true);
    setMapaError(null);
    const result = await gerar({
      data: {
        competitors,
        differentiators,
        positioning_statement: positioningStatement,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingMapa(false);
    if (result.error || !result.mapa) {
      setMapaError(result.error || "Erro desconhecido.");
      return;
    }
    setMapa(result.mapa);
  }, [autoSave, gerar, competitors, differentiators, positioningStatement, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !mapa) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Mapa de Posicionamento",
      tipo: "mapa_posicionamento",
      fase: "Sonho",
      etapa: 3,
      conteudo: mapa as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ positioning_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, mapa]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_3_completed_at: new Date().toISOString(),
          orbit_sales_unlocked: true,
          etapa_atual: 4,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Terceira estrela acesa",
        descricao: "Desenhou o mapa de posicionamento.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE4 = [
        "Escolher plataforma de presença digital",
        "Escrever bio com meu posicionamento",
        "Definir foto de perfil e capa",
        "Publicar minha primeira apresentação",
        "Adicionar link de contato ao perfil",
      ];
      await supabase.from("tarefas").insert(
        tarefasE4.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 4,
          status: "a_fazer",
          fonte: "sistema",
        })),
      );

      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    })();
  }, [step, userId, profile?.streak]);

  const initial = (profile?.display_name?.[0] || "P").toUpperCase();
  const streak = profile?.streak ?? 0;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
        <p className="caveat-informacional text-[#C96B3E]">carregando...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes polia-glow { 0%,100% { box-shadow: 0 0 12px rgba(232,151,112,0.6) } 50% { box-shadow: 0 0 28px rgba(232,151,112,0.95) } }
        @keyframes polia-pulse-dot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8) } 40% { opacity: 1; transform: scale(1.1) } }
        @keyframes polia-star-rise { 0% { transform: scale(0.8); opacity: 0.3 } 50% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes polia-ring { 0% { transform: scale(0.6); opacity: 0.8 } 100% { transform: scale(2.5); opacity: 0 } }
      `}</style>

      {step === 1 && <Capa onStart={() => setStep(2)} />}

      {(step === 2 || step === 3 || step === 4) && (
        <PerguntaLayout step={step} streak={streak} initial={initial}>
          {step === 2 && (
            <PerguntaBlock
              caveat="saber com quem você compete é saber quem você não é."
              titulo={<>Quem mais faz<br />parecido com você?</>}
              label="SEUS CONCORRENTES"
              placeholder="Ex: Beatriz tem uma papelaria personalizada no Instagram com 20k seguidores. A Lua Designs faz convites no Canva mais barato. As grandes gráficas oferecem quantidade. Mas nenhuma tem minha abordagem de design autoral com atendimento próximo."
              maxLength={500}
              ajuda="nome, canal, o que fazem. pode ser informal. é só pra gente mapear o terreno."
              raposaEstado="Atenta · olhando pro lado"
              raposaTexto="Concorrente não é inimigo. É referência de mercado. Quanto mais você conhece eles, mais claro fica onde só você pode estar."
              valor={competitors}
              setValor={setCompetitors}
              onAutoSave={() => autoSave({ competitors })}
              onContinuar={() => {
                autoSave({ competitors });
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="essa é a pergunta que a maioria nunca para pra responder."
              titulo={<>O que só<br />você faz?</>}
              label="SEU DIFERENCIAL REAL"
              placeholder="Ex: Faço design de convites 100% autoral, nada de template. Cada peça nasce de uma conversa profunda com a cliente sobre a memória que ela quer criar. Entrego em até 5 dias e acompanho pessoalmente até a impressão final."
              maxLength={500}
              ajuda="pode ser o processo, a experiência, o resultado, o atendimento. qualquer coisa que faça uma cliente te escolher duas vezes."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="Especificidade vence eloquência. 'Faço com carinho' não é diferencial. 'Entrego em 5 dias com revisão ilimitada' é."
              valor={differentiators}
              setValor={setDifferentiators}
              onAutoSave={() => autoSave({ differentiators })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ differentiators });
                setStep(4);
              }}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="agora junta tudo numa frase. imperfeita tá ótimo."
              titulo={<>Por que uma cliente<br />escolheria você?</>}
              label="SUA RAZÃO DE SER ESCOLHIDA"
              placeholder="Ex: Porque precisa de alguém que entenda que o convite não é só papel. É o começo de uma memória. E alguém que entregue isso com cuidado real, do conceito à impressão."
              maxLength={200}
              ajuda="não precisa ser perfeito. a gente vai refinar isso no mapa."
              raposaEstado="Animada · em pé"
              raposaTexto="A melhor razão de ser escolhida não é sobre você. É sobre o que muda na vida da sua cliente quando ela te encontra."
              valor={positioningStatement}
              setValor={setPositioningStatement}
              onAutoSave={() => autoSave({ positioning_statement: positioningStatement })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarMapa()}
              continuarLabel="Montar meu mapa  →"
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <MapaTela
          loading={loadingMapa}
          mapa={mapa}
          error={mapaError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarMapa()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa4={() => navigate({ to: "/etapa/4" })}
        />
      )}
    </>
  );
}

/* ============== E3.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Concorrentes", sub: "quem mais faz parecido" },
    { num: "2", titulo: "Diferencial", sub: "o que só você faz" },
    { num: "3", titulo: "Sua razão", sub: "por que te escolheriam" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 3 DE 11 · MODELO DE NEGÓCIO
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#E89770]">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-[#E89770] mt-1">Lockup L3 Vertical</p>
          <p className="font-sans text-[10px] text-[rgba(216,210,204,0.55)] mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-[#E89770] mt-10">agora a gente vai te localizar.</p>

        <h1 className="font-serif text-[#FDF8F5] text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Onde você fica no mapa?
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra desenhar seu mapa competitivo e seu lugar único.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.num}
              className="w-[200px] rounded-[14px] border border-[rgba(232,151,112,0.3)] bg-[rgba(36,36,66,0.45)] p-[20px] text-center"
            >
              <p className="font-serif text-[#C96B3E] text-[30px] leading-none">{c.num}</p>
              <p className="font-serif text-[#FDF8F5] text-[20px] mt-2">{c.titulo}</p>
              <p className="caveat-decorativo text-[rgba(216,210,204,0.8)] mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-10 md:mt-14 relative h-[58px] rounded-[12px] bg-[#C96B3E] px-10 font-sans text-[18px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
          style={{ boxShadow: "0 0 24px rgba(201,107,62,0.35)" }}
        >
          Quero meu mapa  →
        </button>

        <p className="caveat-decorativo text-[rgba(232,151,112,0.75)] mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E3.2-E3.4 (sidebar + área) ============== */
function PerguntaLayout({
  step,
  streak,
  initial,
  children,
}: {
  step: number;
  streak: number;
  initial: string;
  children: React.ReactNode;
}) {
  const passos = [
    { num: 1, label: "Concorrentes" },
    { num: 2, label: "Diferencial" },
    { num: 3, label: "Sua razão" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={3} fase="SONHO" nome="Modelo" variant="dark" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E] uppercase">
            ETAPA 3 · MODELO DE NEGÓCIO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Onde você fica
            <br />
            no mapa.
          </h2>
          <hr className="border-[#EAE2D8] my-6" />
          <div className="flex flex-col gap-5">
            {passos.map((p, idx) => {
              const ativo = idx === activeIndex;
              const feito = idx < activeIndex;
              return (
                <div key={p.num} className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                      ativo
                        ? "bg-[#C96B3E] text-[#FDF8F5]"
                        : feito
                          ? "bg-[#C96B3E]/30 text-[#C96B3E]"
                          : "border border-[#C8C0B5] text-[#6A6A7E]"
                    }`}
                  >
                    {p.num}
                  </div>
                  <p
                    className={`font-sans text-[14px] ${
                      ativo ? "text-[#1A1A2E] font-semibold" : "text-[#6A6A7E]"
                    }`}
                  >
                    {p.label}
                  </p>
                </div>
              );
            })}
          </div>
          <hr className="border-[#EAE2D8] my-6" />
          <p className="caveat-decorativo text-[#6A6A7E] leading-[22px]">
            depois vem
            <br />
            seu mapa único
          </p>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

/* ============== Pergunta genérica ============== */
function PerguntaBlock({
  caveat,
  titulo,
  label,
  placeholder,
  maxLength,
  ajuda,
  raposaEstado,
  raposaTexto,
  valor,
  setValor,
  onAutoSave,
  onVoltar,
  onContinuar,
  continuarLabel = "Continuar  →",
  minLen = 20,
}: {
  caveat: string;
  titulo: React.ReactNode;
  label: string;
  placeholder: string;
  maxLength: number;
  ajuda: string;
  raposaEstado: string;
  raposaTexto: string;
  valor: string;
  setValor: (v: string) => void;
  onAutoSave: () => void;
  onVoltar?: () => void;
  onContinuar: () => void;
  continuarLabel?: string;
  minLen?: number;
}) {
  const podeAvancar = valor.trim().length >= minLen;
  return (
    <div>
      <p className="caveat-informacional text-[#C96B3E] mt-2">{caveat}</p>
      <h1 className="font-serif text-[#1A1A2E] text-[26px] sm:text-[32px] md:text-[48px] leading-[1.18] mt-3">
        {titulo}
      </h1>

      <p className="font-accent text-[10px] font-bold tracking-[2px] text-[#6A6A7E] uppercase mt-10">
        {label}
      </p>
      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={onAutoSave}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-3 w-full max-w-[720px] min-h-[140px] rounded-[12px] border border-[#EAE2D8] bg-white p-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#A8A2A0] focus:outline-none focus:ring-2 focus:ring-[#C96B3E]/30"
      />
      <p className="caveat-decorativo text-[rgba(42,42,62,0.6)] mt-2">{ajuda}</p>

      <hr className="border-[#EAE2D8] my-8 max-w-[720px]" />

      <div className="flex max-w-[720px] flex-col gap-4 rounded-[14px] border border-dashed border-[#C96B3E]/40 bg-[#FAF4EF] p-5 md:flex-row md:items-start">
        <div className="flex h-[80px] w-[80px] shrink-0 flex-col items-center justify-center rounded-[10px] border border-dashed border-[#C96B3E]/50 bg-white p-2 text-center">
          <p className="font-accent text-[8px] font-bold tracking-[1px] text-[#C96B3E]">RAPOSA</p>
          <p className="caveat-decorativo text-[#6A6A7E] leading-tight mt-1">{raposaEstado}</p>
        </div>
        <p className="font-sans text-[14px] leading-[22px] text-[#6A6A7E]">{raposaTexto}</p>
      </div>

      <div className="mt-10 flex max-w-[720px] items-center justify-between gap-4">
        {onVoltar ? (
          <button
            onClick={onVoltar}
            className="h-[48px] rounded-[12px] border border-[#C8C0B5] bg-transparent px-6 font-sans text-[14px] font-semibold text-[#6A6A7E] hover:bg-[#F5F0EA]"
          >
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onContinuar}
          disabled={!podeAvancar}
          className="h-[52px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5] transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-[#B85A2D]"
        >
          {continuarLabel}
        </button>
      </div>
    </div>
  );
}

/* ============== E3.5 — Mapa de Posicionamento (COSMIC) ============== */
function MapaTela({
  loading,
  mapa,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  mapa: PositioningMap | null;
  error: string | null;
  businessName: string;
  onAjustar: () => void;
  onContinuar: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        {loading && (
          <>
            <p className="caveat-informacional text-[#E89770] animate-pulse">
              desenhando seu mapa...
            </p>
            <div className="mt-6 flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-3 w-3 rounded-full bg-[#E89770]"
                  style={{ animation: `polia-pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
          </>
        )}

        {!loading && error && (
          <>
            <p className="font-serif text-[#FDF8F5] text-[28px]">Algo deu errado.</p>
            <p className="font-sans text-[rgba(216,210,204,0.8)] text-[14px] mt-2">{error}</p>
            <button
              onClick={onRetry}
              className="mt-6 h-[48px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5]"
            >
              Tenta de novo
            </button>
          </>
        )}

        {!loading && !error && mapa && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.95)]">
              ENTREGÁVEL · ETAPA 3 · MODELO DE NEGÓCIO
            </p>
            <p className="caveat-informacional text-[#E89770] mt-4">olha onde você fica.</p>
            <h1 className="font-serif text-[#FDF8F5] text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Seu lugar
              <br />
              no mapa.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-[rgba(200,169,110,0.3)] bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-[#C96B3E]">
                MAPA DE POSICIONAMENTO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Onde só você pode estar</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-serif text-[#1A1A2E] text-[24px] md:text-[28px] leading-[1.4] text-center italic">
                "{mapa.declaracao}"
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                    SEU DIFERENCIAL
                  </p>
                  <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                    {mapa.diferencial}
                  </p>
                </div>
                <div>
                  <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                    QUEM NÃO TE ALCANÇA
                  </p>
                  <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                    {mapa.naoAlcancam}
                  </p>
                </div>
              </div>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SEU ÂNGULO ÚNICO
              </p>
              <p className="caveat-decorativo text-[#C96B3E] mt-2">"{mapa.anguloUnico}"</p>

              <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-5 text-right">
                salvo em Sua Marca Viva · você edita quando quiser
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4 md:flex-row">
              <button
                onClick={onAjustar}
                className="h-[54px] rounded-[12px] border border-[#E89770] bg-transparent px-6 font-sans text-[15px] font-semibold text-[#E89770] hover:bg-[#E89770]/10"
              >
                Ajustar respostas
              </button>
              <button
                onClick={onContinuar}
                className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5] hover:bg-[#B85A2D]"
                style={{ boxShadow: "0 0 28px rgba(201,107,62,0.35)" }}
              >
                Continuar pra fim da etapa  →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== E3.6 — Conclusão estrela 3 ============== */
function Conclusao({ onVerPainel, onEtapa4 }: { onVerPainel: () => void; onEtapa4: () => void }) {
  const estrelas = [
    { n: 1, label: "Descoberta", estado: "acesa" },
    { n: 2, label: "Identidade", estado: "acesa" },
    { n: 3, label: "Modelo", estado: "agora" },
    { n: 4, label: "Presença", estado: "dim" },
    { n: 5, label: "Conteúdo", estado: "dim" },
    { n: 6, label: "Rotina", estado: "dim" },
    { n: 7, label: "Vendas", estado: "dim" },
    { n: 8, label: "Clientes", estado: "dim" },
    { n: 9, label: "Audiência", estado: "dim" },
    { n: 10, label: "Crescimento", estado: "dim" },
    { n: 11, label: "Rede", estado: "dim" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] flex-col items-center px-6 py-20 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 3 · MODELO DE NEGÓCIO · CONCLUÍDA
        </p>

        <p className="caveat-informacional text-[#E89770] mt-10">
          agora todo mundo sabe onde você fica.
        </p>

        <h1 className="font-serif text-[#FDF8F5] text-[52px] md:text-[68px] leading-[1.06] mt-3 max-w-[820px]">
          Sua terceira estrela
          <br />
          tá acesa.
        </h1>

        <div className="mt-10 md:mt-14 flex w-full justify-center gap-6 overflow-x-auto pb-4">
          {estrelas.map((e) => {
            const acesa = e.estado === "acesa";
            const agora = e.estado === "agora";
            return (
              <div key={e.n} className="flex w-[68px] shrink-0 flex-col items-center">
                <div className="relative">
                  <span
                    className={`text-[34px] leading-none ${
                      acesa || agora ? "text-[#C96B3E]" : "text-[rgba(253,248,245,0.18)]"
                    }`}
                    style={
                      agora
                        ? {
                            animation: "polia-star-rise 700ms ease-out, polia-glow 1.8s ease-in-out infinite 700ms",
                            display: "inline-block",
                            textShadow: "0 0 24px rgba(232,151,112,0.95)",
                          }
                        : acesa
                          ? { textShadow: "0 0 14px rgba(201,107,62,0.7)" }
                          : undefined
                    }
                  >
                    ★
                  </span>
                  {agora && (
                    <>
                      <span
                        className="pointer-events-none absolute inset-0 rounded-full border border-[#E89770]/60"
                        style={{ animation: "polia-ring 1.6s ease-out infinite" }}
                      />
                      <span
                        className="pointer-events-none absolute inset-0 rounded-full border border-[#E89770]/40"
                        style={{ animation: "polia-ring 1.6s ease-out 0.3s infinite" }}
                      />
                    </>
                  )}
                </div>
                <p
                  className={`caveat-decorativo text-[11px] mt-2 ${
                    acesa || agora ? "text-[#FDF8F5]" : "text-[rgba(253,248,245,0.45)]"
                  }`}
                >
                  {e.label}
                </p>
                {agora && (
                  <p className="caveat-decorativo text-[#E89770] mt-1 animate-pulse">acesa agora</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 w-full max-w-[560px] rounded-[20px] border border-[rgba(200,169,110,0.25)] bg-[rgba(200,169,110,0.08)] p-7 text-left">
          <p className="font-accent text-[9px] font-bold tracking-[2px] text-[#C8A96E] uppercase">
            DESBLOQUEADO · LUA ORBITANDO
          </p>
          <p className="font-serif text-[#FDF8F5] text-[24px] mt-2">Suas Vendas e Clientes</p>
          <p className="font-sans text-[#D8D2CC] text-[15px] leading-[24px] mt-2">
            Onde você gerencia pedidos, acompanha clientes e organiza sua agenda de vendas. Sempre disponível no céu.
          </p>
        </div>

        <div className="mt-6 w-full max-w-[560px] rounded-[20px] border border-[rgba(200,169,110,0.25)] bg-[rgba(200,169,110,0.05)] p-7 text-left">
          <p className="font-accent text-[9px] font-bold tracking-[2px] text-[#C8A96E] uppercase">
            ATUALIZADO · SUA MARCA VIVA
          </p>
          <p className="font-sans text-[#D8D2CC] text-[15px] leading-[24px] mt-2">
            Seu mapa de posicionamento foi adicionado à Sua Marca Viva. Acesse quando quiser revisar onde você está.
          </p>
        </div>

        <p className="font-serif text-[#C96B3E] text-[24px] mt-12">A Pólia não acaba. Ela só fica mais sua.</p>
        <p className="caveat-decorativo text-[rgba(232,151,112,0.75)] mt-2">
          cada etapa que você completa, a Pólia aprende mais sobre o seu negócio
        </p>

        <div className="mt-10 flex flex-col gap-4 md:flex-row">
          <button
            onClick={onVerPainel}
            className="h-[54px] rounded-[12px] border border-[#E89770] bg-transparent px-6 font-sans text-[15px] font-semibold text-[#E89770] hover:bg-[#E89770]/10"
          >
            Ver meu painel
          </button>
          <button
            onClick={onEtapa4}
            className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5] hover:bg-[#B85A2D]"
            style={{ boxShadow: "0 0 28px rgba(201,107,62,0.35)" }}
          >
            Começar Etapa 4  →
          </button>
        </div>
      </div>
    </div>
  );
}
