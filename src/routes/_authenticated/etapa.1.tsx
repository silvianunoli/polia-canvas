import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { gerarMiniPitch } from "@/lib/minipitch.functions";

export const Route = createFileRoute("/_authenticated/etapa/1")({
  head: () => ({
    meta: [
      { title: "Etapa 1 · Descoberta · Pólia" },
      { name: "description", content: "Descubra quem você é antes do negócio. Monte seu primeiro mini-pitch." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, star_1_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/onboarding" });
    }
    if (profile?.star_1_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa1Page,
});

type ProfileE1 = {
  display_name: string | null;
  business_name: string | null;
  profile_story: string | null;
  business_why: string | null;
  problem_solved: string | null;
  problem_urgency: string | null;
  target_customer: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa1:step";

function Etapa1Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarMiniPitch);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE1 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [profileStory, setProfileStory] = useState("");
  const [businessWhy, setBusinessWhy] = useState("");
  const [problemSolved, setProblemSolved] = useState("");
  const [problemUrgency, setProblemUrgency] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");

  // Mini-pitch state
  const [miniPitch, setMiniPitch] = useState("");
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      if (!mounted) return;
      setUserId(uid);
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, business_name, profile_story, business_why, problem_solved, problem_urgency, target_customer, streak")
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE1);
        setProfileStory(p.profile_story ?? "");
        setBusinessWhy(p.business_why ?? "");
        setProblemSolved(p.problem_solved ?? "");
        setProblemUrgency(p.problem_urgency ?? "");
        setTargetCustomer(p.target_customer ?? "");
        // Resume step
        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if (p.target_customer) setStep(5);
        else if (p.problem_urgency) setStep(4);
        else if (p.problem_solved) setStep(3);
        else if (p.profile_story) setStep(2);
        else setStep(1);
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist step
  useEffect(() => {
    if (loaded && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(step));
    }
  }, [step, loaded]);

  const autoSave = useCallback(
    async (campos: Partial<ProfileE1>) => {
      if (!userId) return;
      const payload: Partial<ProfileE1> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") (payload as Record<string, string>)[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);

    },
    [userId],
  );


  const salvarEVoltar = useCallback(async () => {
    await autoSave({ profile_story: profileStory, business_why: businessWhy, problem_solved: problemSolved, problem_urgency: problemUrgency, target_customer: targetCustomer });
    navigate({ to: "/painel" });
  }, [autoSave, profileStory, businessWhy, problemSolved, problemUrgency, targetCustomer, navigate]);

  const iniciarGeracaoPitch = useCallback(async () => {
    await autoSave({ target_customer: targetCustomer });
    setStep(5);
    setLoadingPitch(true);
    setPitchError(null);
    const result = await gerar({
      data: {
        profile_story: profileStory || "",
        problem_solved: problemSolved || "",
        target_customer: targetCustomer || "",
      },
    });
    setLoadingPitch(false);
    if (result.error) setPitchError(result.error);
    setMiniPitch(result.minipitch || "");
  }, [autoSave, gerar, profileStory, problemSolved, targetCustomer]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Mini-pitch",
      tipo: "mini_pitch",
      fase: "Sonho",
      etapa: 1,
      conteudo: { texto: miniPitch },
      status: "concluido",
    });
    setStep(6);
  }, [userId, miniPitch]);

  // Conclude etapa 1 on entering step 6
  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_1_completed_at: new Date().toISOString(),
          orbit_brand_alive_unlocked: true,
          etapa_atual: 2,
          streak: (profile?.streak ?? 0) + 1,
        })
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Primeira estrela acesa",
        descricao: "Concluiu a Descoberta e montou seu mini-pitch.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasEtapa2 = [
        "Escolher 3 palavras que definem sua marca",
        "Pesquisar concorrentes diretos",
        "Definir paleta de cores",
        "Escrever sua proposta de valor",
        "Criar avatar da sua cliente ideal",
      ];
      await supabase.from("tarefas").insert(
        tarefasEtapa2.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 2,
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

  // Render
  return (
    <>
      <style>{`@keyframes polia-glow { 0%,100% { box-shadow: 0 0 12px rgba(232,151,112,0.6) } 50% { box-shadow: 0 0 24px rgba(232,151,112,0.95) } }`}</style>
      {step === 1 && <Capa onStart={() => setStep(2)} />}
      {step === 2 && (
        <PerguntaLayout
          step={step}
          profile={profile}
          streak={streak}
          initial={initial}
        >
          <Pergunta1
            profileStory={profileStory}
            setProfileStory={setProfileStory}
            businessWhy={businessWhy}
            setBusinessWhy={setBusinessWhy}
            onAutoSave={autoSave}
            onContinuar={() => {
              autoSave({ profile_story: profileStory, business_why: businessWhy });
              setStep(3);
            }}
            onSalvarVoltar={salvarEVoltar}
          />
        </PerguntaLayout>
      )}
      {step === 3 && (
        <PerguntaLayout step={step} profile={profile} streak={streak} initial={initial}>
          <Pergunta2
            problemSolved={problemSolved}
            setProblemSolved={setProblemSolved}
            problemUrgency={problemUrgency}
            setProblemUrgency={setProblemUrgency}
            onAutoSave={autoSave}
            onContinuar={() => {
              autoSave({ problem_solved: problemSolved, problem_urgency: problemUrgency });
              setStep(4);
            }}
            onSalvarVoltar={salvarEVoltar}
          />
        </PerguntaLayout>
      )}
      {step === 4 && (
        <PerguntaLayout step={step} profile={profile} streak={streak} initial={initial}>
          <Pergunta3
            targetCustomer={targetCustomer}
            setTargetCustomer={setTargetCustomer}
            onAutoSave={autoSave}
            onContinuar={iniciarGeracaoPitch}
            onSalvarVoltar={salvarEVoltar}
          />
        </PerguntaLayout>
      )}
      {step === 5 && (
        <MiniPitchTela
          loading={loadingPitch}
          miniPitch={miniPitch}
          error={pitchError}
          displayName={profile?.display_name ?? ""}
          businessName={profile?.business_name ?? ""}
          streak={streak}
          initial={initial}
          onAjustar={() => setStep(2)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={iniciarGeracaoPitch}
        />
      )}
      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa2={() => navigate({ to: "/painel" })}
        />
      )}
    </>
  );
}

