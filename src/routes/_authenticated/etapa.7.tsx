import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarRoteiroFechamento, type RoteiroFechamento } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/etapa/7")({
  head: () => ({
    meta: [
      { title: "Etapa 7 · Suas Vendas · Pólia" },
      { name: "description", content: "Monte seu fluxo de vendas do primeiro contato ao sim." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_7_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    if ((profile.etapa_atual ?? 1) < 7) {
      throw redirect({ to: "/painel" });
    }
    if (profile.star_7_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa7Page,
});

type ProfileE7 = {
  display_name: string | null;
  business_name: string | null;
  awareness_source: string | null;
  decision_trigger: string | null;
  closing_method: string | null;
  sales_finalized_at: string | null;
  star_7_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa7:step";

function Etapa7Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarRoteiroFechamento);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE7 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [descoberta, setDescoberta] = useState("");
  const [decisao, setDecisao] = useState("");
  const [fechamento, setFechamento] = useState("");

  const [roteiro, setRoteiro] = useState<RoteiroFechamento | null>(null);
  const [loadingRoteiro, setLoadingRoteiro] = useState(false);
  const [roteiroError, setRoteiroError] = useState<string | null>(null);

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
          "display_name, business_name, awareness_source, decision_trigger, closing_method, sales_finalized_at, star_7_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE7);
        setDescoberta(p.awareness_source ?? "");
        setDecisao(p.decision_trigger ?? "");
        setFechamento(p.closing_method ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE7).sales_finalized_at) {
          setStep(5);
        } else if (p.closing_method) {
          setStep(4);
        } else if (p.decision_trigger) {
          setStep(4);
        } else if (p.awareness_source) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE7).sales_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "roteiro_fechamento")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setRoteiro(ent.conteudo as unknown as RoteiroFechamento);
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
    async (campos: Partial<ProfileE7>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarRoteiroAcao = useCallback(async () => {
    await autoSave({ closing_method: fechamento });
    setStep(5);
    setLoadingRoteiro(true);
    setRoteiroError(null);
    const result = await gerar({
      data: {
        awareness_source: descoberta,
        decision_trigger: decisao,
        closing_method: fechamento,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingRoteiro(false);
    if (result.error || !result.roteiro) {
      setRoteiroError(result.error || "Erro desconhecido.");
      return;
    }
    setRoteiro(result.roteiro);
  }, [autoSave, gerar, descoberta, decisao, fechamento, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !roteiro) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Roteiro de Fechamento",
      tipo: "roteiro_fechamento",
      fase: "Venda",
      etapa: 7,
      conteudo: roteiro as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ sales_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, roteiro]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_7_completed_at: new Date().toISOString(),
          orbit_sales_unlocked: true,
          etapa_atual: 8,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Suas vendas abertas",
        descricao: "Montou o roteiro de fechamento. Suas Vendas e Clientes está desbloqueado.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE8 = [
        "Criar protocolo de boas-vindas pra nova cliente",
        "Definir tempo de resposta padrão",
        "Escrever FAQ das dúvidas mais comuns",
        "Montar fluxo de acompanhamento pós-venda",
        "Definir como pedir avaliação sem constranger",
      ];
      await supabase.from("tarefas").insert(
        tarefasE8.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 8,
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
        <p className="caveat-informacional text-polia-terracota">carregando...</p>
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
              caveat="toda venda começa com uma descoberta."
              titulo={<>Como a cliente chega até você?</>}
              label="COMO ELA TE DESCOBRE"
              placeholder="Ex: Maioria vem pelo Instagram. Algumas por indicação de quem já comprou. Umas poucas pelo Google quando pesquisam 'convite de casamento SP'. Indicação converte muito mais rápido."
              maxLength={300}
              ajuda="pode ter mais de um canal. conta o que você percebe na prática."
              raposaEstado="Atenta · escutando"
              raposaTexto="O canal onde ela te descobre diz muito sobre o que a convence. Indicação pede um fluxo. Instagram pede outro."
              valor={descoberta}
              setValor={setDescoberta}
              onAutoSave={() => autoSave({ awareness_source: descoberta })}
              onContinuar={() => {
                autoSave({ awareness_source: descoberta });
                setStep(3);
              }}
              minLen={15}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="entre o interesse e o sim, tem um momento decisivo."
              titulo={<>O que faz ela decidir comprar?</>}
              label="O QUE A CONVENCE"
              placeholder="Ex: Quando vê o portfólio ela já começa a imaginar. O que fecha mesmo é quando mando exemplos parecidos com o estilo da festa dela. Às vezes uma cliente me marca num story de casamento que amou e pronto, ela já está convencida."
              maxLength={400}
              ajuda="pensa numa venda recente que fechou rápido. o que aconteceu antes do sim?"
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="O gatilho de decisão é onde você deve concentrar sua energia de vendas. Vale ouro entender esse momento."
              valor={decisao}
              setValor={setDecisao}
              onAutoSave={() => autoSave({ decision_trigger: decisao })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ decision_trigger: decisao });
                setStep(4);
              }}
              minLen={20}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="a arte de fechar é deixar o próximo passo óbvio."
              titulo={<>Como você finaliza a venda?</>}
              label="SEU JEITO DE FECHAR"
              placeholder="Ex: Mando o orçamento pelo WhatsApp com prazo de 48h pra confirmar. Peço 50% de sinal via Pix pra garantir a data. Quando a cliente demora, mando uma mensagem gentil lembrando a disponibilidade."
              maxLength={300}
              ajuda="inclui como você manda o orçamento, como recebe o pagamento e como confirma o pedido."
              raposaEstado="Animada · em pé"
              raposaTexto="Deixar a próxima ação clara elimina o 'vou pensar' e transforma interesse em venda."
              valor={fechamento}
              setValor={setFechamento}
              onAutoSave={() => autoSave({ closing_method: fechamento })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarRoteiroAcao()}
              continuarLabel="Montar meu roteiro  →"
              minLen={15}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <RoteiroTela
          loading={loadingRoteiro}
          roteiro={roteiro}
          error={roteiroError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarRoteiroAcao()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa8={() => navigate({ to: "/etapa/8" })}
        />
      )}
    </>
  );
}

