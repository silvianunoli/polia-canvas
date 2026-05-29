import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarPlanoCrescimento, type PlanoCrescimento } from "@/lib/network.functions";

export const Route = createFileRoute("/_authenticated/etapa/11")({
  head: () => ({
    meta: [
      { title: "Etapa 11 — Sua Rede · Pólia" },
      { name: "description", content: "Desenhe sua visão, sua rede e seu próximo passo." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_11_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    if ((profile.etapa_atual ?? 1) < 11) {
      throw redirect({ to: "/painel" });
    }
    if (profile.star_11_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa11Page,
});

type ProfileE11 = {
  display_name: string | null;
  business_name: string | null;
  growth_vision: string | null;
  key_partners: string | null;
  timeline_goal: string | null;
  network_finalized_at: string | null;
  star_11_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa11:step";

function Etapa11Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarPlanoCrescimento);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE11 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [visao, setVisao] = useState("");
  const [rede, setRede] = useState("");
  const [passo, setPasso] = useState("");

  const [plano, setPlano] = useState<PlanoCrescimento | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(false);
  const [planoError, setPlanoError] = useState<string | null>(null);

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
          "display_name, business_name, growth_vision, key_partners, timeline_goal, network_finalized_at, star_11_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE11);
        setVisao(p.growth_vision ?? "");
        setRede(p.key_partners ?? "");
        setPasso(p.timeline_goal ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE11).network_finalized_at) {
          setStep(5);
        } else if (p.timeline_goal) {
          setStep(4);
        } else if (p.key_partners) {
          setStep(4);
        } else if (p.growth_vision) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE11).network_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "plano_crescimento")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setPlano(ent.conteudo as unknown as PlanoCrescimento);
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
    async (campos: Partial<ProfileE11>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarPlanoAcao = useCallback(async () => {
    await autoSave({ timeline_goal: passo });
    setStep(5);
    setLoadingPlano(true);
    setPlanoError(null);
    const result = await gerar({
      data: {
        growth_vision: visao,
        key_partners: rede,
        timeline_goal: passo,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingPlano(false);
    if (result.error || !result.plano) {
      setPlanoError(result.error || "Erro desconhecido.");
      return;
    }
    setPlano(result.plano);
  }, [autoSave, gerar, visao, rede, passo, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !plano) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Plano de Crescimento",
      tipo: "plano_crescimento",
      fase: "Evolução",
      etapa: 11,
      conteudo: plano as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ network_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, plano]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      const nowIso = new Date().toISOString();
      await supabase
        .from("profiles")
        .update({
          star_11_completed_at: nowIso,
          orbit_financial_active: true,
          jornada_completed_at: nowIso,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Todas as estrelas acesas",
        descricao: "Você fechou a jornada estruturada. A Pólia não acaba — ela fica mais sua.",
        xp: 200,
        tipo: "conclusao",
      });

      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    })();
  }, [step, userId, profile?.streak]);

  const initial = (profile?.display_name?.[0] || "P").toUpperCase();
  const streak = profile?.streak ?? 0;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
        <p className="font-handwritten text-[#C96B3E] text-[22px]">carregando...</p>
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
              caveat="um negócio sem direção não cresce. ele apenas sobrevive."
              titulo={<>Onde você quer estar daqui a um ano?</>}
              label="SUA VISÃO DE CRESCIMENTO"
              placeholder="Ex: Quero faturar R$15.000 por mês e trabalhar só com convites de alto padrão. Sonho em ter uma pequena equipe pra produção. Daqui a um ano quero ter saído do emprego CLT e viver só do meu negócio. Quero ser reconhecida como referência em convites autorais em SP."
              maxLength={400}
              ajuda="pode ser financeiro, de liberdade, de reconhecimento. conta como você imagina."
              raposaEstado="Atenta · escutando"
              raposaTexto="Visão não precisa ser perfeita. Ela precisa ser sua. O que você descreveu aqui vai guiar cada decisão daqui pra frente."
              valor={visao}
              setValor={setVisao}
              onAutoSave={() => autoSave({ growth_vision: visao })}
              onContinuar={() => {
                autoSave({ growth_vision: visao });
                setStep(3);
              }}
              minLen={20}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="a rede certa acelera tudo."
              titulo={<>Quem te apoia nesse caminho?</>}
              label="AS PESSOAS QUE IMPORTAM"
              placeholder="Ex: Minha sócia cuida da parte financeira enquanto eu faço a produção. Tenho uma amiga fotógrafa que me ajuda com as fotos dos produtos. Sigo uma comunidade de papeleiras e aprendo muito por lá. Não tenho ninguém do negócio por perto, é o que mais sinto falta."
              maxLength={400}
              ajuda="parceiras, mentoras, fornecedores de confiança, comunidades. quem já está ou quem você gostaria de ter."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="Rede não é networking. É a pessoa que você liga quando trava, a parceira que indica sem pedir nada, a comunidade que entende o que você faz."
              valor={rede}
              setValor={setRede}
              onAutoSave={() => autoSave({ key_partners: rede })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ key_partners: rede });
                setStep(4);
              }}
              minLen={15}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="o plano perfeito que não começa não existe."
              titulo={<>Qual é o seu próximo passo concreto?</>}
              label="O QUE VOCÊ FAZ ESSA SEMANA"
              placeholder="Ex: Essa semana vou definir quais pedidos aceitar em dezembro e fechar a agenda. No próximo mês quero ter meu primeiro orçamento de alto padrão enviado. Em 3 meses quero ter minha identidade visual atualizada com tudo que aprendi aqui."
              maxLength={300}
              ajuda="começa pelo que você consegue fazer agora. o resto vem depois."
              raposaEstado="Animada · em pé"
              raposaTexto="Fechar esse ciclo não é o fim. É o começo de uma versão do seu negócio que você construiu com intenção."
              valor={passo}
              setValor={setPasso}
              onAutoSave={() => autoSave({ timeline_goal: passo })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarPlanoAcao()}
              continuarLabel="Montar meu plano  →"
              minLen={15}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <PlanoTela
          loading={loadingPlano}
          plano={plano}
          error={planoError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarPlanoAcao()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerJornada={() => navigate({ to: "/painel" })}
          onVerPainel={() => navigate({ to: "/painel" })}
        />
      )}
    </>
  );
}