/* ==================== E1.1 — CAPA ==================== */

function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Quem é você", sub: "antes do negócio" },
    { num: "2", titulo: "Qual dor", sub: "você cura" },
    { num: "3", titulo: "Pra quem", sub: "você fala" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 1 DE 11 · DESCOBERTA
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#E89770]">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-[#E89770] mt-1">Lockup L2 Vertical</p>
          <p className="font-sans text-[10px] text-[rgba(216,210,204,0.55)] mt-1">180×180</p>
          <p className="font-sans text-[9px] text-[rgba(216,210,204,0.45)]">SVG · upload no Lovable</p>
        </div>

        <p className="caveat-informacional text-[#E89770] mt-10">
          é hora de descobrir o que tá dentro.
        </p>

        <h1 className="font-serif text-[#FDF8F5] text-[56px] md:text-[72px] leading-[1.05] mt-3 max-w-[900px]">
          Vamos começar pelo começo: você.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[600px]">
          3 perguntas. Sem certo nem errado. Você responde, eu monto seu primeiro mini-pitch.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.num}
              className="w-[200px] rounded-[14px] border border-[rgba(232,151,112,0.3)] bg-[rgba(36,36,66,0.45)] p-[22px] text-center"
            >
              <p className="font-accent text-[#C8A96E] text-[12px] font-bold tracking-[1.5px]">{c.num}</p>
              <p className="font-serif text-[#FDF8F5] text-[18px] mt-2">{c.titulo}</p>
              <p className="font-sans text-[rgba(216,210,204,0.65)] text-[12px] mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-10 md:mt-14 relative h-[56px] rounded-[14px] bg-[#C96B3E] px-10 font-sans text-[16px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
          style={{ boxShadow: "0 0 24px rgba(201,107,62,0.35)" }}
        >
          Começar →
        </button>

        <p className="caveat-decorativo text-[rgba(216,210,204,0.6)] mt-4">
          leva uns 10 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ==================== Layout das perguntas (E1.2/3/4) ==================== */

