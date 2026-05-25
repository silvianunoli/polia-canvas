import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { PainelNav } from "@/components/painel/PainelNav";
import { gerarPainelNumeros, type PainelNumeros } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/etapa/10")({
  head: () => ({
    meta: [
      { title: "Etapa 10 — Crescimento · Pólia" },
      { name: "description", content: "Monte seu painel de 3 números." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_10_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    if ((profile.etapa_atual ?? 1) < 10) {
      throw redirect({ to: "/painel" });
    }
    if (profile.star_10_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa10Page,
});

type ProfileE10 = {
  display_name: string | null;
  business_name: string | null;
  key_number_1: string | null;
  review_rhythm: string | null;
  action_triggers: string | null;
  growth_finalized_at: string | null;
  star_10_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa10:step";

function Etapa10Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarPainelNumeros);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE10 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [numero, setNumero] = useState("");
  const [ritmo, setRitmo] = useState("");
  const [acao, setAcao] = useState("");

  const [painel, setPainel] = useState<PainelNumeros | null>(null);
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [painelError, setPainelError] = useState<string | null>(null);

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
          "display_name, business_name, key_number_1, review_rhythm, action_triggers, growth_finalized_at, star_10_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE10);
        setNumero(p.key_number_1 ?? "");
        setRitmo(p.review_rhythm ?? "");
        setAcao(p.action_triggers ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE10).growth_finalized_at) {
          setStep(5);
        } else if (p.action_triggers) {
          setStep(4);
        } else if (p.review_rhythm) {
          setStep(4);
        } else if (p.key_number_1) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE10).growth_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "painel_numeros")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setPainel(ent.conteudo as unknown as PainelNumeros);
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
    async (campos: Partial<ProfileE10>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarPainelAcao = useCallback(async () => {
    await autoSave({ action_triggers: acao });
    setStep(5);
    setLoadingPainel(true);
    setPainelError(null);
    const result = await gerar({
      data: {
        key_number_1: numero,
        review_rhythm: ritmo,
        action_triggers: acao,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingPainel(false);
    if (result.error || !result.painel) {
      setPainelError(result.error || "Erro desconhecido.");
      return;
    }
    setPainel(result.painel);
  }, [autoSave, gerar, numero, ritmo, acao, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !painel) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Painel de 3 Números",
      tipo: "painel_numeros",
      fase: "Evolução",
      etapa: 10,
      conteudo: painel as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ growth_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, painel]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_10_completed_at: new Date().toISOString(),
          orbit_financial_unlocked: true,
          etapa_atual: 11,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Décima estrela acesa",
        descricao: "Montou o painel de 3 números. Seu Painel Financeiro desbloqueado.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE11 = [
        "Mapear quem você quer ter por perto no negócio",
        "Listar 2-3 pessoas que te inspiram ou te apoiam",
        "Escrever onde você quer estar daqui a 1 ano",
        "Pensar em quem pode te ajudar a chegar lá",
        "Definir o primeiro passo concreto da sua rede",
      ];
      await supabase.from("tarefas").insert(
        tarefasE11.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 11,
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
              caveat="um número claro vale mais que dez planilhas."
              titulo={<>Qual número diz se o seu negócio tá indo bem?</>}
              label="O QUE MAIS IMPORTA AGORA"
              placeholder="Ex: Faturamento mensal — quero chegar em R$8.000. Também olho quantos pedidos novos chegam por semana. Às vezes olho o número de seguidoras novas, mas sei que não é o que paga as contas. O número que mais me diz se tô crescendo é o faturamento mesmo."
              maxLength={400}
              ajuda="pode ser mais de um. conta o que você já acompanha hoje, mesmo que de forma informal."
              raposaEstado="Atenta · escutando"
              raposaTexto="Não precisa ser sofisticado. O número certo é aquele que, quando muda, você sente no bolso ou na rotina."
              valor={numero}
              setValor={setNumero}
              onAutoSave={() => autoSave({ key_number_1: numero })}
              onContinuar={() => {
                autoSave({ key_number_1: numero });
                setStep(3);
              }}
              minLen={20}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="olhar os números toda semana muda tudo."
              titulo={<>Com que frequência você olha pro seu negócio?</>}
              label="SEU RITMO DE REVISÃO"
              placeholder="Ex: Faço o balanço do mês todo dia 1. Durante o mês, olho só quando bate uma ansiedade. Nunca fiz uma revisão formal — vou no feeling. Gostaria de sentar uma vez por semana pra ver como tá."
              maxLength={300}
              ajuda="conta como é hoje, não o que você acha que deveria fazer."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="15 minutos por semana olhando os mesmos 3 números transforma intuição em decisão."
              valor={ritmo}
              setValor={setRitmo}
              onAutoSave={() => autoSave({ review_rhythm: ritmo })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ review_rhythm: ritmo });
                setStep(4);
              }}
              minLen={15}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="número sem ação é só ansiedade."
              titulo={<>O que você faz quando as coisas mudam?</>}
              label="SEUS GATILHOS DE AÇÃO"
              placeholder="Ex: Quando fico 2 semanas sem pedido novo, começo a postar mais. Se o faturamento cai dois meses seguidos, sei que preciso lançar algo ou fazer promoção. Quando tá cheio, paro de aceitar pedido urgente. Ainda não tenho uma regra clara — reajo quando bate o desespero."
              maxLength={400}
              ajuda="pensa num momento em que o negócio mudou de ritmo. o que você fez?"
              raposaEstado="Animada · em pé"
              raposaTexto="Ter um gatilho definido antes que o problema chegue é a diferença entre reagir e decidir."
              valor={acao}
              setValor={setAcao}
              onAutoSave={() => autoSave({ action_triggers: acao })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarPainelAcao()}
              continuarLabel="Montar meu painel  →"
              minLen={20}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <PainelTela
          loading={loadingPainel}
          painel={painel}
          error={painelError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarPainelAcao()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa11={() => navigate({ to: "/painel" })}
        />
      )}
    </>
  );
}

