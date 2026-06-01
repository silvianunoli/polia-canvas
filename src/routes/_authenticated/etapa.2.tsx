import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { gerarVozMarca, type BrandVoiceJson } from "@/lib/brandvoice.functions";

export const Route = createFileRoute("/_authenticated/etapa/2")({
  head: () => ({
    meta: [
      { title: "Etapa 2 · Identidade · Pólia" },
      { name: "description", content: "Dê alma à sua marca: sentimento, olhar e voz." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_2_completed_at, star_1_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    // Acessivel se a etapa anterior foi concluida (ou se essa etapa ja foi concluida — modo leitura)
    const anteriorOk = !!(profile as Record<string, unknown>)["star_1_completed_at"];
    const essaOk = !!(profile as Record<string, unknown>)["star_2_completed_at"];
    if (!anteriorOk && !essaOk) {
      throw redirect({ to: "/painel" });
    }
},
  component: Etapa2Page,
});

type ProfileE2 = {
  display_name: string | null;
  business_name: string | null;
  brand_feeling: string | null;
  brand_visual_style: string | null;
  brand_voice_yes: string | null;
  brand_voice_finalized_at: string | null;
  star_2_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa2:step";

function Etapa2Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarVozMarca);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE2 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [brandFeeling, setBrandFeeling] = useState("");
  const [brandVisualStyle, setBrandVisualStyle] = useState("");
  const [brandVoiceYes, setBrandVoiceYes] = useState("");

  const [vozMarca, setVozMarca] = useState<BrandVoiceJson | null>(null);
  const [loadingVoz, setLoadingVoz] = useState(false);
  const [vozError, setVozError] = useState<string | null>(null);
  const [varianteAtiva, setVarianteAtiva] = useState<"recomendada" | "poetica" | "direta">("recomendada");

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
          "display_name, business_name, brand_feeling, brand_visual_style, brand_voice_yes, brand_voice_finalized_at, star_2_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE2);
        setBrandFeeling(p.brand_feeling ?? "");
        setBrandVisualStyle(p.brand_visual_style ?? "");
        setBrandVoiceYes((p as ProfileE2).brand_voice_yes ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE2).brand_voice_finalized_at) {
          setStep(5);
        } else if ((p as ProfileE2).brand_voice_yes) {
          setStep(4);
        } else if (p.brand_visual_style) {
          setStep(4);
        } else if (p.brand_feeling) {
          setStep(3);
        } else {
          setStep(1);
        }

        // Se já foi gerado, carregar entregável
        if ((p as ProfileE2).brand_voice_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "voz_de_marca")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setVozMarca(ent.conteudo as unknown as BrandVoiceJson);
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
    async (campos: Partial<ProfileE2>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarVoz = useCallback(
    async (variante?: "recomendada" | "poetica" | "direta" | "outra") => {
      await autoSave({ brand_voice_yes: brandVoiceYes });
      setStep(5);
      setLoadingVoz(true);
      setVozError(null);
      const result = await gerar({
        data: {
          brand_feeling: brandFeeling,
          brand_visual_style: brandVisualStyle,
          brand_voice_yes: brandVoiceYes,
          variante,
        },
      });
      setLoadingVoz(false);
      if (result.error || !result.voz) {
        setVozError(result.error || "Erro desconhecido.");
        return;
      }
      setVozMarca(result.voz);
    },
    [autoSave, gerar, brandFeeling, brandVisualStyle, brandVoiceYes],
  );

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !vozMarca) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Voz de Marca",
      tipo: "voz_de_marca",
      fase: "Sonho",
      etapa: 2,
      conteudo: vozMarca as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ brand_voice_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, vozMarca]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    if (profile?.star_2_completed_at) { concludedRef.current = true; return; }
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_2_completed_at: new Date().toISOString(),
          orbit_vitrine_unlocked: true,
          etapa_atual: 3,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Identidade aberta",
        descricao: "Definiu a identidade e a voz da marca.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE3 = [
        "Mapear 3 concorrentes do mercado",
        "Identificar meu diferencial real",
        "Descrever por que me escolhem",
        "Escrever meu posicionamento",
        "Validar com uma cliente de confiança",
      ];
      await supabase.from("tarefas").insert(
        tarefasE3.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 3,
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
            <Pergunta1
              valor={brandFeeling}
              setValor={setBrandFeeling}
              onAutoSave={() => autoSave({ brand_feeling: brandFeeling })}
              onContinuar={() => {
                autoSave({ brand_feeling: brandFeeling });
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <Pergunta2
              valor={brandVisualStyle}
              setValor={setBrandVisualStyle}
              onAutoSave={() => autoSave({ brand_visual_style: brandVisualStyle })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ brand_visual_style: brandVisualStyle });
                setStep(4);
              }}
            />
          )}
          {step === 4 && (
            <Pergunta3
              valor={brandVoiceYes}
              setValor={setBrandVoiceYes}
              onAutoSave={() => autoSave({ brand_voice_yes: brandVoiceYes })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarVoz()}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <VozMarcaTela
          loading={loadingVoz}
          voz={vozMarca}
          error={vozError}
          businessName={profile?.business_name ?? ""}
          varianteAtiva={varianteAtiva}
          setVarianteAtiva={setVarianteAtiva}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarVoz()}
          onVariante={(v) => gerarVoz(v)}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa3={() => navigate({ to: "/etapa/3" })}
        />
      )}
    </>
  );
}

