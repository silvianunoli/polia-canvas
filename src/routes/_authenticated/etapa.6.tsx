import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarSistemaControle, type SistemaControle } from "@/lib/routine.functions";

export const Route = createFileRoute("/_authenticated/etapa/6")({
  head: () => ({
    meta: [
      { title: "Etapa 6 · Sua Rotina · Pólia" },
      { name: "description", content: "Organize sua produção, controle e reposição." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_6_completed_at, star_5_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    // Acessivel se a etapa anterior foi concluida (ou se essa etapa ja foi concluida — modo leitura)
    const anteriorOk = !!(profile as Record<string, unknown>)["star_5_completed_at"];
    const essaOk = !!(profile as Record<string, unknown>)["star_6_completed_at"];
    if (!anteriorOk && !essaOk) {
      throw redirect({ to: "/painel" });
    }
},
  component: Etapa6Page,
});

type ProfileE6 = {
  display_name: string | null;
  business_name: string | null;
  production_capacity: string | null;
  tracking_system: string | null;
  restock_triggers: string | null;
  routine_finalized_at: string | null;
  star_6_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa6:step";

function Etapa6Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarSistemaControle);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE6 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [capacidade, setCapacidade] = useState("");
  const [controle, setControle] = useState("");
  const [reposicao, setReposicao] = useState("");

  const [sistema, setSistema] = useState<SistemaControle | null>(null);
  const [loadingSistema, setLoadingSistema] = useState(false);
  const [sistemaError, setSistemaError] = useState<string | null>(null);

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
          "display_name, business_name, production_capacity, tracking_system, restock_triggers, routine_finalized_at, star_6_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE6);
        setCapacidade(p.production_capacity ?? "");
        setControle(p.tracking_system ?? "");
        setReposicao(p.restock_triggers ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE6).routine_finalized_at) {
          setStep(5);
        } else if (p.restock_triggers) {
          setStep(4);
        } else if (p.tracking_system) {
          setStep(4);
        } else if (p.production_capacity) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE6).routine_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "sistema_controle")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setSistema(ent.conteudo as unknown as SistemaControle);
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
    async (campos: Partial<ProfileE6>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarSistema = useCallback(async () => {
    await autoSave({ restock_triggers: reposicao });
    setStep(5);
    setLoadingSistema(true);
    setSistemaError(null);
    const result = await gerar({
      data: {
        production_capacity: capacidade,
        tracking_system: controle,
        restock_triggers: reposicao,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingSistema(false);
    if (result.error || !result.sistema) {
      setSistemaError(result.error || "Erro desconhecido.");
      return;
    }
    setSistema(result.sistema);
  }, [autoSave, gerar, capacidade, controle, reposicao, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !sistema) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Sistema de Controle",
      tipo: "sistema_controle",
      fase: "Construção",
      etapa: 6,
      conteudo: sistema as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ routine_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, sistema]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    if (profile?.star_6_completed_at) { concludedRef.current = true; return; }
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_6_completed_at: new Date().toISOString(),
          orbit_vitrine_active: true,
          etapa_atual: 7,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Gestão aberta",
        descricao: "Montou o sistema de controle. Sua Vitrine está ativada.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE7 = [
        "Mapear como as clientes chegam até você",
        "Identificar o momento em que ela decide comprar",
        "Criar resposta padrão pra primeira mensagem",
        "Definir o que leva ela a fechar na hora",
        "Listar as objeções mais comuns que você já ouviu",
      ];
      await supabase.from("tarefas").insert(
        tarefasE7.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 7,
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
              caveat="saber quanto você produz é saber quanto você pode vender."
              titulo={<>Quanto você consegue produzir por mês?</>}
              label="SUA CAPACIDADE DE PRODUÇÃO"
              placeholder="Ex: Consigo fazer até 200 convites por semana trabalhando 4h por dia. Em época de festa (out-dez) chego a 300. Não consigo fazer mais do que 2 pedidos grandes ao mesmo tempo sem atrasar."
              maxLength={300}
              ajuda="inclui o ritmo normal e o limite que você sente na prática."
              raposaEstado="Atenta · sentada escutando"
              raposaTexto="Vender mais do que você consegue entregar prejudica sua reputação. Conhecer seu limite é poder dizer sim com segurança."
              valor={capacidade}
              setValor={setCapacidade}
              onAutoSave={() => autoSave({ production_capacity: capacidade })}
              onContinuar={() => {
                autoSave({ production_capacity: capacidade });
                setStep(3);
              }}
              minLen={15}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="o que não é controlado, não cresce."
              titulo={<>Como você controla o que tem<br />e o que entra?</>}
              label="SEU SISTEMA DE CONTROLE"
              placeholder="Ex: Anoto os pedidos num caderno e marco quando entrego. Materiais controlo por estimativa. Às vezes fico sem ribbon e preciso parar. Quero montar uma planilha mas ainda não comecei."
              maxLength={400}
              ajuda="pode ser caderno, foto, aplicativo, planilha ou intuição. conta como é de verdade."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="Não precisa ser um sistema sofisticado. O melhor controle é aquele que você usa."
              valor={controle}
              setValor={setControle}
              onAutoSave={() => autoSave({ tracking_system: controle })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ tracking_system: controle });
                setStep(4);
              }}
              minLen={20}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="ficar sem material no meio de um pedido é um pesadelo que dá pra evitar."
              titulo={<>Quando você percebe que precisa repor?</>}
              label="SEU GATILHO DE REPOSIÇÃO"
              placeholder="Ex: Quando o estoque de papel cai pela metade eu já peço. Ribbon repõe todo mês automaticamente. Fita e caixa ainda faço por demanda e às vezes atrasa."
              maxLength={300}
              ajuda="conta como acontece hoje, mesmo que você saiba que não é o ideal."
              raposaEstado="Animada · em pé"
              raposaTexto="Um sistema de reposição simples evita atrasos, clientes frustradas e noites perdidas esperando entrega."
              valor={reposicao}
              setValor={setReposicao}
              onAutoSave={() => autoSave({ restock_triggers: reposicao })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarSistema()}
              continuarLabel="Montar meu sistema  →"
              minLen={15}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <SistemaTela
          loading={loadingSistema}
          sistema={sistema}
          error={sistemaError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarSistema()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa7={() => navigate({ to: "/etapa/7" })}
        />
      )}
    </>
  );
}

