import { useMemo } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/vitrine")({
  head: () => ({
    meta: [
      { title: "Sua Vitrine · Pólia" },
      {
        name: "description",
        content:
          "O que você vende, como aparece e como produz. Reunido num só lugar.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
  component: VitrinePage,
});

interface Entregavel {
  id: string;
  etapa: number;
  tipo: string;
  conteudo: Record<string, unknown> | null;
}

function VitrinePage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const dadosQuery = useQuery({
    queryKey: ["vitrine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, entregaveisRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, business_name, streak, etapa_atual, orbit_vitrine_unlocked, orbit_vitrine_active, star_4_completed_at, star_5_completed_at, star_6_completed_at",
          )
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("entregaveis")
          .select("id, etapa, tipo, conteudo")
          .eq("user_id", userId!)
          .in("etapa", [4, 5, 6])
          .eq("status", "concluido"),
      ]);
      return {
        profile: profileRes.data,
        entregaveis: (entregaveisRes.data ?? []) as Entregavel[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];

  const e4 = useMemo(() => entregaveis.find((e) => e.etapa === 4), [entregaveis]);
  const e5 = useMemo(() => entregaveis.find((e) => e.etapa === 5), [entregaveis]);
  const e6 = useMemo(() => entregaveis.find((e) => e.etapa === 6), [entregaveis]);

  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = (profile as { streak?: number } | null)?.streak ?? 0;
  const etapaAtual = (profile as { etapa_atual?: number } | null)?.etapa_atual ?? 1;

  if (dadosQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
        <p className="font-handwritten text-[#1A1A2E] text-[18px] opacity-40">
          carregando...
        </p>
      </div>
    );
  }

  if (!profile?.orbit_vitrine_unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center text-center px-8">
        <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-4">
          SUA VITRINE
        </p>
        <h1 className="font-serif text-[#FDF8F5] text-[48px] leading-tight mb-4 max-w-[520px]">
          Essa ferramenta entra em órbita quando você completar a Etapa 2.
        </h1>
        <p className="font-sans text-[#D8D2CC] text-[16px] max-w-[440px] mb-8">
          Seu produto, presença online e sistema de controle reunidos num só lugar.
        </p>
        <button
          onClick={() => navigate({ to: `/etapa/${etapaAtual}` })}
          className="bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[16px] px-8 py-3.5 rounded-xl hover:bg-[#B85A2D] transition-colors"
        >
          Continuar minha jornada →
        </button>
      </div>
    );
  }

  const etapasDone = [4, 5, 6].filter(
    (n) =>
      !!(profile as unknown as Record<string, string | null> | null)?.[
        `star_${n}_completed_at`
      ],
  ).length;
  const totalEtapas = 3;
  const faseCompleta = etapasDone === totalEtapas;

  const vitrineAtiva = !!(profile as { orbit_vitrine_active?: boolean } | null)?.orbit_vitrine_active;

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} navActive="/vitrine" />

      <div className="px-6 pt-8 pb-12 max-w-[1280px] mx-auto md:px-12 md:pt-10 md:pb-16">
        {/* Cabeçalho */}
        <div className="mb-8">
          <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-2">
            SUA VITRINE
          </p>
          <h1 className="font-serif text-[#1A1A2E] text-[28px] leading-tight md:text-[44px]">
            O que você vende. Como aparece. Como produz.
          </h1>
          <p className="font-handwritten text-[#C96B3E] text-[17px] mt-2">
            {vitrineAtiva
              ? "vitrine completa: produto, presença e controle."
              : "produto e presença prontos. sistema de controle vem na Etapa 6."}
          </p>
        </div>

        {/* Chip único da fase CONSTRUÇÃO */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
            style={{
              background: "rgba(26,127,173,0.08)",
              borderColor: "rgba(26,127,173,0.25)",
              color: "#1A7FAD",
            }}
          >
            {faseCompleta ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            <span className="font-accent text-[10px] tracking-[1.5px] uppercase font-bold">
              CONSTRUÇÃO · {etapasDone}/{totalEtapas}
            </span>
          </div>
        </div>

        {/* Grid de 3 vitrines lado a lado em desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch [&>div]:!max-w-none [&>div]:!mb-0 [&>div]:h-full">
          <CardFichaProduto
            entregavel={e4}
            done={!!profile?.star_4_completed_at}
            onIr={() => navigate({ to: "/etapa/4" })}
          />
          <CardGuiaImpressao
            entregavel={e5}
            done={!!profile?.star_5_completed_at}
            onIr={() => navigate({ to: "/etapa/5" })}
          />
          <CardSistemaControle
            entregavel={e6}
            done={!!profile?.star_6_completed_at}
            onIr={() => navigate({ to: "/etapa/6" })}
          />
        </div>
      </div>
    </div>
  );
}

/* ============== Card Ficha de Produto (E4) ============== */
function CardFichaProduto({
  entregavel,
  done,
  onIr,
}: {
  entregavel?: Entregavel;
  done: boolean;
  onIr: () => void;
}) {
  const ficha = entregavel?.conteudo as
    | {
        descricao_refinada?: string;
        entrega?: string;
        preco_destaque?: string;
        cliente_ideal?: string;
      }
    | null;
  const temFicha = !!ficha?.descricao_refinada;

  return (
    <div
      className={`bg-white rounded-2xl p-8 border mb-6 max-w-[760px] ${
        !done
          ? "border-dashed border-[rgba(26,26,46,0.08)] opacity-60"
          : "border-[rgba(26,26,46,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#1A7FAD] opacity-70 mb-1">
            ETAPA 4 · CONSTRUÇÃO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Ficha de produto
          </h2>
        </div>
        {temFicha && entregavel?.id && (
          <a
            href={`/biblioteca/${entregavel.id}`}
            className="font-sans text-[#C96B3E] text-[13px] hover:underline"
          >
            Editar →
          </a>
        )}
      </div>

      {temFicha && ficha ? (
        <>
          <div className="mb-4 pb-4 border-b border-[rgba(26,26,46,0.06)]">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
              DESCRIÇÃO
            </p>
            <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
              {ficha.descricao_refinada}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-4">
            <div>
              <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                COMO ENTREGA
              </p>
              <p className="font-sans text-[#1A1A2E] text-[14px] leading-relaxed">
                {ficha.entrega}
              </p>
            </div>
            <div>
              <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                PREÇO
              </p>
              <p className="font-sans text-[#1A1A2E] text-[14px] leading-relaxed">
                {ficha.preco_destaque}
              </p>
            </div>
          </div>

          <div className="bg-[rgba(26,127,173,0.04)] border border-[rgba(26,127,173,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A7FAD] opacity-70 mb-2">
              CLIENTE IDEAL
            </p>
            <p className="font-handwritten text-[#1A1A2E] text-[18px] leading-relaxed">
              "{ficha.cliente_ideal}"
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 4 pra gerar sua ficha de produto."
          cta="Ir pra Etapa 4 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

/* ============== Card Guia de Primeira Impressão (E5) ============== */
function CardGuiaImpressao({
  entregavel,
  done,
  onIr,
}: {
  entregavel?: Entregavel;
  done: boolean;
  onIr: () => void;
}) {
  const guia = entregavel?.conteudo as
    | {
        canal_principal?: string;
        aparencia_guia?: string;
        caminho_resumido?: string;
        bio_sugerida?: string;
      }
    | null;
  const temGuia = !!guia?.canal_principal;

  return (
    <div
      className={`bg-white rounded-2xl p-8 border mb-6 max-w-[760px] ${
        !done
          ? "border-dashed border-[rgba(26,26,46,0.08)] opacity-60"
          : "border-[rgba(26,26,46,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#1A7FAD] opacity-70 mb-1">
            ETAPA 5 · CONSTRUÇÃO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Guia de primeira impressão
          </h2>
        </div>
        {temGuia && entregavel?.id && (
          <a
            href={`/biblioteca/${entregavel.id}`}
            className="font-sans text-[#C96B3E] text-[13px] hover:underline"
          >
            Editar →
          </a>
        )}
      </div>

      {temGuia && guia ? (
        <>
          {[
            { label: "SEU CANAL PRINCIPAL", conteudo: guia.canal_principal },
            { label: "COMO VOCÊ APARECE", conteudo: guia.aparencia_guia },
            { label: "COMO A CLIENTE COMPRA", conteudo: guia.caminho_resumido },
          ]
            .filter((item) => !!item.conteudo)
            .map((item, i, arr) => (
              <div
                key={item.label}
                className={`mb-4 pb-4 ${
                  i === arr.length - 1
                    ? "border-none mb-0 pb-0"
                    : "border-b border-[rgba(26,26,46,0.06)]"
                }`}
              >
                <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                  {item.label}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
                  {item.conteudo}
                </p>
              </div>
            ))}

          <div className="mt-5 bg-[rgba(26,127,173,0.04)] border border-[rgba(26,127,173,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A7FAD] opacity-70 mb-2">
              SUA BIO SUGERIDA
            </p>
            <p className="font-handwritten text-[#1A1A2E] text-[19px] leading-relaxed">
              "{guia.bio_sugerida}"
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 5 pra gerar seu guia de presença."
          cta="Ir pra Etapa 5 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

/* ============== Card Sistema de Controle (E6) ============== */
function CardSistemaControle({
  entregavel,
  done,
  onIr,
}: {
  entregavel?: Entregavel;
  done: boolean;
  onIr: () => void;
}) {
  const sistema = entregavel?.conteudo as
    | {
        capacidade_resumida?: string;
        controle_atual?: string;
        gatilho_reposicao?: string;
        proximo_passo?: string;
      }
    | null;
  const temSistema = !!sistema?.capacidade_resumida;

  return (
    <div
      className={`bg-white rounded-2xl p-8 border mb-6 max-w-[760px] ${
        !done
          ? "border-dashed border-[rgba(26,26,46,0.08)] opacity-60"
          : "border-[rgba(26,26,46,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-accent text-[9px] tracking-[2px] uppercase text-[#1A7FAD] opacity-70 mb-1">
            ETAPA 6 · CONSTRUÇÃO
          </p>
          <h2 className="font-serif text-[#1A1A2E] text-[26px]">
            Sistema de controle
          </h2>
        </div>
        {temSistema && entregavel?.id && (
          <a
            href={`/biblioteca/${entregavel.id}`}
            className="font-sans text-[#C96B3E] text-[13px] hover:underline"
          >
            Editar →
          </a>
        )}
      </div>

      {temSistema && sistema ? (
        <>
          {[
            { label: "SUA CAPACIDADE", conteudo: sistema.capacidade_resumida },
            { label: "SEU CONTROLE HOJE", conteudo: sistema.controle_atual },
            { label: "QUANDO REPOR", conteudo: sistema.gatilho_reposicao },
          ]
            .filter((item) => !!item.conteudo)
            .map((item, i, arr) => (
              <div
                key={item.label}
                className={`mb-4 pb-4 ${
                  i === arr.length - 1
                    ? "border-none mb-0 pb-0"
                    : "border-b border-[rgba(26,26,46,0.06)]"
                }`}
              >
                <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
                  {item.label}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
                  {item.conteudo}
                </p>
              </div>
            ))}

          <div className="bg-[rgba(26,127,173,0.04)] border border-[rgba(26,127,173,0.12)] rounded-xl p-5">
            <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A7FAD] opacity-70 mb-2">
              PROXIMO PASSO
            </p>
            <p className="font-handwritten text-[#1A1A2E] text-[18px] leading-relaxed">
              {sistema.proximo_passo}
            </p>
          </div>
        </>
      ) : (
        <EstadoVazio
          texto="Complete a Etapa 6 pra gerar seu sistema de controle."
          cta="Ir pra Etapa 6 →"
          onClick={onIr}
        />
      )}
    </div>
  );
}

function EstadoVazio({
  texto,
  cta,
  onClick,
}: {
  texto: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="text-center py-8">
      <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40 mb-3">
        {texto}
      </p>
      <button
        onClick={onClick}
        className="font-sans text-[#C96B3E] text-[13px] hover:underline"
      >
        {cta}
      </button>
    </div>
  );
}