/* ============== E2.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Sentimento", sub: "o que ela passa" },
    { num: "2", titulo: "Olhar", sub: "como ela aparece" },
    { num: "3", titulo: "Palavras", sub: "como ela fala" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 2 DE 11 · IDENTIDADE DO SEU NEGÓCIO
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L2 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">agora vamos dar forma.</p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Sua marca precisa de uma alma.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra capturar o sentimento, o olhar e a voz da sua marca.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          {cards.map((c) => (
            <div
              key={c.num}
              className="w-[200px] rounded-[14px] border border-[rgba(232,151,112,0.3)] bg-white p-[20px] text-center"
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
          Vamos dar alma →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E2.2-E2.4 (sidebar + área) ============== */
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
    { num: 1, label: "Sentimento" },
    { num: 2, label: "Olhar" },
    { num: 3, label: "Palavras" },
  ];
  const activeIndex = step - 2; // 0,1,2

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={2} fase="SONHO" nome="Identidade" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 2 · IDENTIDADE
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Sua marca,
            <br />
            com alma.
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
            depois vem a voz
            <br />
            da sua marca
          </p>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

/* ============== Pergunta genérica wrapper ============== */
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
        className="mt-3 w-full max-w-[720px] min-h-[120px] rounded-[12px] border border-[#EAE2D8] bg-white p-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#A8A2A0] focus:outline-none focus:ring-2 focus:ring-[#C96B3E]/30"
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

function Pergunta1(props: {
  valor: string;
  setValor: (v: string) => void;
  onAutoSave: () => void;
  onContinuar: () => void;
}) {
  return (
    <PerguntaBlock
      caveat="pensa numa cliente que amou o que você faz."
      titulo={
        <>
          O que sua marca
          <br />
          faz sentir?
        </>
      }
      label="O SENTIMENTO"
      placeholder="Ex: Segurança. Que ela pode confiar. Que não tá sozinha nessa. Que alguém entende o caminho que ela quer tomar."
      maxLength={200}
      ajuda="pensa numa cliente que amou o que você faz. o que ela sentiu?"
      raposaEstado="Atenta · escutando"
      raposaTexto="Sentimento vem antes de estética. Antes de pensar em logo ou cor, sabe o que a sua cliente tem que sentir quando te encontra."
      {...props}
    />
  );
}

function Pergunta2(props: {
  valor: string;
  setValor: (v: string) => void;
  onAutoSave: () => void;
  onVoltar: () => void;
  onContinuar: () => void;
}) {
  return (
    <PerguntaBlock
      caveat="essa é a parte que mais importa pra primeira impressão."
      titulo={
        <>
          Como sua marca
          <br />
          aparece no mundo?
        </>
      }
      label="O ESTILO VISUAL"
      placeholder="Ex: Minimalista, mas quente. Tons terrosos e creme. Tipografia com serifa. Fotos de produto com luz natural. Parece artesanal sem ser amador."
      maxLength={400}
      ajuda="não precisa ser um brief de designer. fala o que você vê quando fecha os olhos e pensa na sua marca."
      raposaEstado="Curiosa · cabeça inclinada"
      raposaTexto="Você não precisa de um designer pra responder isso. Você já tem uma intuição visual — a gente só vai registrar ela aqui."
      {...props}
    />
  );
}