/* ============== E6.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Capacidade", sub: "quanto produz" },
    { num: "2", titulo: "Organização", sub: "como controla" },
    { num: "3", titulo: "Reposição", sub: "quando refaz" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 6 DE 11 · SUA ROTINA
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L6 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">pronta pra atender.</p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          O fluxo por trás
          <br />
          da venda.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra organizar quanto você consegue produzir, como organiza e quando reabastece.
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
          Vamos organizar  →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E6.2-E6.4 ============== */
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
    { num: 1, label: "Capacidade" },
    { num: 2, label: "Organização" },
    { num: 3, label: "Reposição" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={6} fase="CONSTRUÇÃO" nome="Gestão" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 6 · SUA ROTINA
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Sua produção
            <br />
            tem ritmo.
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
            o seu sistema de controle
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

/* ============== E6.5 — Sistema de Controle (COSMIC) ============== */
function SistemaTela({
  loading,
  sistema,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  sistema: SistemaControle | null;
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
              montando seu sistema de controle...
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

        {!loading && !error && sistema && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 6 · SUA ROTINA
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">olha a ordem que a gente montou.</p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Seu sistema de controle
              <br />
              tá pronto.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                SISTEMA DE CONTROLE · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">Como sua produção funciona</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SUA CAPACIDADE
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {sistema.capacidade_resumida}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                SEU CONTROLE HOJE
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {sistema.controle_atual}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                QUANDO REPOR
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {sistema.gatilho_reposicao}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                PRÓXIMO PASSO RECOMENDADO
              </p>
              <p className="caveat-decorativo text-polia-terracota mt-2">
                {sistema.proximo_passo}
              </p>

              <p className="caveat-decorativo text-[rgba(201,107,62,0.85)] mt-5 text-right">
                salvo em Sua Vitrine · você edita quando quiser
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

/* ============== E6.6 — Conclusão marco 6 + Sua Vitrine ativada ============== */
function Conclusao({ onVerPainel, onEtapa7 }: { onVerPainel: () => void; onEtapa7: () => void }) {
  return (
    <ConclusaoEtapa
      numero={6}
      nomeEtapa="Gestão"
      palavraHighlight="Gestão"
      palavraMarco="GESTÃO"
      ferramentaDesbloqueada={{
        titulo: "Sua Vitrine",
        descricao: "Sua vitrine completa: produto, presença e sistema de controle. Pronta pra receber qualquer cliente.",
      }}
      proximaEtapaLabel="Começar Etapa 7 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa7}
    />
  );
}
