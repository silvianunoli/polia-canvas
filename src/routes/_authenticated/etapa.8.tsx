import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarProtocoloCuidado, type ProtocoloCuidado } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/etapa/8")({
  head: () => ({
    meta: [
      { title: "Etapa 8 · Seus Clientes · Pólia" },
      { name: "description", content: "Monte seu protocolo de cuidado com a cliente." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_8_completed_at, star_7_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    // Acessivel se a etapa anterior foi concluida (ou se essa etapa ja foi concluida — modo leitura)
    const anteriorOk = !!(profile as Record<string, unknown>)["star_7_completed_at"];
    const essaOk = !!(profile as Record<string, unknown>)["star_8_completed_at"];
    if (!anteriorOk && !essaOk) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa8Page,
});

type ProfileE8 = {
  display_name: string | null;
  business_name: string | null;
  welcome_protocol: string | null;
  issue_handling: string | null;
  loyalty_strategy: string | null;
  care_finalized_at: string | null;
  star_8_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa8:step";

function Etapa8Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarProtocoloCuidado);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE8 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [acolhimento, setAcolhimento] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [fidelizacao, setFidelizacao] = useState("");

  const [protocolo, setProtocolo] = useState<ProtocoloCuidado | null>(null);
  const [loadingProtocolo, setLoadingProtocolo] = useState(false);
  const [protocoloError, setProtocoloError] = useState<string | null>(null);

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
          "display_name, business_name, welcome_protocol, issue_handling, loyalty_strategy, care_finalized_at, star_8_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE8);
        setAcolhimento(p.welcome_protocol ?? "");
        setResolucao(p.issue_handling ?? "");
        setFidelizacao(p.loyalty_strategy ?? "");

        const saved =
          typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE8).care_finalized_at) {
          setStep(5);
        } else if (p.loyalty_strategy) {
          setStep(4);
        } else if (p.issue_handling) {
          setStep(4);
        } else if (p.welcome_protocol) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE8).care_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "protocolo_cuidado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setProtocolo(ent.conteudo as unknown as ProtocoloCuidado);
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
    async (campos: Partial<ProfileE8>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase
        .from("profiles")
        .update(payload as never)
        .eq("id", userId);
    },
    [userId],
  );

  const gerarProtocoloAcao = useCallback(async () => {
    await autoSave({ loyalty_strategy: fidelizacao });
    setStep(5);
    setLoadingProtocolo(true);
    setProtocoloError(null);
    const result = await gerar({
      data: {
        welcome_protocol: acolhimento,
        issue_handling: resolucao,
        loyalty_strategy: fidelizacao,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingProtocolo(false);
    if (result.error || !result.protocolo) {
      setProtocoloError(result.error || "Erro desconhecido.");
      return;
    }
    setProtocolo(result.protocolo);
  }, [autoSave, gerar, acolhimento, resolucao, fidelizacao, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !protocolo) return;
    await supabase.from("entregaveis").upsert(
      {
        user_id: userId,
        titulo: "Protocolo de Cuidado",
        tipo: "protocolo_cuidado",
        fase: "Venda",
        etapa: 8,
        conteudo: protocolo as never,
        status: "concluido",
      },
      { onConflict: "user_id,tipo" },
    );
    await supabase
      .from("profiles")
      .update({ care_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, protocolo]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    if (profile?.star_8_completed_at) {
      concludedRef.current = true;
      return;
    }
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_8_completed_at: new Date().toISOString(),
          etapa_atual: 9,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Seus clientes abertos",
        descricao: "Montou o protocolo de cuidado. Suas Vendas e Clientes ficou mais completo.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE9 = [
        "Mapear o que sua cliente consome no Instagram",
        "Listar 3 tipos de conteúdo que param o scroll",
        "Escolher frequência de postagem realista",
        "Criar modelo de legenda com posicionamento",
        "Testar um formato de conteúdo novo",
      ];
      await supabase.from("tarefas").insert(
        tarefasE9.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 9,
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
              caveat="a primeira experiência pós-compra define se ela volta."
              titulo={<>Como você recebe uma nova cliente?</>}
              label="SEU PROTOCOLO DE BOAS-VINDAS"
              placeholder="Ex: Quando confirmo o pagamento, mando uma mensagem agradecendo e dou o prazo exato de entrega. Quando o pedido tá pronto, mando foto antes de embalar. Entrego com bilhetinho escrito à mão."
              maxLength={300}
              ajuda="pensa no que você faz desde o pagamento até a entrega. cada detalhe conta."
              raposaEstado="Atenta · escutando"
              raposaTexto="Uma boas-vindas bem feita já começa a construir a próxima compra. É o início da fidelização."
              valor={acolhimento}
              setValor={setAcolhimento}
              onAutoSave={() => autoSave({ welcome_protocol: acolhimento })}
              onContinuar={() => {
                autoSave({ welcome_protocol: acolhimento });
                setStep(3);
              }}
              minLen={15}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="problema bem resolvido vira cliente fiel."
              titulo={<>Como você resolve quando algo dá errado?</>}
              label="SEU JEITO DE RESOLVER"
              placeholder="Ex: Se der problema na entrega, ligo pessoalmente, não mando mensagem. Se o produto chegou com defeito, refaço sem cobrar. Nunca deixo uma reclamação mais de 2h sem resposta. Prefiro perder dinheiro a perder a reputação."
              maxLength={400}
              ajuda="pode ter sido uma situação real que te ensinou como lidar. usa ela."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="A forma como você resolve um problema diz mais sobre você do que a forma como faz a venda."
              valor={resolucao}
              setValor={setResolucao}
              onAutoSave={() => autoSave({ issue_handling: resolucao })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ issue_handling: resolucao });
                setStep(4);
              }}
              minLen={20}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="cliente fiel indica antes mesmo de comprar de novo."
              titulo={<>O que faz ela voltar e te indicar?</>}
              label="SEU JEITO DE FIDELIZAR"
              placeholder="Ex: Mando mensagem no aniversário das clientes que casaram. Dou desconto pra quem indica uma amiga. Guardo o perfil e o gosto de cada uma pra lembrar nas próximas encomendas. Faço questão de perguntar se ficou feliz depois da entrega."
              maxLength={300}
              ajuda="o que você já faz hoje e o que você gostaria de fazer."
              raposaEstado="Animada · em pé"
              raposaTexto="Clientes fidelizadas custam 5x menos pra vender do que clientes novas. Vale cada gesto."
              valor={fidelizacao}
              setValor={setFidelizacao}
              onAutoSave={() => autoSave({ loyalty_strategy: fidelizacao })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarProtocoloAcao()}
              continuarLabel="Montar meu protocolo  →"
              minLen={15}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <ProtocoloTela
          loading={loadingProtocolo}
          protocolo={protocolo}
          error={protocoloError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarProtocoloAcao()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa9={() => navigate({ to: "/etapa/9" })}
        />
      )}
    </>
  );
}