/* ============== E11.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Visão", sub: "onde quer chegar" },
    { num: "2", titulo: "Time", sub: "quem te apoia" },
    { num: "3", titulo: "Passo", sub: "o que vem primeiro" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 11 DE 11 · SUA REDE
        </p>

        <div className="mt-10 flex h-[180px] w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#E89770]">PLACEHOLDER · LOGO</p>
          <p className="font-handwritten text-[#E89770] text-[18px] mt-1">Lockup L11 Vertical</p>
          <p className="font-sans text-[10px] text-[rgba(216,210,204,0.55)] mt-1">180×180</p>
        </div>

        <p className="font-handwritten text-[#E89770] text-[26px] mt-10">você não chega lá sozinha.</p>

        <h1 className="font-serif text-[#FDF8F5] text-[44px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Onde você quer
          <br />
          estar. Com quem.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra desenhar sua visão, a rede que te apoia e o primeiro passo real.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.num}
              className="w-[220px] rounded-[14px] border border-[rgba(232,151,112,0.3)] bg-[rgba(36,36,66,0.45)] p-[20px] text-center"
            >
              <p className="font-serif text-[#C96B3E] text-[30px] leading-none">{c.num}</p>
              <p className="font-serif text-[#FDF8F5] text-[20px] mt-2">{c.titulo}</p>
              <p className="font-handwritten text-[rgba(216,210,204,0.8)] text-[15px] mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-14 relative h-[58px] rounded-[12px] bg-[#C96B3E] px-10 font-sans text-[18px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
          style={{ boxShadow: "0 0 24px rgba(201,107,62,0.35)" }}
        >
          Vamos fechar o ciclo  →
        </button>

        <p className="font-handwritten text-[rgba(232,151,112,0.75)] text-[18px] mt-4">
          leva uns 15 minutinhos. e depois, tudo isso é seu.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E11.2-E11.4 ============== */
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
    { num: 1, label: "Visão" },
    { num: 2, label: "Time" },
    { num: 3, label: "Passo" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={11} fase="EVOLUÇÃO" nome="Conexões" variant="dark" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E] uppercase">
            ETAPA 11 · SUA REDE
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Onde você quer
            <br />
            estar. Com quem.
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
          <p className="font-handwritten text-[#6A6A7E] text-[16px] leading-[22px]">
            depois vem
            <br />
            o seu plano de crescimento
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
      <p className="font-handwritten text-[#C96B3E] text-[22px] mt-2">{caveat}</p>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] md:text-[48px] leading-[1.18] mt-3">
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
      <p className="font-handwritten text-[rgba(42,42,62,0.6)] text-[16px] mt-2">{ajuda}</p>

      <hr className="border-[#EAE2D8] my-8 max-w-[720px]" />

      <div className="flex max-w-[720px] flex-col gap-4 rounded-[14px] border border-dashed border-[#C96B3E]/40 bg-[#FAF4EF] p-5 md:flex-row md:items-start">
        <div className="flex h-[80px] w-[80px] shrink-0 flex-col items-center justify-center rounded-[10px] border border-dashed border-[#C96B3E]/50 bg-white p-2 text-center">
          <p className="font-accent text-[8px] font-bold tracking-[1px] text-[#C96B3E]">RAPOSA</p>
          <p className="font-handwritten text-[#6A6A7E] text-[10px] leading-tight mt-1">{raposaEstado}</p>
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

