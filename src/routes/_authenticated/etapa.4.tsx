import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { ConclusaoEtapa } from "@/components/painel/ConclusaoEtapa";
import { PainelNav } from "@/components/painel/PainelNav";
import { EtapaTopBar } from "@/components/etapa/EtapaTopBar";
import { gerarFichaProduto, type FichaProduto } from "@/lib/product.functions";

export const Route = createFileRoute("/_authenticated/etapa/4")({
  head: () => ({
    meta: [
      { title: "Etapa 4 · Presença Digital · Pólia" },
      { name: "description", content: "Monte a ficha do seu produto ou serviço." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("etapa_atual, star_4_completed_at")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) return;
    if ((profile.etapa_atual ?? 1) < 4) {
      throw redirect({ to: "/painel" });
    }
    if (profile.star_4_completed_at) {
      throw redirect({ to: "/painel" });
    }
  },
  component: Etapa4Page,
});

type ProfileE4 = {
  display_name: string | null;
  business_name: string | null;
  product_description: string | null;
  delivery_method: string | null;
  price_range: string | null;
  product_finalized_at: string | null;
  star_4_completed_at: string | null;
  streak: number | null;
};

const STORAGE_KEY = "polia:etapa4:step";

function Etapa4Page() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarFichaProduto);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileE4 | null>(null);
  const [step, setStep] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);

  const [productDescription, setProductDescription] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const [ficha, setFicha] = useState<FichaProduto | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [fichaError, setFichaError] = useState<string | null>(null);

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
          "display_name, business_name, product_description, delivery_method, price_range, product_finalized_at, star_4_completed_at, streak",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (p) {
        setProfile(p as ProfileE4);
        setProductDescription(p.product_description ?? "");
        setDeliveryMethod(p.delivery_method ?? "");
        setPriceRange(p.price_range ?? "");

        const saved = typeof window !== "undefined" ? Number(localStorage.getItem(STORAGE_KEY) || 0) : 0;
        if (saved >= 1 && saved <= 6) {
          setStep(saved);
        } else if ((p as ProfileE4).product_finalized_at) {
          setStep(5);
        } else if (p.price_range) {
          setStep(4);
        } else if (p.delivery_method) {
          setStep(4);
        } else if (p.product_description) {
          setStep(3);
        } else {
          setStep(1);
        }

        if ((p as ProfileE4).product_finalized_at) {
          const { data: ent } = await supabase
            .from("entregaveis")
            .select("conteudo")
            .eq("user_id", uid)
            .eq("tipo", "ficha_produto")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mounted && ent?.conteudo) setFicha(ent.conteudo as unknown as FichaProduto);
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
    async (campos: Partial<ProfileE4>) => {
      if (!userId) return;
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === "string") payload[k] = v;
      }
      await supabase.from("profiles").update(payload as never).eq("id", userId);
    },
    [userId],
  );

  const gerarFicha = useCallback(async () => {
    await autoSave({ price_range: priceRange });
    setStep(5);
    setLoadingFicha(true);
    setFichaError(null);
    const result = await gerar({
      data: {
        product_description: productDescription,
        delivery_method: deliveryMethod,
        price_range: priceRange,
        business_name: profile?.business_name ?? undefined,
      },
    });
    setLoadingFicha(false);
    if (result.error || !result.ficha) {
      setFichaError(result.error || "Erro desconhecido.");
      return;
    }
    setFicha(result.ficha);
  }, [autoSave, gerar, productDescription, deliveryMethod, priceRange, profile?.business_name]);

  const salvarEntregavelEAvancar = useCallback(async () => {
    if (!userId || !ficha) return;
    await supabase.from("entregaveis").insert({
      user_id: userId,
      titulo: "Ficha de Produto",
      tipo: "ficha_produto",
      fase: "Construção",
      etapa: 4,
      conteudo: ficha as never,
      status: "concluido",
    });
    await supabase
      .from("profiles")
      .update({ product_finalized_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setStep(6);
  }, [userId, ficha]);

  const concludedRef = useRef(false);
  useEffect(() => {
    if (step !== 6 || !userId || concludedRef.current) return;
    concludedRef.current = true;
    (async () => {
      await supabase
        .from("profiles")
        .update({
          star_4_completed_at: new Date().toISOString(),
          etapa_atual: 5,
          streak: (profile?.streak ?? 0) + 1,
        } as never)
        .eq("id", userId);

      await supabase.from("conquistas").insert({
        user_id: userId,
        titulo: "Presença aberta",
        descricao: "Montou a ficha de produto.",
        xp: 50,
        tipo: "etapa",
      });

      const tarefasE5 = [
        "Escolher canal principal de presença",
        "Escrever bio com posicionamento",
        "Organizar fotos do produto",
        "Criar link de contato ou loja",
        "Publicar a primeira postagem",
      ];
      await supabase.from("tarefas").insert(
        tarefasE5.map((titulo) => ({
          user_id: userId,
          titulo,
          etapa: 5,
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
      {/* Botão sair · não remover · vide audit v4.R1 (4º turno sem resolver) */}
      <Link
        to="/painel"
        className="fixed top-4 md:top-6 left-4 md:left-6 z-50 inline-flex items-center gap-2 px-3 py-2 min-h-[44px] font-handwritten text-polia-mostarda-intenso hover:text-white transition-colors group"
        aria-label="Voltar ao painel"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        voltar ao painel
      </Link>

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
              caveat="o que você faz é único. a gente só vai registrar isso."
              titulo={<>O que você vende?</>}
              label="SEU PRODUTO OU SERVIÇO"
              placeholder="Ex: Faço convites de casamento 100% autorais. Cada peça é única, feita a mão ou em impressão especial, entregue com envelope personalizado. Aceito encomendas pra festas, aniversários e empresas."
              maxLength={400}
              ajuda="descreve como você explicaria pra uma amiga que nunca te viu trabalhar."
              raposaEstado="Atenta · sentada escutando"
              raposaTexto="Seja específica. 'Faço produtos artesanais' diz pouco. 'Faço velas aromáticas com cascas de frutas nativas' diz tudo."
              valor={productDescription}
              setValor={setProductDescription}
              onAutoSave={() => autoSave({ product_description: productDescription })}
              onContinuar={() => {
                autoSave({ product_description: productDescription });
                setStep(3);
              }}
              minLen={20}
            />
          )}
          {step === 3 && (
            <PerguntaBlock
              caveat="a forma de entregar faz parte da experiência."
              titulo={<>Como a cliente recebe<br />o que comprou?</>}
              label="SEU MODO DE ENTREGA"
              placeholder="Ex: Entrego pessoalmente em SP capital ou envio pelos Correios com rastreio. Prazo de 10 dias úteis após confirmação do pagamento. Sempre mando foto antes de embalar."
              maxLength={300}
              ajuda="inclui prazo, logística e qualquer detalhe que a cliente precisa saber antes de comprar."
              raposaEstado="Curiosa · cabeça inclinada"
              raposaTexto="A entrega é a última memória que a cliente tem do processo. Vale caprichar nessa resposta."
              valor={deliveryMethod}
              setValor={setDeliveryMethod}
              onAutoSave={() => autoSave({ delivery_method: deliveryMethod })}
              onVoltar={() => setStep(2)}
              onContinuar={() => {
                autoSave({ delivery_method: deliveryMethod });
                setStep(4);
              }}
              minLen={15}
            />
          )}
          {step === 4 && (
            <PerguntaBlock
              caveat="preço é informação, não vergonha."
              titulo={<>Quanto você cobra?</>}
              label="SEU PREÇO E FORMA DE PAGAMENTO"
              placeholder="Ex: Convites a partir de R$ 8 por unidade (pedido mínimo 50 unidades). Aceito Pix e cartão parcelado em até 3x. Sinal de 50% pra confirmar e o restante na entrega."
              maxLength={200}
              ajuda="não precisa ser a tabela completa. só o suficiente pra ela saber se cabe no bolso."
              raposaEstado="Animada · em pé"
              raposaTexto="Cobrar pelo valor que você entrega não é ganância. É respeito pelo seu trabalho."
              valor={priceRange}
              setValor={setPriceRange}
              onAutoSave={() => autoSave({ price_range: priceRange })}
              onVoltar={() => setStep(3)}
              onContinuar={() => gerarFicha()}
              continuarLabel="Montar minha ficha  →"
              minLen={10}
            />
          )}
        </PerguntaLayout>
      )}

      {step === 5 && (
        <FichaTela
          loading={loadingFicha}
          ficha={ficha}
          error={fichaError}
          businessName={profile?.business_name ?? ""}
          onAjustar={() => setStep(4)}
          onContinuar={salvarEntregavelEAvancar}
          onRetry={() => gerarFicha()}
        />
      )}

      {step === 6 && (
        <Conclusao
          onVerPainel={() => navigate({ to: "/painel" })}
          onEtapa5={() => navigate({ to: "/etapa/5" })}
        />
      )}
    </>
  );
}

/* ============== E4.1 — CAPA COSMIC ============== */
function Capa({ onStart }: { onStart: () => void }) {
  const cards = [
    { num: "1", titulo: "Produto", sub: "o que você oferece" },
    { num: "2", titulo: "Entrega", sub: "como chega à cliente" },
    { num: "3", titulo: "Valor", sub: "quanto você cobra" },
  ];
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-10 md:py-16 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
          ETAPA 4 DE 11 · PRESENÇA DIGITAL
        </p>

        <div className="mt-10 flex h-[140px] w-[140px] sm:h-[180px] sm:w-[180px] flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(232,151,112,0.55)] bg-[rgba(26,26,46,0.4)] px-4">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-terracota">PLACEHOLDER · LOGO</p>
          <p className="caveat-decorativo text-polia-terracota mt-1">Lockup L4 Vertical</p>
          <p className="font-sans text-[10px] text-polia-marrom/60 mt-1">180×180</p>
        </div>

        <p className="caveat-informacional text-polia-terracota mt-10">agora o mundo vai te ver.</p>

        <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[36px] md:text-[56px] leading-[1.08] mt-3 max-w-[820px]">
          O que você vende e como entrega.
        </h1>

        <p className="font-sans text-[rgba(216,210,204,0.85)] text-[16px] mt-5 max-w-[640px]">
          3 perguntas pra montar a ficha do seu produto ou serviço.
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
          Vamos preencher os 3 espaços  →
        </button>

        <p className="caveat-decorativo text-polia-terracota/75 mt-4">
          leva uns 15 minutinhos. dá pra pausar quando quiser.
        </p>
      </div>
    </div>
  );
}

/* ============== Layout E4.2-E4.4 ============== */
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
    { num: 1, label: "Produto" },
    { num: 2, label: "Entrega" },
    { num: 3, label: "Valor" },
  ];
  const activeIndex = step - 2;

  return (
    <div className="min-h-screen w-full bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />
      <EtapaTopBar etapa={4} fase="CONSTRUÇÃO" nome="Presença" />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 md:py-12 lg:gap-10">
        <aside className="hidden w-[280px] shrink-0 rounded-[16px] bg-[#F5F0EA] p-8 lg:block">
          <p className="font-accent text-[10px] font-bold tracking-[1.5px] text-polia-mostarda-intenso uppercase">
            ETAPA 4 · PRESENÇA DIGITAL
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[28px] leading-[34px] mt-2">
            Sua ficha
            <br />
            de produto.
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
            a sua ficha de produto
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

/* ============== E4.5 — Ficha de Produto (COSMIC) ============== */
function FichaTela({
  loading,
  ficha,
  error,
  businessName,
  onAjustar,
  onContinuar,
  onRetry,
}: {
  loading: boolean;
  ficha: FichaProduto | null;
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
              montando sua ficha...
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

        {!loading && !error && ficha && (
          <>
            <p className="font-accent text-[11px] font-bold tracking-[2.5px] text-polia-mostarda-intenso">
              ENTREGÁVEL · ETAPA 4 · PRESENÇA DIGITAL
            </p>
            <p className="caveat-informacional text-polia-terracota mt-4">olha sua ficha pronta.</p>
            <h1 className="font-serif text-polia-marrom text-[28px] sm:text-[34px] md:text-[52px] leading-[1.1] mt-3">
              Sua ficha de produto
              <br />
              tá no ar.
            </h1>

            <div className="mt-10 w-full max-w-[820px] rounded-[20px] border border-polia-mostarda/40 bg-[#FAF4EF] p-8 text-left">
              <p className="font-accent text-[10px] font-bold tracking-[1.8px] text-polia-terracota">
                FICHA DE PRODUTO · {(businessName || "Sua marca").toUpperCase()}
              </p>
              <p className="font-serif text-[#1A1A2E] text-[22px] mt-2">O que você vende</p>
              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-sans text-[#1A1A2E] text-[16px] leading-[26px]">
                {ficha.descricao_refinada}
              </p>

              <hr className="border-[#EAE2D8] my-5" />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                    COMO ENTREGA
                  </p>
                  <p className="font-sans text-[#1A1A2E] text-[15px] leading-[24px] mt-2">
                    {ficha.entrega}
                  </p>
                </div>
                <div>
                  <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                    A PARTIR DE
                  </p>
                  <p className="font-serif text-polia-terracota text-[22px] mt-2">{ficha.preco_destaque}</p>
                </div>
              </div>

              <hr className="border-[#EAE2D8] my-5" />

              <p className="font-accent text-[9px] font-bold tracking-[1.5px] text-[#6A6A7E] uppercase">
                IDEAL PARA
              </p>
              <p className="caveat-decorativo text-polia-terracota mt-2">{ficha.cliente_ideal}</p>

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

/* ============== E4.6 — Conclusão marco 4 ============== */
function Conclusao({ onVerPainel, onEtapa5 }: { onVerPainel: () => void; onEtapa5: () => void }) {
  return (
    <ConclusaoEtapa
      numero={4}
      nomeEtapa="Presença digital"
      palavraHighlight="Presença"
      palavraMarco="PRESENÇA"
      ferramentaDesbloqueada={{
        titulo: "Sua Vitrine",
        descricao: "Sua ficha de produto foi adicionada. Agora sua vitrine online começa a tomar forma.",
      }}
      proximaEtapaLabel="Começar Etapa 5 →"
      onVerPainel={onVerPainel}
      onProximaEtapa={onEtapa5}
    />
  );
}