/* ============== E8.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Acolhimento", sub: "como você recebe" },
    { num: "2", titulo: "Resolução", sub: "como você responde" },
    { num: "3", titulo: "Fidelização", sub: "como ela volta" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 8 DE 11 · SEUS CLIENTES
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">
            PLACEHOLDER · LOGO
          </p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L8 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">
          essa é a parte que faz ela voltar.
        </p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          Como você cuida
          <br />
          de quem já comprou.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra montar seu protocolo de cuidado com a cliente.
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
          Vamos cuidar →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E8.2-E8.4 ============== */
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
    { num: 1, label: "Acolhimento" },
    { num: 2, label: "Resolução" },
    { num: 3, label: "Fidelização" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={8} fase="VENDA" nome="Seus clientes" variant="light" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 8 · SEUS CLIENTES
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Como você cuida
            <br />
            de quem volta.
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
            <br />o seu protocolo de cuidado
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
          <p className="font-accent text-[8px] font-bold tracking-[1px] text-polia-terracota">
            RAPOSA
          </p>
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

/* ============== E8.5 — Protocolo de Cuidado (COSMIC) ============== */
function ProtocoloTela({
  loading,
  protocolo,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  protocolo: ProtocoloCuidado | null;
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
              desenhando seu protocolo de cuidado...
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

        {!loading && !error && protocolo && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 8 · SEUS CLIENTES
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">
              olha o cuidado que você já tem.
            </p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Seu protocolo de cuidado
              <br />
              tá pronto.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                PROTOCOLO DE CUIDADO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">
                Como você cuida de quem confia em você
              </p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                BOAS-VINDAS
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {protocolo.boas_vindas}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                QUANDO ALGO DÁ ERRADO
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {protocolo.resolucao}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                COMO FIDELIZA
              </p>
              <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                {protocolo.fidelizacao}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                MENSAGEM DE ACOMPANHAMENTO SUGERIDA
              </p>
              <p className="caveat-decorativo text-polia-terracota leading-[26px] mt-2">
                &ldquo;{protocolo.mensagem_pos_entrega}&rdquo;
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
                Conquistar esse marco →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== E8.6 — Conclusão marco 8 ============== */
function Conclusao({ onVerPainel, onEtapa9 }: { onVerPainel: () => void; onEtapa9: () => void }) {
  return (
    <ConclusaoEtapa
      numero={8}
      nomeEtapa="Seus clientes"
      palavraHighlight="Clientes"
      palavraMarco="CLIENTES"
      ferramentaDesbloqueada={{
        titulo: "Suas Vendas e Clientes",
        descricao:
          "Seu protocolo de cuidado foi adicionado. Agora você tem fluxo de vendas e de atendimento juntos.",
      }}
      proximaEtapaLabel="Começar Etapa 9 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa9}
    />
  );
}
