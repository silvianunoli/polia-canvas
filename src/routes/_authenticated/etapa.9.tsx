import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarPlanoConteudo, type PlanoConteudo } from "@/lib/content.functions";

export const Route = createFileRoute("/_authenticated/etapa/9")({
  head: () => ({
    meta: [
      { title: "Etapa 9 · Sua Audiência · Pólia" },
      { name: "description", content: "Monte seu plano de conteúdo." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_9_completed_at, star_8_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    // Acessivel se a etapa anterior foi concluida (ou se essa etapa ja foi concluida — modo leitura)
    const anteriorOk = !!(profile as Record<string, unknown>)["star_8_completed_at"];
    const essaOk = !!(profile as Record<string, unknown>)["star_9_completed_at"];
    if (!anteriorOk && !essaOk) {
      throw redirect({ to: "/painel" });
    }
},
  component: Etapa9Page,
});

type ProfileE9 = {
  display_name: string | null;
  business_name: string | null;
  audience_content_types: string | null;
  scroll_stoppers: string | null;
  publishing_rhythm: string | null;
  content_finalized_at: string | null;
  star_9_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa9:step";

function Etapa9Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarPlanoConteudo);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE9 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [consumo, setConsumo] = useState("");
  const [parada, setParada] = useState("");
  const [ritmo, setRitmo] = useState("");

  const [plano, setPlano] = useState<PlanoConteudo | null>(null);
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
          "display_name, business_name, audience_content_types, scroll_stoppers, publishing_rhythm, content_finalized_at, star_9_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE9);
        setConsumo(p.audience_content_types ?? "");
        setParada(p.scroll_stoppers ?? "");
        setRitmo(p.publishing_rhythm ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE9).content_finalized_at) {
          setStep(5);
        } else if (p.publishing_rhythm) {
          setStep(4);
        } else if (p.scroll_stoppers) {
          setStep(4);
        } else if (p.audience_content_types) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE9).content_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "plano_conteudo")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setPlano(ent.conteudo as unknown as PlanoConteudo);
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
    async (campos: Partial<ProfileE9>) => {
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
    await autoSave({ publishing_rhythm: ritmo });
    setStep(5);
    setLoadingPlano(true);
    setPlanoError(null);
    const result = await gerar({
      data: {
        audience_content_types: consumo,
        scroll_stoppers: parada,
        publishing_rhythm: ritmo,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingPlano(false);
    if (result.error || !result.plano) {
      setPlanoError(result.error || "Erro desconhecido.");
      return;
    }
    setPlano(result.plano);
  }, [autoSave, gerar, consumo, parada, ritmo, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !plano) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Plano de Conteúdo",
      tipo: "plano_conteudo",
      fase: "Venda",
      etapa: 9,
      conteudo: plano as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ content_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, plano]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    if (profile?.star_9_completed_at) { concludedRef.current = true; return; }
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_9_completed_at: new Date().toISOString(),
          orbit_sales_active: true,
          etapa_atual: 10,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Sua audiência aberta",
        descricao: "Desenhou o plano de conteúdo. Suas Vendas e Clientes tá ativa.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE10 = [
        "Escolher 3 números pra acompanhar toda semana",
        "Calcular receita do último mês",
        "Identificar produto ou serviço que mais vende",
        "Definir meta de faturamento para o próximo mês",
        "Criar rotina semanal de olhada nos números",
      ];
      await supabase.from("tarefas").insert(
        tarefasE10.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 10,
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
              caveat="você não faz conteúdo pra todo mundo. só pra ela."
              titulo={<>O que sua cliente ideal consome online?</>}
              label="O QUE ELA VÊ E CURTE"
              placeholder="Ex: Adora ver bastidores de produção artesanal. Segue noivas que mostram o processo de planejamento. Consome vídeos curtos de antes e depois. Odeia propaganda direta. Gosta de conteúdo que parece dica de amiga."
              maxLength={400}
              ajuda="pensa na sua melhor cliente. o que ela posta, curte e salva?"
              raposaEstado="Atenta · escutando"
              raposaTexto="Fazer conteúdo é conversar com ela no idioma que ela já fala. Você não ensina, você reconhece."
              valor={consumo}
              setValor={setConsumo}
              onAutoSave={() => autoSave({ audience_content_types: consumo })}
              onContinuar={() => {
                autoSave({ audience_content_types: consumo });
                setStep(3);
              }}
              minLen={20}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="o que faz o dedo parar de rolar é ouro."
              titulo={<>O que faz ela parar no seu conteúdo?</>}
              label="O QUE PARA O SCROLL"
              placeholder="Ex: Foto com resultado impactante logo na primeira imagem. Vídeo que começa mostrando o produto pronto. Pergunta que ela nunca parou pra se fazer sobre casamento. Processo detalhado que mostra cuidado e técnica."
              maxLength={400}
              ajuda="pensa num post seu que funcionou bem. o que tinha de diferente?"
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="Nos primeiros 2 segundos ela decide se fica ou rola. Tudo que você faz antes disso é invisível."
              valor={parada}
              setValor={setParada}
              onAutoSave={() => autoSave({ scroll_stoppers: parada })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ scroll_stoppers: parada });
                setStep(4);
              }}
              minLen={20}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="frequência bate perfeição. sempre."
              titulo={<>Com que frequência você aparece?</>}
              label="SEU RITMO DE PUBLICAÇÃO"
              placeholder="Ex: Consigo postar 3x por semana no feed e stories todos os dias. Mas quando tá cheio de pedido, fico sem postar por 2 semanas. Fico travada por não saber o que escrever."
              maxLength={400}
              ajuda="conta o que é real hoje, não o que você acha que deveria ser."
              raposaEstado="Animada · em pé"
              raposaTexto="Consistência de 2x semana por um ano supera um calendário perfeito que dura 3 meses."
              valor={ritmo}
              setValor={setRitmo}
              onAutoSave={() => autoSave({ publishing_rhythm: ritmo })}
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
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa10={() => navigate({ to: "/etapa/10" })}
        />
      )}
    </>
  );
}