/* ============== E11.5 — Plano de Crescimento (COSMIC) ============== */
function PlanoTela({
  loading,
  plano,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  plano: PlanoCrescimento | null;
  error: string | null;
  businessName: string;
  onAjustar: () => void;
  onContinuar: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        {loading && (
          <>
            <p className="font-handwritten text-[#E89770] text-[24px] animate-pulse">
              desenhando seu plano de crescimento...
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

        {!loading && !error && plano && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.95)]">
              ENTREGÁVEL · ETAPA 11 · SUA REDE
            </p>
            <p className="font-handwritten text-[#E89770] text-[28px] mt-4">olha o que você construiu.</p>
            <h1 className="font-serif text-[#FDF8F5] text-[42px] md:text-[52px] leading-[1.1] mt-3">
              Seu plano de crescimento
              <br />
              tá desenhado.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-[rgba(200,169,110,0.3)] bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-[#C96B3E]">
                PLANO DE CRESCIMENTO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Para onde você vai e com quem</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SUA VISÃO
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.visao_refinada}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SUA REDE
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.rede_descrita}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                PRÓXIMO PASSO
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.proximo_passo}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SUA AFIRMAÇÃO DE CRESCIMENTO
              </p>
              <p className="font-handwritten text-[#C96B3E] text-[16px] leading-[24px] mt-2">
                "{plano.afirmacao}"
              </p>

              <p className="font-handwritten text-[rgba(201,107,62,0.85)] text-[14px] mt-5 text-right">
                salvo em Seu Painel Financeiro · você edita quando quiser
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
                Terminar minha jornada  →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== E11.6 — Conclusão FINAL (11 estrelas) ============== */
function Conclusao({ onVerJornada, onVerPainel }: { onVerJornada: () => void; onVerPainel: () => void }) {
  const estrelas = [
    { n: 1, label: "Descoberta" },
    { n: 2, label: "Identidade" },
    { n: 3, label: "Modelo" },
    { n: 4, label: "Presença" },
    { n: 5, label: "Conteúdo" },
    { n: 6, label: "Rotina" },
    { n: 7, label: "Vendas" },
    { n: 8, label: "Clientes" },
    { n: 9, label: "Audiência" },
    { n: 10, label: "Crescimento" },
    { n: 11, label: "Rede", agora: true },
  ];

  const entregaveis = [
    "Voz de Marca",
    "Mapa de Posicionamento",
    "Ficha de Produto",
    "Guia de Primeira Impressão",
    "Sistema de Controle",
    "Roteiro de Fechamento",
    "Protocolo de Cuidado",
    "Plano de Conteúdo",
    "Painel de 3 Números",
    "Plano de Crescimento",
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] flex-col items-center px-6 py-20 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 11 · SUA REDE · CONCLUÍDA
        </p>

        <p className="font-handwritten text-[#E89770] text-[28px] mt-10">
          você chegou até aqui. tudo que você construiu é real.
        </p>

        <h1 className="font-serif text-[#FDF8F5] text-[52px] md:text-[72px] leading-[1.06] mt-3 max-w-[820px]">
          Sua décima primeira estrela
          <br />
          tá acesa.
        </h1>

        <div className="mt-14 flex w-full justify-center gap-5 overflow-x-auto pb-4">
          {estrelas.map((e) => {
            const agora = !!e.agora;
            return (
              <div key={e.n} className="flex w-[68px] shrink-0 flex-col items-center">
                <div className="relative">
                  <span
                    className="text-[34px] leading-none text-[#C96B3E]"
                    style={
                      agora
                        ? {
                            animation: "polia-star-rise 700ms ease-out, polia-glow 1.8s ease-in-out infinite 700ms",
                            display: "inline-block",
                            textShadow: "0 0 24px rgba(232,151,112,0.95)",
                          }
                        : { textShadow: "0 0 14px rgba(201,107,62,0.7)" }
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
                <p className="font-handwritten text-[11px] mt-2 text-[#FDF8F5]">{e.label}</p>
                {agora && (
                  <p className="font-handwritten text-[10px] text-[#E89770] mt-1 animate-pulse">acesa agora</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 w-full max-w-[680px] rounded-[20px] border border-[rgba(200,169,110,0.3)] bg-[rgba(200,169,110,0.1)] p-7 text-left">
          <p className="font-accent text-[9px] font-bold tracking-[2px] text-[#C8A96E] uppercase">
            ATIVADO · LUA ORBITANDO
          </p>
          <p className="font-serif text-[#FDF8F5] text-[24px] mt-2">Seu Painel Financeiro</p>
          <p className="font-sans text-[#D8D2CC] text-[15px] leading-[24px] mt-2">
            Seus números, seu plano de crescimento e sua rede reunidos. Um painel vivo que cresce com você.
          </p>
        </div>

        <hr className="border-[rgba(232,151,112,0.25)] my-14 w-full max-w-[680px]" />

        <h2 className="font-serif text-[#FDF8F5] text-[28px] md:text-[32px] leading-[1.2] max-w-[640px]">
          A Pólia não acaba.
          <br />
          Ela só fica mais sua.
        </h2>

        <p className="font-handwritten text-[#D8D2CC] text-[18px] mt-5 max-w-[600px]">
          você não terminou um curso. você construiu um negócio com intenção.
        </p>

        <div className="mt-14 w-full max-w-[860px]">
          <p className="font-accent text-[10px] font-bold tracking-[2px] text-[#C8A96E] uppercase mb-4">
            SUAS FERRAMENTAS VIVAS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {entregaveis.map((nome, i) => (
              <div key={nome} className="flex items-center gap-3">
                <span className="font-sans text-[13px] text-[#FDF8F5]">{nome}</span>
                {i < entregaveis.length - 1 && (
                  <span className="text-[#E89770]/40">·</span>
                )}
              </div>
            ))}
          </div>
          <p className="font-handwritten text-[rgba(216,210,204,0.7)] text-[14px] mt-4">
            tudo salvo e editável nas suas ferramentas vivas
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-4 md:flex-row">
          <button
            onClick={onVerPainel}
            className="h-[54px] rounded-[12px] border border-[#E89770] bg-transparent px-6 font-sans text-[15px] font-semibold text-[#E89770] hover:bg-[#E89770]/10"
          >
            Ver meu painel
          </button>
          <button
            onClick={onVerJornada}
            className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5] hover:bg-[#B85A2D]"
            style={{ boxShadow: "0 0 28px rgba(201,107,62,0.35)" }}
          >
            Ver minha jornada  →
          </button>
        </div>
      </div>
    </div>
  );
}
