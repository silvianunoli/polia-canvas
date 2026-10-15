import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { garantirBoasVindas } from "@/lib/boas-vindas.functions";
import { registrar } from "@/lib/founder-eventos";
import {
  businessTypeDaEscolha,
  contaVeBloco,
  escolhaDoBusinessType,
  limparNomeMarca,
  type EscolhaTipo,
} from "@/lib/primeirosPassos";
import { toastErro } from "@/lib/toast";

export interface DadosPrimeirosPassos {
  createdAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  escolhaTipo: EscolhaTipo | null;
  /** business_name sem espaço nas pontas ("" = sem nome). */
  nomeMarca: string;
  temPreco: boolean;
}

// Uma tentativa por aba: garantirBoasVindas já é idempotente no servidor (só
// marca com envio confirmado), e isto evita uma chamada a cada volta ao Painel.
const BOAS_VINDAS_TENTADA = "polia-boas-vindas-tentada";

function jaTentouBoasVindas(uid: string): boolean {
  try {
    return window.sessionStorage.getItem(BOAS_VINDAS_TENTADA) === uid;
  } catch {
    return false;
  }
}

function marcarTentativaBoasVindas(uid: string) {
  try {
    window.sessionStorage.setItem(BOAS_VINDAS_TENTADA, uid);
  } catch {
    // Sem sessionStorage: tenta de novo na próxima carga, como o /onboarding fazia.
  }
}

/**
 * Leitura e gravação do bloco "Primeiros passos" do Painel. A regra (quem vê,
 * o que está feito) mora em lib/primeirosPassos.ts.
 *
 * Também faz, sem tela, o que o fim do onboarding de 5 passos fazia: marca
 * profiles.onboarding_completed e registra o evento onboarding_completed do
 * Founder Dashboard, pra o funil do office ("Completou onboarding") e as
 * métricas que leem a coluna continuarem contando a conta nova.
 */
export function usePrimeirosPassos(userId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ["primeiros-passos", userId];

  const query = useQuery<DadosPrimeirosPassos>({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const [perfilRes, precoRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "created_at, onboarding_completed, onboarding_completed_at, business_type, business_name",
          )
          .eq("id", userId!)
          .maybeSingle(),
        // Mesma régua de "calculou o preço" do office (campanhas.functions):
        // produto salvo pela Calculadora tem calculadora_breakdown.
        supabase
          .from("produtos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .not("calculadora_breakdown", "is", null),
      ]);
      if (perfilRes.error) throw perfilRes.error;
      if (precoRes.error) throw precoRes.error;
      const p = perfilRes.data as {
        created_at: string | null;
        onboarding_completed: boolean | null;
        onboarding_completed_at: string | null;
        business_type: string | null;
        business_name: string | null;
      } | null;
      return {
        createdAt: p?.created_at ?? null,
        onboardingCompleted: !!p?.onboarding_completed,
        onboardingCompletedAt: p?.onboarding_completed_at ?? null,
        escolhaTipo: escolhaDoBusinessType(p?.business_type),
        nomeMarca: (p?.business_name ?? "").trim(),
        temPreco: (precoRes.count ?? 0) > 0,
      };
    },
  });

  const dados = query.data;

  // ── Onboarding marcado na primeira carga do Painel ──
  // Update condicional (só onde ainda é false): com duas abas abertas, só uma
  // grava e só ela registra o evento. Falhou: tenta de novo na próxima carga.
  // O cache não é atualizado de propósito: a leitura desta carga (pendente)
  // já decidiu que o bloco aparece, e a próxima lê onboarding_completed_at
  // posterior ao corte, que mantém o bloco (ver CORTE_PRIMEIROS_PASSOS).
  const marcouRef = useRef(false);
  useEffect(() => {
    if (!userId || !dados || dados.onboardingCompleted || marcouRef.current) return;
    marcouRef.current = true;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        } as never)
        .eq("id", userId)
        .eq("onboarding_completed", false)
        .select("id");
      if (error) {
        marcouRef.current = false;
        track("onboarding_marcar_falhou", { motivo: error.message || "erro_desconhecido" });
        return;
      }
      if (!data || data.length === 0) return;
      track("onboarding_concluido", { origem: "painel" });
      void registrar("onboarding_completed", {
        feature: "painel",
        propriedades: { origem: "primeiros_passos" },
      });
    })();
  }, [userId, dados]);

  // ── E-mail de boas-vindas ──
  // Saiu do load do /onboarding (que virou redirect). Só pra conta que entra
  // na regra do bloco, que é quem antes passava pelo /onboarding: sem isso,
  // conta antiga que nunca recebeu o e-mail ganharia um "Sua conta está
  // pronta" meses depois. Best-effort e silencioso; o servidor só marca a
  // conta como notificada quando o Resend confirma, então uma falha é tentada
  // de novo na próxima aba.
  useEffect(() => {
    if (!userId || !dados || !contaVeBloco(dados)) return;
    if (jaTentouBoasVindas(userId)) return;
    marcarTentativaBoasVindas(userId);
    garantirBoasVindas().catch(() => {});
  }, [userId, dados]);

  const atualizarCache = useCallback(
    (parcial: Partial<DadosPrimeirosPassos>) => {
      qc.setQueryData<DadosPrimeirosPassos>(["primeiros-passos", userId], (antigo) =>
        antigo ? { ...antigo, ...parcial } : antigo,
      );
    },
    [qc, userId],
  );

  /** Grava profiles.business_type. Devolve false (com toast) se falhar. */
  const salvarTipo = useCallback(
    async (escolha: EscolhaTipo): Promise<boolean> => {
      if (!userId) return false;
      const { error } = await supabase
        .from("profiles")
        .update({ business_type: businessTypeDaEscolha(escolha) } as never)
        .eq("id", userId);
      if (error) {
        track("primeiros_passos_tipo_falhou", { motivo: error.message || "erro_desconhecido" });
        toastErro(
          "A Pólia One não conseguiu salvar o que a sua marca vende. Tenta de novo, a escolha continua aqui.",
        );
        return false;
      }
      atualizarCache({ escolhaTipo: escolha });
      track("primeiros_passos_tipo", { escolha });
      return true;
    },
    [userId, atualizarCache],
  );

  /** Grava profiles.business_name, o mesmo campo do onboarding antigo e de Configurações. */
  const salvarNome = useCallback(
    async (bruto: string): Promise<boolean> => {
      const nome = limparNomeMarca(bruto);
      if (!userId || !nome) return false;
      const eraVazio = !dados?.nomeMarca;
      const { error } = await supabase
        .from("profiles")
        .update({ business_name: nome } as never)
        .eq("id", userId);
      if (error) {
        track("primeiros_passos_nome_falhou", { motivo: error.message || "erro_desconhecido" });
        toastErro(
          "A Pólia One não conseguiu salvar o nome da marca. Tenta de novo, o nome continua no campo.",
        );
        return false;
      }
      atualizarCache({ nomeMarca: nome });
      // O menu lateral mostra o nome da marca (useUserMeta).
      void qc.invalidateQueries({ queryKey: ["user-meta", userId] });
      // Mesmo evento do onboarding antigo e de Configurações (funil "Criou negócio").
      if (eraVazio) void registrar("business_created", { feature: "painel" });
      return true;
    },
    [userId, dados?.nomeMarca, atualizarCache, qc],
  );

  return {
    dados,
    carregando: !!userId && query.isPending,
    erro: query.isError,
    salvarTipo,
    salvarNome,
  };
}