function PerguntaLayout({
  step,
  profile,
  streak,
  initial,
  children,
}: {
  step: number;
  profile: ProfileE1 | null;
  streak: number;
  initial: string;
  children: React.ReactNode;
}) {
  const passos = [
    { num: 1, label: "Quem é você antes do negócio", estado: "atual" },
    { num: 2, label: "Qual dor você cura", estado: "logo logo" },
    { num: 3, label: "Pra quem você fala", estado: "ainda" },
  ];
  const activeIndex = step - 2; // 0,1,2

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <EtapaNav streak={streak} initial={initial} />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        {/* Sidebar esquerda */}
        <aside className="hidden w-[290px] shrink-0 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E] uppercase">
            ETAPA 1 · DESCOBERTA
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[32px] leading-[38px] mt-2">
            Quem você é.
            <br />
            Quem você quer alcançar.
          </h2>
          <hr className="border-[#EAE2D8] my-6" />
          <div className="flex flex-col gap-4">
            {passos.map((p, i) => {
              const isActive = i === activeIndex;
              const isDone = i < activeIndex;
              return (
                <div key={p.num} className="flex items-start gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-sans text-[12px] font-bold text-white ${
                      isDone ? "bg-[#2D6A4F]" : isActive ? "bg-[#C96B3E]" : "bg-[#E0D8CF]"
                    }`}
                  >
                    {isDone ? "✓" : p.num}
                  </div>
                  <div>
                    <p
                      className={`font-sans text-[14px] leading-[18px] ${
                        isActive ? "text-[#1A1A2E] font-semibold" : "text-[#6A6A7E]"
                      }`}
                    >
                      {p.label}
                    </p>
                    <p className="caveat-decorativo text-[#C96B3E] mt-1">
                      {isDone ? "feito" : isActive ? "atual" : p.estado}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="caveat-decorativo text-[rgba(106,106,126,0.7)] mt-8">
            depois vem o seu mini-pitch
          </p>
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 min-w-0 max-w-[680px]">{children}</main>

        {/* Sidebar direita */}
        <aside className="hidden w-[240px] shrink-0 xl:block">
          <RaposaECard step={step} />
        </aside>
      </div>
    </div>
  );
}

function EtapaNav({ streak, initial }: { streak: number; initial: string }) {
  const links = [
    { label: "Painel", href: "/painel", active: false },
    { label: "Jornada", href: "/etapa/1", active: true },
    { label: "Tarefas", href: "/painel", active: false },
    { label: "Clientes", href: "/painel", active: false },
    { label: "Financeiro", href: "/painel", active: false },
  ];
  return (
    <header className="sticky top-0 z-30 h-14 w-full bg-[#FDF8F5]" style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}>
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#C96B3E] px-4 py-1.5">
          <span className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#C8A96E]">PLACEHOLDER · LOGO</span>
          <span className="font-sans text-[8px] text-[#1A1A2E] opacity-40">120×32</span>
        </div>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={
                l.active
                  ? "flex items-center gap-1.5 border-b-2 border-[#C96B3E] pb-[2px] font-sans text-[14px] font-medium text-[#C96B3E]"
                  : "font-sans text-[14px] font-medium text-[#1A1A2E] opacity-60 transition hover:opacity-100"
              }
            >
              {l.active && <span className="h-1.5 w-1.5 rounded-full bg-[#C96B3E]" />}
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: "rgba(200,169,110,0.12)", border: "1px solid rgba(200,169,110,0.3)" }}>
            <span className="font-sans text-[13px] font-semibold text-[#C8A96E]">{streak} {streak === 1 ? "dia" : "dias"}</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C96B3E] font-sans text-[14px] font-bold text-[#FDF8F5]">{initial}</div>
        </div>
      </div>
    </header>
  );
}

function RaposaECard({ step }: { step: number }) {
  const estados: Record<number, { estado: string; pose: string; titulo: string; body: string }> = {
    2: { estado: "Atenta", pose: "sentada escutando", titulo: "Sua história não precisa ser épica.", body: "Conta o que te incomodava antes, o que te chamou pra esse caminho, e o que você descobriu sobre você fazendo isso." },
    3: { estado: "Curiosa", pose: "cabeça inclinada, olhos atentos", titulo: "Especificidade vence eloquência.", body: "Quanto mais específica a dor, mais o cliente se reconhece. 'Tô cansada' é fraco. 'Termino o dia sem saber se trabalhei ou só apaguei incêndio' é forte." },
    4: { estado: "Animada", pose: "em pé, empolgada", titulo: "Nicho não é limitação.", body: "Quanto mais você fala com uma pessoa específica, mais pessoas se reconhecem. Isso é contra-intuitivo, mas é verdade." },
  };
  const s = estados[step] ?? estados[2];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[rgba(232,151,112,0.5)] bg-[#FAF4EF] px-[18px] py-[22px]">
        <p className="font-accent text-[#C96B3E] text-[10px] font-bold tracking-[1.5px]">PLACEHOLDER · RAPOSA</p>
        <p className="caveat-informacional text-[#C96B3E]">Estado: {s.estado}</p>
        <p className="font-sans text-[#6A6A7E] text-[10px]">PNG transparente · 200×260</p>
        <p className="font-sans text-[#9A958E] text-[9px]">Pose: {s.pose}</p>
      </div>
      <div className="rounded-[18px] border border-[#EAE2D8] bg-white p-[22px]">
        <p className="font-accent text-[#C8A96E] text-[10px] font-bold tracking-[1.5px] uppercase mb-3">DICA RÁPIDA</p>
        <p className="font-serif text-[#1A1A2E] text-[17px] leading-[22px] mb-2">{s.titulo}</p>
        <p className="font-sans text-[#6A6A7E] text-[12px] leading-[17px]">{s.body}</p>
      </div>
    </div>
  );
}

/* ==================== Componentes de pergunta ==================== */

function Footer({
  podeAvancar,
  onContinuar,
  onSalvarVoltar,
}: {
  podeAvancar: boolean;
  onContinuar: () => void;
  onSalvarVoltar: () => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      <div>
        <button onClick={onSalvarVoltar} className="font-sans text-[14px] text-[#6A6A7E] transition-colors hover:text-[#1A1A2E]">
          Salvar e voltar depois
        </button>
        <p className="font-sans text-[#9A958E] text-[12px] mt-1">↻ salvo automaticamente</p>
      </div>
      <button
        onClick={onContinuar}
        disabled={!podeAvancar}
        className={`relative h-[48px] w-[200px] rounded-[12px] font-sans text-[15px] font-semibold text-white transition-all ${
          podeAvancar ? "bg-[#C96B3E] hover:bg-[#B85A2D]" : "bg-[#C96B3E] opacity-40 cursor-not-allowed"
        }`}
      >
        Continuar →
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[10px] font-semibold uppercase tracking-[1.5px] text-[#6A6A7E] mb-2">{children}</p>;
}

function HeadlineDuas({ a, b }: { a: string; b: string }) {
  return (
    <div className="font-serif text-[#1A1A2E] text-[26px] sm:text-[32px] md:text-[48px] leading-[1.2] mt-3">
      <p>{a}</p>
      <p>{b}</p>
    </div>
  );
}

function useDebouncedBlur<T>(value: T, save: (v: T) => void, delay = 800) {
  return () => {
    const t = setTimeout(() => save(value), delay);
    return () => clearTimeout(t);
  };
}

function Pergunta1({
  profileStory,
  setProfileStory,
  businessWhy,
  setBusinessWhy,
  onAutoSave,
  onContinuar,
  onSalvarVoltar,
}: {
  profileStory: string;
  setProfileStory: (v: string) => void;
  businessWhy: string;
  setBusinessWhy: (v: string) => void;
  onAutoSave: (c: { profile_story?: string; business_why?: string; problem_solved?: string; problem_urgency?: string; target_customer?: string; }) => void;
  onContinuar: () => void;
  onSalvarVoltar: () => void;
}) {
  const pode = profileStory.length >= 30;
  return (
    <>
      <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E]">PERGUNTA 1 DE 3</p>
      <p className="caveat-decorativo text-[#C96B3E] mt-3">vamos com calma. responde como conversaria com uma amiga.</p>
      <HeadlineDuas a="Quem é você" b="antes do negócio?" />
      <p className="font-sans text-[#6A6A7E] text-[15px] leading-[24px] mt-4">
        Sua história, o que te trouxe até aqui, o que você ama fazer mesmo se ninguém pagasse.
      </p>

      <div className="mt-7">
        <Label>SUA HISTÓRIA EM POUCAS LINHAS</Label>
        <textarea
          value={profileStory}
          onChange={(e) => setProfileStory(e.target.value)}
          onBlur={() => onAutoSave({ profile_story: profileStory })}
          maxLength={800}
          rows={6}
          placeholder="Pode escrever do jeito que pensa. Eu organizo depois."
          className="w-full rounded-[14px] border-[1.5px] border-[#EAE2D8] bg-white px-[18px] py-[14px] font-sans text-[14px] text-[#1A1A2E] placeholder:text-[rgba(154,149,142,0.7)] focus:outline-none focus:border-[#C96B3E] transition-colors resize-none"
        />
        <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-2 mb-5">
          não precisa ser perfeito. é só pra eu te conhecer.
        </p>
      </div>

      <div className="mt-2">
        <Label>POR QUE ESSE NEGÓCIO E NÃO OUTRO?</Label>
        <input
          type="text"
          value={businessWhy}
          onChange={(e) => setBusinessWhy(e.target.value)}
          onBlur={() => onAutoSave({ business_why: businessWhy })}
          maxLength={200}
          placeholder="Em uma frase. O que tem nessa coisa que só você poderia fazer?"
          className="w-full h-[60px] rounded-[14px] border-[1.5px] border-[#EAE2D8] bg-white px-[18px] font-sans text-[14px] text-[#1A1A2E] placeholder:text-[rgba(154,149,142,0.7)] focus:outline-none focus:border-[#C96B3E] transition-colors"
        />
      </div>

      <Footer podeAvancar={pode} onContinuar={onContinuar} onSalvarVoltar={onSalvarVoltar} />
    </>
  );
}

function Pergunta2({
  problemSolved,
  setProblemSolved,
  problemUrgency,
  setProblemUrgency,
  onAutoSave,
  onContinuar,
  onSalvarVoltar,
}: {
  problemSolved: string;
  setProblemSolved: (v: string) => void;
  problemUrgency: string;
  setProblemUrgency: (v: string) => void;
  onAutoSave: (c: { profile_story?: string; business_why?: string; problem_solved?: string; problem_urgency?: string; target_customer?: string; }) => void;
  onContinuar: () => void;
  onSalvarVoltar: () => void;
}) {
  const pode = problemSolved.length >= 30;
  return (
    <>
      <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E]">PERGUNTA 2 DE 3</p>
      <p className="caveat-decorativo text-[#C96B3E] mt-3">essa é a parte que mais importa. pensa em quem vai sentir falta.</p>
      <HeadlineDuas a="Qual dor" b="você cura?" />
      <p className="font-sans text-[#6A6A7E] text-[15px] leading-[24px] mt-4">
        O que tá errado no mundo do seu cliente antes de você entrar nele? Por que isso é importante o suficiente pra ele resolver?
      </p>

      <div className="mt-7">
        <Label>A DOR EM POUCAS PALAVRAS</Label>
        <textarea
          value={problemSolved}
          onChange={(e) => setProblemSolved(e.target.value)}
          onBlur={() => onAutoSave({ problem_solved: problemSolved })}
          maxLength={400}
          rows={5}
          placeholder="Ex: Mulher na faixa dos 30 que abriu negócio próprio, ama o que faz, mas se sente perdida porque tudo que aprende online é genérico, gringo, ou pra empresa grande."
          className="w-full rounded-[14px] border-[1.5px] border-[#EAE2D8] bg-white px-[18px] py-[14px] font-sans text-[14px] text-[#1A1A2E] placeholder:text-[rgba(154,149,142,0.7)] focus:outline-none focus:border-[#C96B3E] transition-colors resize-none"
        />
        <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-2 mb-5">não tem dor errada. tem dor não-vista.</p>
      </div>

      <div className="mt-2">
        <Label>POR QUE ESSA DOR PRECISA DE SOLUÇÃO AGORA?</Label>
        <input
          type="text"
          value={problemUrgency}
          onChange={(e) => setProblemUrgency(e.target.value)}
          onBlur={() => onAutoSave({ problem_urgency: problemUrgency })}
          maxLength={200}
          placeholder="O que muda na vida do seu cliente se essa dor não for resolvida nos próximos 6 meses?"
          className="w-full h-[60px] rounded-[14px] border-[1.5px] border-[#EAE2D8] bg-white px-[18px] font-sans text-[14px] text-[#1A1A2E] placeholder:text-[rgba(154,149,142,0.7)] focus:outline-none focus:border-[#C96B3E] transition-colors"
        />
      </div>

      <Footer podeAvancar={pode} onContinuar={onContinuar} onSalvarVoltar={onSalvarVoltar} />
    </>
  );
}

function Pergunta3({
  targetCustomer,
  setTargetCustomer,
  onAutoSave,
  onContinuar,
  onSalvarVoltar,
}: {
  targetCustomer: string;
  setTargetCustomer: (v: string) => void;
  onAutoSave: (c: { profile_story?: string; business_why?: string; problem_solved?: string; problem_urgency?: string; target_customer?: string; }) => void;
  onContinuar: () => void;
  onSalvarVoltar: () => void;
}) {
  const pode = targetCustomer.length >= 20;
  return (
    <>
      <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E]">PERGUNTA 3 DE 3</p>
      <p className="caveat-decorativo text-[#C96B3E] mt-3">pensa numa pessoa real. alguém que você conheça ou imagina conhecer.</p>
      <HeadlineDuas a="Pra quem" b="você fala?" />
      <p className="font-sans text-[#6A6A7E] text-[15px] leading-[24px] mt-4">
        Quem é a pessoa que você quer ajudar? Quanto mais específica, mais fácil eu monto seu mini-pitch.
      </p>

      <div className="mt-7">
        <Label>SUA CLIENTE IDEAL</Label>
        <textarea
          value={targetCustomer}
          onChange={(e) => setTargetCustomer(e.target.value)}
          onBlur={() => onAutoSave({ target_customer: targetCustomer })}
          maxLength={400}
          rows={5}
          placeholder="Ex: Mãe de 2 filhos, 35 anos, que vende artesanato no Instagram mas cobra barato porque tem medo de assustar os seguidores. Ama o que faz mas não se sente 'profissional' ainda."
          className="w-full rounded-[14px] border-[1.5px] border-[#EAE2D8] bg-white px-[18px] py-[14px] font-sans text-[14px] text-[#1A1A2E] placeholder:text-[rgba(154,149,142,0.7)] focus:outline-none focus:border-[#C96B3E] transition-colors resize-none"
        />
        <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-2">
          se vier mais de uma pessoa na cabeça, escolhe a que você mais quer ajudar.
        </p>
      </div>

      <Footer podeAvancar={pode} onContinuar={onContinuar} onSalvarVoltar={onSalvarVoltar} />
    </>
  );
}

/* ==================== E1.5 — Mini-pitch ==================== */

function MiniPitchTela({
  loading,
  miniPitch,
  error,
  displayName,
  businessName,
  streak,
  initial,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  miniPitch: string;
  error: string | null;
  displayName: string;
  businessName: string;
  streak: number;
  initial: string;
  onAjustar: () => void;
  onContinuar: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <EtapaNav streak={streak} initial={initial} />
      <div className="mx-auto max-w-[860px] px-6 py-10 md:py-16">
        <p className="font-accent text-[10px] font-bold tracking-[2px] text-[#C8A96E] uppercase text-center">
          ETAPA 1 · DESCOBERTA
        </p>
        <p className="caveat-informacional text-[#C96B3E] text-center mt-2">olha o que a gente montou juntas.</p>
        <h2 className="font-serif text-[#1A1A2E] text-[28px] sm:text-[34px] md:text-[48px] leading-[1.2] text-center mt-2">
          Seu primeiro mini-pitch.
        </h2>
        <p className="font-sans text-[#6A6A7E] text-[15px] text-center mt-3 mx-auto max-w-[600px]">
          É um rascunho. Você pode ajustar. Mas já é seu.
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 w-3 rounded-full bg-[#C96B3E]"
                  style={{ animation: `polia-bounce 1s infinite ${i * 0.15}s`, animationName: "bounce" }}
                />
              ))}
            </div>
            <style>{`@keyframes bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }`}</style>
            <p className="caveat-informacional text-[#C96B3E] mt-6">montando seu mini-pitch...</p>
            <p className="font-sans text-[#9A958E] text-[14px] mt-2">uns 5 segundinhos</p>
          </div>
        ) : (
          <div className="mt-10 rounded-[24px] border border-[#EAE2D8] bg-white p-[32px] md:p-[48px] shadow-sm">
            <p className="font-accent text-[#C9407A] text-[10px] font-bold tracking-[1.5px] uppercase mb-4">DESCOBERTA · ETAPA 1</p>
            {error ? (
              <>
                <p className="font-serif text-[#1A1A2E] text-[22px] leading-[30px]">{error}</p>
                <button onClick={onRetry} className="mt-6 h-[44px] rounded-[12px] bg-[#C96B3E] px-6 font-sans text-[14px] font-semibold text-white hover:bg-[#B85A2D] transition-colors">
                  Tentar de novo
                </button>
              </>
            ) : (
              <>
                <p className="font-serif text-[#1A1A2E] text-[22px] md:text-[24px] leading-[1.4] whitespace-pre-line">
                  {miniPitch}
                </p>
                <p className="font-sans text-[#9A958E] text-[12px] mt-6">
                  {displayName || "você"} · {businessName || "seu negócio"}
                </p>
              </>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
            <button
              onClick={onAjustar}
              className="h-[48px] rounded-[12px] border-[1.5px] border-[#C96B3E] px-6 font-sans text-[15px] font-semibold text-[#C96B3E] transition-colors hover:bg-[rgba(201,107,62,0.06)]"
            >
              Ajustar respostas
            </button>
            <button
              onClick={onContinuar}
              className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[16px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
            >
              Continuar pro fim da etapa →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== E1.6 — Conclusão ==================== */

const ETAPAS_CONST = [
  { num: 1, nome: "Descoberta", ativa: true },
  { num: 2, nome: "Identidade", ativa: false },
  { num: 3, nome: "Modelo de Negócio", ativa: false },
  { num: 4, nome: "Presença digital", ativa: false },
  { num: 5, nome: "Conteúdo", ativa: false },
  { num: 6, nome: "Sua rotina", ativa: false },
  { num: 7, nome: "Suas vendas", ativa: false },
  { num: 8, nome: "Seus clientes", ativa: false },
  { num: 9, nome: "Sua audiência", ativa: false },
  { num: 10, nome: "Crescimento", ativa: false },
  { num: 11, nome: "Sua rede", ativa: false },
];

function Conclusao({ onVerPainel, onEtapa2 }: { onVerPainel: () => void; onEtapa2: () => void }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.95)]">
          ETAPA 1 · DESCOBERTA · CONCLUÍDA
        </p>
        <p className="caveat-informacional text-[#E89770] mt-6">olha o que aconteceu agora.</p>
        <div className="font-serif text-[#FDF8F5] text-[52px] md:text-[72px] leading-[1.1] mt-2 max-w-[900px]">
          <p>Sua primeira estrela</p>
          <p>tá acesa.</p>
        </div>

        {/* Constelação */}
        <div className="mt-12 flex flex-wrap items-start justify-center gap-x-5 gap-y-6 md:gap-x-7">
          {ETAPAS_CONST.map((e) => (
            <div key={e.num} className="flex w-[80px] flex-col items-center gap-1">
              <div
                className={`${e.ativa ? "h-[20px] w-[20px] bg-[#E89770]" : "h-[14px] w-[14px] bg-[rgba(216,210,204,0.35)]"} rotate-45 transition-all`}
                style={e.ativa ? { animation: "polia-glow 2s ease-in-out infinite", boxShadow: "0 0 12px rgba(232,151,112,0.6)" } : undefined}
              />
              <p className={`font-sans text-[10px] font-semibold ${e.ativa ? "text-[#E89770]" : "text-[rgba(216,210,204,0.5)]"}`}>{e.num}</p>
              <p className={`font-sans text-[9px] leading-[11px] text-center max-w-[80px] ${e.ativa ? "text-[#FDF8F5]" : "text-[rgba(216,210,204,0.55)]"}`}>{e.nome}</p>
              {e.ativa && <p className="caveat-decorativo text-[#E89770]">acesa pra sempre</p>}
            </div>
          ))}
        </div>

        {/* Card desbloqueio */}
        <div className="mt-10 md:mt-14 w-full max-w-[560px] rounded-[20px] border border-[rgba(232,151,112,0.35)] bg-[rgba(36,36,66,0.55)] p-7 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(232,151,112,0.6)]">
              <div className="h-3 w-3 rounded-full bg-[#E89770]" style={{ boxShadow: "0 0 12px rgba(232,151,112,0.8)" }} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E]">DESBLOQUEADO · LUA ORBITANDO</p>
              <p className="font-serif text-[#FDF8F5] text-[22px] mt-1">Sua Marca Viva</p>
              <p className="font-sans text-[rgba(216,210,204,0.75)] text-[13px] leading-[18px] mt-1">
                Logo, cores, voz e manifesto. Sempre disponível no céu, vive com você.
              </p>
            </div>
          </div>
        </div>

        {/* Mantra */}
        <p className="caveat-informacional text-[#FDF8F5] mt-10 md:mt-14">A Pólia não acaba. Ela só fica mais sua.</p>
        <p className="font-sans text-[rgba(216,210,204,0.6)] text-[13px] mt-2">cada vez que você volta, encontra mais de você aqui</p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-4 md:flex-row md:gap-5">
          <button
            onClick={onVerPainel}
            className="h-[48px] rounded-[12px] border border-[rgba(216,210,204,0.4)] px-6 font-sans text-[14px] font-medium text-[#FDF8F5] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          >
            Ver meu painel
          </button>
          <button
            onClick={onEtapa2}
            className="h-[54px] rounded-[14px] bg-[#C96B3E] px-8 font-sans text-[16px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
            style={{ boxShadow: "0 0 24px rgba(201,107,62,0.4)" }}
          >
            Começar Etapa 2 →
          </button>
        </div>
      </div>
    </div>
  );
}
