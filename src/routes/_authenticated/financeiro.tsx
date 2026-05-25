import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Seu Painel Financeiro — Pólia" },
      {
        name: "description",
        content:
          "Acompanhe receita, meta e plano de crescimento do seu negócio.",
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
  component: FinanceiroPage,
});

interface Entregavel {
  id: string;
  etapa: number;
  tipo: string;
  conteudo: Record<string, unknown> | null;
}

interface PainelNumeros {
  numero_1?: string;
  numero_2?: string;
  numero_3?: string;
  ritmo_recomendado?: string;
  gatilho_principal?: string;
}

interface PlanoCrescimento {
  visao_refinada?: string;
  rede_descrita?: string;
  proximo_passo?: string;
  afirmacao?: string;
}

function FinanceiroPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const dadosQuery = useQuery({
    queryKey: ["financeiro", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, progressRes, finRes, entregaveisRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "full_name, orbit_financial_unlocked, orbit_financial_active",
            )
            .eq("id", userId!)
            .maybeSingle(),
          supabase
            .from("user_progress")
            .select("etapa_atual")
            .eq("user_id", userId!)
            .maybeSingle(),
          supabase
            .from("financeiro_mensal")
            .select("id, receita, meta")
            .eq("user_id", userId!)
            .eq("mes", mesAtual)
            .eq("ano", anoAtual)
            .maybeSingle(),
          supabase
            .from("entregaveis")
            .select("id, etapa, tipo, conteudo")
            .eq("user_id", userId!)
            .in("etapa", [10, 11])
            .eq("status", "concluido")
            .order("created_at", { ascending: false }),
        ]);
      return {
        profile: profileRes.data,
        progress: progressRes.data,
        financeiro: finRes.data,
        entregaveis: (entregaveisRes.data ?? []) as Entregavel[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const etapaAtual = dadosQuery.data?.progress?.etapa_atual ?? 1;
  const financeiro = dadosQuery.data?.financeiro;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];

  const initial =
    (profile?.full_name ?? user?.user_metadata?.full_name ?? "P")
      .charAt(0)
      .toUpperCase() || "P";

  const unlocked = !!profile?.orbit_financial_unlocked;
  const active = !!profile?.orbit_financial_active;

  // ============ ESTADO BLOQUEADO ============
  if (dadosQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F5]">
        <PainelNav initial={initial} streak={0} navActive="/financeiro" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A2E]">
        <PainelNav initial={initial} streak={0} navActive="/financeiro" />
        <div className="flex flex-col items-center justify-center px-8 py-32 text-center">
          <p className="mb-4 font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
            SEU PAINEL FINANCEIRO
          </p>
          <h1 className="mb-4 max-w-[520px] font-serif text-[48px] leading-tight text-[#FDF8F5]">
            Essa ferramenta entra em órbita quando você chegar na Etapa 10.
          </h1>
          <p className="mb-8 max-w-[440px] font-sans text-[16px] text-[#D8D2CC]">
            Complete as etapas de Evolução pra montar seu painel de
            acompanhamento e plano de crescimento.
          </p>
          <button
            onClick={() => navigate({ to: `/etapa/${etapaAtual}` as "/etapa/1" })}
            className="rounded-xl bg-[#C96B3E] px-8 py-3.5 font-sans text-[16px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
          >
            Continuar minha jornada →
          </button>
          <p className="mt-4 font-handwritten text-[14px] text-[#D8D2CC] opacity-50">
            quase lá.
          </p>
        </div>
      </div>
    );
  }

  // ============ ESTADO ATIVO / PARCIAL ============
  const painelEntregavel = entregaveis.find((e) => e.etapa === 10);
  const planoEntregavel = entregaveis.find((e) => e.etapa === 11);
  const painelData = (painelEntregavel?.conteudo ?? {}) as PainelNumeros;
  const planoData = (planoEntregavel?.conteudo ?? {}) as PlanoCrescimento;

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={0} navActive="/financeiro" />

      <div className="mx-auto max-w-[1280px] px-6 py-10 md:px-12">
        {/* CABEÇALHO */}
        <div className="mb-8">
          <p className="mb-2 font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
            SEU PAINEL FINANCEIRO
          </p>
          <h1 className="font-serif text-[44px] leading-tight text-[#1A1A2E]">
            O que você mede, cresce.
          </h1>
          <p className="mt-2 font-handwritten text-[17px] text-[#C96B3E]">
            {active
              ? "painel completo: números, crescimento e rede."
              : "painel de números montado. plano de crescimento vem na Etapa 11."}
          </p>
        </div>

        {/* RECEITA + META */}
        <ReceitaMetaSection
          userId={userId}
          mes={mesAtual}
          ano={anoAtual}
          rowId={financeiro?.id}
          receita={Number(financeiro?.receita ?? 0)}
          meta={Number(financeiro?.meta ?? 0)}
          onUpdate={() => qc.invalidateQueries({ queryKey: ["financeiro", userId] })}
        />

        {/* PAINEL DE 3 NÚMEROS */}
        {painelEntregavel ? (
          <>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="mb-1 font-accent text-[10px] font-bold uppercase tracking-[2px] text-[#1A1A2E] opacity-40">
                  ENTREGÁVEL · ETAPA 10
                </p>
                <h2 className="font-serif text-[32px] text-[#1A1A2E]">
                  Painel de 3 números
                </h2>
              </div>
              <a
                href={`/biblioteca/${painelEntregavel.id}`}
                className="font-sans text-[13px] text-[#C96B3E] hover:underline"
              >
                Editar →
              </a>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { ordem: 1, conteudo: painelData.numero_1 },
                { ordem: 2, conteudo: painelData.numero_2 },
                { ordem: 3, conteudo: painelData.numero_3 },
              ].map((item) => (
                <div
                  key={item.ordem}
                  className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-6 shadow-sm"
                >
                  <p className="mb-3 font-serif text-[32px] leading-none text-[#C96B3E]">
                    {item.ordem}
                  </p>
                  <p className="font-sans text-[14px] leading-relaxed text-[#1A1A2E]">
                    {item.conteudo ?? "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-6">
                <p className="mb-2 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40">
                  SEU RITMO DE REVISÃO
                </p>
                <p className="font-sans text-[15px] leading-relaxed text-[#1A1A2E]">
                  {painelData.ritmo_recomendado ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(201,107,62,0.15)] bg-[rgba(201,107,62,0.04)] p-6">
                <p className="mb-2 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#C96B3E]">
                  QUANDO AGIR
                </p>
                <p className="font-handwritten text-[17px] leading-snug text-[#1A1A2E]">
                  {painelData.gatilho_principal ?? "—"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-8 rounded-2xl border-2 border-dashed border-[rgba(26,26,46,0.08)] py-12 text-center">
            <p className="mb-3 font-sans text-[15px] text-[#1A1A2E] opacity-40">
              Complete a Etapa 10 pra montar seu painel de 3 números.
            </p>
            <button
              onClick={() => navigate({ to: "/etapa/10" })}
              className="font-sans text-[14px] text-[#C96B3E] hover:underline"
            >
              Ir pra Etapa 10 →
            </button>
          </div>
        )}

        {/* PLANO DE CRESCIMENTO */}
        {!active || !planoEntregavel ? (
          <div className="rounded-2xl border-2 border-dashed border-[rgba(26,26,46,0.08)] bg-[rgba(26,26,46,0.04)] p-10 text-center">
            <p className="mb-2 font-serif text-[24px] text-[#1A1A2E] opacity-50">
              Plano de Crescimento
            </p>
            <p className="mb-4 font-sans text-[14px] text-[#1A1A2E] opacity-35">
              Complete a Etapa 11 pra gerar seu plano de crescimento.
            </p>
            <button
              onClick={() => navigate({ to: "/etapa/11" })}
              className="font-sans text-[14px] text-[#C96B3E] hover:underline"
            >
              Ir pra Etapa 11 →
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="mb-1 font-accent text-[10px] font-bold uppercase tracking-[2px] text-[#1A1A2E] opacity-40">
                  ENTREGÁVEL · ETAPA 11
                </p>
                <h2 className="font-serif text-[32px] text-[#1A1A2E]">
                  Plano de Crescimento
                </h2>
              </div>
              <a
                href={`/biblioteca/${planoEntregavel.id}`}
                className="font-sans text-[13px] text-[#C96B3E] hover:underline"
              >
                Editar →
              </a>
            </div>

            <div className="max-w-[760px] rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-8">
              {[
                { label: "SUA VISÃO", conteudo: planoData.visao_refinada },
                { label: "SUA REDE", conteudo: planoData.rede_descrita },
                { label: "PRÓXIMO PASSO", conteudo: planoData.proximo_passo },
              ].map((item) => (
                <div
                  key={item.label}
                  className="mb-5 border-b border-[rgba(26,26,46,0.06)] pb-5 last:mb-0 last:border-none last:pb-0"
                >
                  <p className="mb-2 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40">
                    {item.label}
                  </p>
                  <p className="font-sans text-[15px] leading-relaxed text-[#1A1A2E]">
                    {item.conteudo ?? "—"}
                  </p>
                </div>
              ))}

              {planoData.afirmacao && (
                <div className="mt-6 rounded-xl border border-[rgba(201,107,62,0.15)] bg-[rgba(201,107,62,0.04)] p-5">
                  <p className="mb-2 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#C96B3E]">
                    SUA AFIRMAÇÃO
                  </p>
                  <p className="font-handwritten text-[20px] leading-snug text-[#1A1A2E]">
                    "{planoData.afirmacao}"
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReceitaMetaSection({
  userId,
  mes,
  ano,
  rowId,
  receita,
  meta,
  onUpdate,
}: {
  userId: string | undefined;
  mes: number;
  ano: number;
  rowId: string | undefined;
  receita: number;
  meta: number;
  onUpdate: () => void;
}) {
  const [editandoReceita, setEditandoReceita] = useState(false);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [receitaInput, setReceitaInput] = useState(String(receita || ""));
  const [metaInput, setMetaInput] = useState(String(meta || ""));

  useEffect(() => {
    setReceitaInput(String(receita || ""));
    setMetaInput(String(meta || ""));
  }, [receita, meta]);

  const upsertCampo = async (campo: "receita" | "meta", valor: number) => {
    if (!userId) return;
    if (rowId) {
      const patch =
        campo === "receita"
          ? { receita: valor, updated_at: new Date().toISOString() }
          : { meta: valor, updated_at: new Date().toISOString() };
      await supabase.from("financeiro_mensal").update(patch).eq("id", rowId);
    } else {
      await supabase.from("financeiro_mensal").insert({
        user_id: userId,
        mes,
        ano,
        receita: campo === "receita" ? valor : 0,
        meta: campo === "meta" ? valor : 0,
      });
    }
    onUpdate();
  };

  const salvarReceita = async () => {
    const v = parseFloat(receitaInput) || 0;
    await upsertCampo("receita", v);
    setEditandoReceita(false);
  };

  const salvarMeta = async () => {
    const v = parseFloat(metaInput) || 0;
    await upsertCampo("meta", v);
    setEditandoMeta(false);
  };

  const pct = useMemo(
    () => (meta > 0 ? Math.min((receita / meta) * 100, 100) : 0),
    [receita, meta],
  );

  return (
    <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Receita */}
      <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-6 shadow-sm">
        <p className="mb-4 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40">
          RECEITA · MÊS ATUAL
        </p>
        {editandoReceita ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-serif text-[24px] text-[#1A1A2E]">R$</span>
            <input
              type="number"
              value={receitaInput}
              onChange={(e) => setReceitaInput(e.target.value)}
              className="w-[160px] border-b-2 border-[#C96B3E] bg-transparent font-serif text-[36px] text-[#1A1A2E] outline-none"
              autoFocus
            />
            <button
              onClick={salvarReceita}
              className="ml-2 font-sans text-[14px] font-semibold text-[#C96B3E]"
            >
              salvar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditandoReceita(true)}
            className="group text-left"
          >
            <p className="font-serif text-[40px] leading-none text-[#1A1A2E] transition-colors group-hover:text-[#C96B3E]">
              {receita > 0 ? `R$ ${receita.toLocaleString("pt-BR")}` : "R$ 0"}
            </p>
            <p className="mt-1 font-sans text-[11px] text-[#C96B3E] opacity-0 transition-opacity group-hover:opacity-100">
              clique pra atualizar
            </p>
          </button>
        )}
        {meta > 0 && (
          <>
            <p className="mb-2 mt-3 font-sans text-[13px] text-[#1A1A2E] opacity-40">
              de R$ {meta.toLocaleString("pt-BR")} da sua meta
            </p>
            <div className="mb-1 h-2 w-full rounded-full bg-[#F5F5FA]">
              <div
                className="h-2 rounded-full bg-[#C96B3E] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-sans text-[12px] font-semibold text-[#C96B3E]">
              {Math.round(pct)}%
            </p>
          </>
        )}
      </div>

      {/* Meta */}
      <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-6 shadow-sm">
        <p className="mb-4 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40">
          SUA META DO MÊS
        </p>
        {editandoMeta ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-serif text-[24px] text-[#1A1A2E]">R$</span>
            <input
              type="number"
              value={metaInput}
              onChange={(e) => setMetaInput(e.target.value)}
              className="w-[160px] border-b-2 border-[#C96B3E] bg-transparent font-serif text-[36px] text-[#1A1A2E] outline-none"
              autoFocus
            />
            <button
              onClick={salvarMeta}
              className="ml-2 font-sans text-[14px] font-semibold text-[#C96B3E]"
            >
              salvar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditandoMeta(true)}
            className="group text-left"
          >
            <p className="font-serif text-[40px] leading-none text-[#1A1A2E] transition-colors group-hover:text-[#C96B3E]">
              {meta > 0 ? `R$ ${meta.toLocaleString("pt-BR")}` : "definir meta"}
            </p>
            <p className="mt-1 font-sans text-[11px] text-[#C96B3E] opacity-0 transition-opacity group-hover:opacity-100">
              clique pra editar
            </p>
          </button>
        )}
        {receita > 0 && meta > 0 && receita < meta && (
          <p className="mt-4 font-handwritten text-[14px] text-[#1A1A2E] opacity-50">
            falta R$ {(meta - receita).toLocaleString("pt-BR")} pra fechar a
            meta
          </p>
        )}
        {receita >= meta && meta > 0 && (
          <p className="mt-4 font-handwritten text-[14px] text-[#2D6A4F]">
            meta batida esse mês.
          </p>
        )}
      </div>
    </div>
  );
}