/* ============== E10.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Número", sub: "o que medir" },
    { num: "2", titulo: "Ritmo", sub: "quando olhar" },
    { num: "3", titulo: "Ação", sub: "o que fazer" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 10 DE 11 · CRESCIMENTO
        </p>

        <div className="mt-10 flex h-[180px] w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#E89770]">PLACEHOLDER · LOGO</p>
          <p className="font-handwritten text-[#E89770] text-[18px] mt-1">Lockup L10 Vertical</p>
          <p className="font-sans text-[10px] text-[rgba(216,210,204,0.55)] mt-1">180×180</p>
        </div>

        <p className="font-handwritten text-[#E89770] text-[26px] mt-10">o que você mede, você move.</p>

        <h1 className="font-serif text-[#FDF8F5] text-[44px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          3 números que
          <br />
          importam hoje.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra escolher o que acompanhar, quando olhar e o que fazer quando muda.
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
          Vamos escolher  →
        </button>

        <p className="font-handwritten text-[rgba(232,151,112,0.75)] text-[18px] mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E10.2-E10.4 ============== */
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
    { num: 1, label: "Número" },
    { num: 2, label: "Ritmo" },
    { num: 3, label: "Ação" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-[#C8A96E] uppercase">
            ETAPA 10 · CRESCIMENTO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            3 números que
            <br />
            importam hoje.
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
            o seu painel de 3 números
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

/* ============== E10.5 — Painel de 3 Números (COSMIC) ============== */
function PainelTela({
  loading,
  painel,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  painel: PainelNumeros | null;
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
              montando seu painel de 3 números...
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

        {!loading && !error && painel && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.95)]">
              ENTREGÁVEL · ETAPA 10 · CRESCIMENTO
            </p>
            <p className="font-handwritten text-[#E89770] text-[28px] mt-4">olha o que você vai acompanhar.</p>
            <h1 className="font-serif text-[#FDF8F5] text-[42px] md:text-[52px] leading-[1.1] mt-3">
              Seu painel de 3 números
              <br />
              tá pronto.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-[rgba(200,169,110,0.3)] bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-[#C96B3E]">
                PAINEL DE 3 NÚMEROS · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">O que você mede pra crescer</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                NÚMERO 1
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {painel.numero_1}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                NÚMERO 2
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {painel.numero_2}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                NÚMERO 3
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {painel.numero_3}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SEU RITMO DE REVISÃO
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {painel.ritmo_recomendado}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                QUANDO AGIR
              </p>
              <p className="font-handwritten text-[#C96B3E] text-[16px] leading-[24px] mt-2">
                {painel.gatilho_principal}
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
                Continuar pra fim da etapa  →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== E10.6 — Conclusão estrela 10 ============== */
function Conclusao({ onVerPainel, onEtapa11 }: { onVerPainel: () => void; onEtapa11: () => void }) {
  const estrelas = [
    { n: 1, label: "Descoberta", estado: "acesa" },
    { n: 2, label: "Identidade", estado: "acesa" },
    { n: 3, label: "Modelo", estado: "acesa" },
    { n: 4, label: "Presença", estado: "acesa" },
    { n: 5, label: "Conteúdo", estado: "acesa" },
    { n: 6, label: "Rotina", estado: "acesa" },
    { n: 7, label: "Vendas", estado: "acesa" },
    { n: 8, label: "Clientes", estado: "acesa" },
    { n: 9, label: "Audiência", estado: "acesa" },
    { n: 10, label: "Crescimento", estado: "agora" },
    { n: 11, label: "Rede", estado: "dim" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] flex-col items-center px-6 py-20 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-[rgba(200,169,110,0.9)]">
          ETAPA 10 · CRESCIMENTO · CONCLUÍDA
        </p>

        <p className="font-handwritten text-[#E89770] text-[28px] mt-10">
          agora você sabe o que olhar e quando agir.
        </p>

        <h1 className="font-serif text-[#FDF8F5] text-[52px] md:text-[72px] leading-[1.06] mt-3 max-w-[820px]">
          Sua décima estrela
          <br />
          tá acesa.
        </h1>

        <div className="mt-14 flex w-full justify-center gap-6 overflow-x-auto pb-4">
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
                  className={`font-handwritten text-[11px] mt-2 ${
                    acesa || agora ? "text-[#FDF8F5]" : "text-[rgba(253,248,245,0.45)]"
                  }`}
                >
                  {e.label}
                </p>
                {agora && (
                  <p className="font-handwritten text-[10px] text-[#E89770] mt-1 animate-pulse">acesa agora</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 w-full max-w-[620px] rounded-[20px] border border-[rgba(200,169,110,0.3)] bg-[rgba(200,169,110,0.1)] p-7 text-left">
          <p className="font-accent text-[9px] font-bold tracking-[2px] text-[#C8A96E] uppercase">
            DESBLOQUEADO · LUA ORBITANDO
          </p>
          <p className="font-serif text-[#FDF8F5] text-[24px] mt-2">Seu Painel Financeiro</p>
          <p className="font-sans text-[#D8D2CC] text-[15px] leading-[24px] mt-2">
            Seus 3 números reunidos num painel vivo. Acompanhe, decida e cresça com clareza.
          </p>
        </div>

        <p className="font-serif text-[#C96B3E] text-[24px] mt-12">A Pólia não acaba. Ela só fica mais sua.</p>

        <p className="font-handwritten text-[rgba(232,151,112,0.85)] text-[16px] mt-3">
          uma etapa pra terminar. e depois, ela é toda sua.
        </p>

        <div className="mt-10 flex flex-col gap-4 md:flex-row">
          <button
            onClick={onVerPainel}
            className="h-[54px] rounded-[12px] border border-[#E89770] bg-transparent px-6 font-sans text-[15px] font-semibold text-[#E89770] hover:bg-[#E89770]/10"
          >
            Ver meu painel
          </button>
          <button
            onClick={onEtapa11}
            className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-[#FDF8F5] hover:bg-[#B85A2D]"
            style={{ boxShadow: "0 0 28px rgba(201,107,62,0.35)" }}
          >
            Começar Etapa 11  →
          </button>
        </div>
      </div>
    </div>
  );
}