function Pergunta3(props: {
  valor: string;
  setValor: (v: string) => void;
  onAutoSave: () => void;
  onVoltar: () => void;
  onContinuar: () => void;
}) {
  return (
    <PerguntaBlock
      caveat="essa é a alma. como ela fala é como ela existe."
      titulo={
        <>
          Como sua marca
          <br />
          fala com o mundo?
        </>
      }
      label="A VOZ E O TOM"
      placeholder="Ex: Fala com carinho, mas direto. Usa linguagem simples. Celebra a cliente. Nunca usa jargão de coach ou marketeiro. Parece uma amiga que entende muito do que faz."
      maxLength={200}
      ajuda="voz de marca não é slogan. é personalidade. é o jeito que ela soa no ouvido de quem você quer alcançar."
      raposaEstado="Animada · em pé"
      raposaTexto="Pensa assim: se a sua marca fosse uma pessoa numa festa, como ela falaria? Com quem ela conversaria primeiro?"
      continuarLabel="Montar minha voz de marca  →"
      {...props}
    />
  );
}

/* ============== E2.5 — Voz de Marca gerada (COSMIC) ============== */
function VozMarcaTela({
  loading,
  voz,
  error,
  businessName,
  varianteAtiva,
  setVarianteAtiva,
  onAjustar,
  onContinuar,
  onRetry,
  onVariante,
}: {
  loading: boolean;
  voz: BrandVoiceJson | null;
  error: string | null;
  businessName: string;
  varianteAtiva: "recomendada" | "poetica" | "direta";
  setVarianteAtiva: (v: "recomendada" | "poetica" | "direta") => void;
  onAjustar: () => void;
  onContinuar: () => void;
  onRetry: () => void;
  onVariante: (v: "recomendada" | "poetica" | "direta" | "outra") => void;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        {loading && (
          <>
            <p className="caveat-informacional text-polia-terracota animate-pulse">
              montando a alma da sua marca...
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

        {!loading && !error && voz && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 2 · BRANDING
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">olha o que a gente fez juntas.</p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Sua voz de marca
              <br />
              tá definida.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                VOZ DE MARCA · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Sua marca fala assim</p>
              <hr className="border-[#EAE2D8] my-5" />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {voz.palavras.slice(0, 3).map((p, i) => (
                  <div key={i} className="text-center">
                    <p className="font-serif text-[#1A1A2E] text-[32px] leading-none">{p.palavra}</p>
                    <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-2">
                      {p.subtitulo}
                    </p>
                  </div>
                ))}
              </div>

              <hr className="border-[#EAE2D8] my-5" />
              <p className="font-serif text-[#6A6A7E] text-[18px] leading-[26px] text-center italic">
                "{voz.variacoes[varianteAtiva] || voz.frase}"
              </p>

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase mt-6">
                VARIAÇÕES
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["recomendada", "poetica", "direta"] as const).map((v) => {
                  const ativo = v === varianteAtiva;
                  return (
                    <button
                      key={v}
                      onClick={() => setVarianteAtiva(v)}
                      className={`h-[28px] rounded-[14px] px-3 font-sans text-[11px] ${
                        ativo
                          ? "bg-[#C96B3E] font-semibold text-polia-creme"
                          : "border border-[#EAE2D8] bg-[#FDF8F5] text-[#6A6A7E]"
                      }`}
                    >
                      {v === "recomendada" ? "Recomendada" : v === "poetica" ? "Mais poética" : "Mais direta"}
                    </button>
                  );
                })}
                <button
                  onClick={() => onVariante("outra")}
                  className="h-[28px] rounded-[14px] border border-[#EAE2D8] bg-[#FDF8F5] px-3 font-sans text-[11px] text-[#6A6A7E]"
                >
                  + Gerar outra
                </button>
              </div>

              <p className="caveat-decorativo text-[rgba(232,151,112,0.85)] mt-5 text-center">
                salvo em Sua Marca Viva · você edita quando quiser
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

/* ============== E2.6 — Conclusão marco 2 ============== */
function Conclusao({ onVerPainel, onEtapa3 }: { onVerPainel: () => void; onEtapa3: () => void }) {
  return (
    <ConclusaoEtapa
      numero={2}
      nomeEtapa="Identidade do seu negócio"
      palavraHighlight="Identidade"
      palavraMarco="IDENTIDADE"
      ferramentaDesbloqueada={{
        titulo: "Sua Vitrine",
        descricao: "Página de apresentação do seu negócio. Fica na sua órbita — anda com você.",
      }}
      proximaEtapaLabel="Começar Etapa 3 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa3}
    />
  );
}