/* ============== E7.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Encontro", sub: "como ela chega até você" },
    { num: "2", titulo: "Decisão", sub: "o que a faz querer" },
    { num: "3", titulo: "Fechamento", sub: "como ela compra" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 7 DE 11 · SUAS VENDAS
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L7 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">aqui é onde o dinheiro entra.</p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Como ela decide
          <br />
          e fecha.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra montar seu fluxo de vendas do primeiro contato ao sim.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.num}
              className="w-[220px] rounded-[14px] border border-[rgba(232,151,112,0.3)] bg-white p-[20px] text-center"
            >
              <p className="font-serif text-polia-terracota text-[30px] leading-none">{c.num}</p>
              <p className="font-serif text-polia-marrom text-[20px] mt-2">{c.titulo}</p>
              <p className="caveat-decorativo text-polia-marrom/80 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-10 md:mt-14 relative h-[58px] rounded-[12px] bg-[#C96B3E] px-10 font-sans text-[18px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D]"
          style={{ boxShadow: "0 0 24px rgba(201,107,62,0.35)" }}
        >
          Vamos montar meu fluxo  →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E7.2-E7.4 ============== */
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
    { num: 1, label: "Encontro" },
    { num: 2, label: "Decisão" },
    { num: 3, label: "Fechamento" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={7} fase="VENDA" nome="Suas vendas" variant="light" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 7 · SUAS VENDAS
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Do primeiro contato
            <br />
            ao sim.
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
                        ? "bg-[#C96B3E] text-polia-creme"
                        : feito
                          ? "bg-[#C96B3E]/30 text-polia-terracota"
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
            o seu roteiro de fechamento
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
      <p className="caveat-informacional text-polia-terracota mt-2">{caveat}</p>
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
          <p className="font-accent text-[8px] font-bold tracking-[1px] text-polia-terracota">RAPOSA</p>
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
          className="h-[52px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-polia-creme transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-[#B85A2D]"
        >
          {continuarLabel}
        </button>
      </div>
    </div>
  );
}

/* ============== E7.5 — Roteiro de Fechamento (COSMIC) ============== */
function RoteiroTela({
  loading,
  roteiro,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  roteiro: RoteiroFechamento | null;
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
            <p className="caveat-informacional text-polia-terracota animate-pulse">
              desenhando seu roteiro de fechamento...
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
            <p className="font-serif text-polia-marrom text-[28px]">Algo deu errado.</p>
            <p className="font-sans text-polia-marrom/80 text-[14px] mt-2">{error}</p>
            <button
              onClick={onRetry}
              className="mt-6 h-[48px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-polia-creme"
            >
              Tenta de novo
            </button>
          </>
        )}

        {!loading && !error && roteiro && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 7 · SUAS VENDAS
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">olha seu roteiro pronto.</p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Seu roteiro de fechamento
              <br />
              tá desenhado.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                ROTEIRO DE FECHAMENTO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Do primeiro contato ao sim</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                1. COMO ELA TE DESCOBRE
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {roteiro.passo_descoberta}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                2. O QUE A CONVENCE
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {roteiro.passo_decisao}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                3. COMO VOCÊ FECHA
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {roteiro.passo_fechamento}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SUA MENSAGEM DE FECHAMENTO SUGERIDA
              </p>
              <p className="caveat-decorativo text-polia-terracota leading-[26px] mt-2">
                &ldquo;{roteiro.mensagem_fechamento}&rdquo;
              </p>

              <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-5 text-right">
                salvo em Suas Vendas e Clientes · você edita quando quiser
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4 md:flex-row">
              <button
                onClick={onAjustar}
                className="h-[54px] rounded-[12px] border border-polia-terracota bg-transparent px-6 font-sans text-[15px] font-semibold text-polia-terracota hover:bg-[#E89770]/10"
              >
                Ajustar respostas
              </button>
              <button
                onClick={onContinuar}
                className="h-[54px] rounded-[12px] bg-[#C96B3E] px-8 font-sans text-[15px] font-semibold text-polia-creme hover:bg-[#B85A2D]"
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

/* ============== E7.6 — Conclusão marco 7 + Suas Vendas e Clientes desbloqueado ============== */
function Conclusao({ onVerPainel, onEtapa8 }: { onVerPainel: () => void; onEtapa8: () => void }) {
  return (
    <ConclusaoEtapa
      numero={7}
      nomeEtapa="Suas vendas"
      palavraHighlight="Vendas"
      palavraMarco="VENDAS"
      ferramentaDesbloqueada={{
        titulo: "Suas Vendas e Clientes",
        descricao: "Onde você acompanha pedidos, organiza clientes e gerencia sua agenda de atendimento.",
      }}
      proximaEtapaLabel="Começar Etapa 8 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa8}
    />
  );
}