/* ============== E9.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Consumo", sub: "o que ela vê" },
    { num: "2", titulo: "Parada", sub: "o que faz parar" },
    { num: "3", titulo: "Caminho", sub: "como chega nela" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 9 DE 11 · SUA AUDIÊNCIA
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L9 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">hora de ser encontrada.</p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Conteúdo é
          <br />
          convite.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra desenhar o que ela consome, o que faz ela parar, e como você chega até ela.
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
          Vamos atrair  →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E9.2-E9.4 ============== */
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
    { num: 1, label: "Consumo" },
    { num: 2, label: "Parada" },
    { num: 3, label: "Caminho" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={9} fase="VENDA" nome="Sua audiência" variant="light" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 9 · SUA AUDIÊNCIA
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Conteúdo é
            <br />
            convite.
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
            o seu plano de conteúdo
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

/* ============== E9.5 — Plano de Conteúdo (COSMIC) ============== */
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
  plano: PlanoConteudo | null;
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
              desenhando seu plano de conteúdo...
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

        {!loading && !error && plano && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 9 · SUA AUDIÊNCIA
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">olha seu plano de conteúdo.</p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Seu plano de conteúdo
              <br />
              tá desenhado.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                PLANO DE CONTEÚDO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Como você atrai quem precisa de você</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                O QUE ELA QUER VER
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.tipos_conteudo}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                O QUE PARA O SCROLL
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.gatilhos_parada}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SEU RITMO IDEAL
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {plano.ritmo_sugerido}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                3 IDEIAS DE CONTEÚDO PARA COMEÇAR
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {plano.ideias.map((ideia, i) => (
                  <p key={i} className="caveat-decorativo text-polia-terracota leading-[24px]">
                    {ideia}
                  </p>
                ))}
              </div>

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
                Conquistar esse marco  →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== E9.6 — Conclusão marco 9 ============== */
function Conclusao({ onVerPainel, onEtapa10 }: { onVerPainel: () => void; onEtapa10: () => void }) {
  return (
    <ConclusaoEtapa
      numero={9}
      nomeEtapa="Sua audiência"
      palavraHighlight="Audiência"
      palavraMarco="AUDIÊNCIA"
      ferramentaDesbloqueada={{
        titulo: "Suas Vendas e Clientes",
        descricao: "Seu fluxo de vendas, protocolo de cuidado e plano de conteúdo reunidos. Pronta pra fase de Evolução.",
      }}
      proximaEtapaLabel="Começar Etapa 10 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa10}
    />
  );
}
