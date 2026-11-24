// Leitura e escrita dos lembretes do Calendário (ONE-244) e das contas a pagar
// que aparecem na grade. A regra de repetição é pura e mora em
// supabase/functions/_shared/lembretesCalendario.ts, a mesma da edge function
// que manda o aviso.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ehAntecedencia,
  ehRepeticao,
  type Antecedencia,
  type Lembrete,
  type Repeticao,
} from "../../../supabase/functions/_shared/lembretesCalendario";

export const chaveLembretes = (userId: string | undefined) =>
  ["calendario-lembretes", userId] as const;

const COLUNAS = "id, titulo, observacao, dia, horario, repeticao, avisar_dias_antes, feitos";

type LinhaLembrete = {
  id: string;
  titulo: string;
  observacao: string | null;
  dia: string;
  horario: string | null;
  repeticao: string;
  avisar_dias_antes: number | null;
  feitos: string[] | null;
};

function daLinha(l: LinhaLembrete): Lembrete {
  return {
    id: l.id,
    titulo: l.titulo,
    observacao: l.observacao,
    dia: l.dia,
    horario: l.horario ? l.horario.slice(0, 5) : null,
    repeticao: ehRepeticao(l.repeticao) ? l.repeticao : "nenhuma",
    avisar_dias_antes: ehAntecedencia(l.avisar_dias_antes) ? l.avisar_dias_antes : null,
    feitos: l.feitos ?? [],
  };
}

/**
 * Lembretes que podem cair na grade [inicio, fim]: os sem repetição com o dia
 * dentro dela e os que repetem e começaram até o fim da grade.
 */
export function useLembretesDoPeriodo(
  userId: string | undefined,
  inicio: string,
  fim: string,
  ativo: boolean,
) {
  return useQuery({
    queryKey: [...chaveLembretes(userId), inicio, fim],
    enabled: !!userId && ativo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lembretes")
        .select(COLUNAS)
        .eq("user_id", userId!)
        .lte("dia", fim)
        .or(`repeticao.neq.nenhuma,dia.gte.${inicio}`)
        .order("dia", { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as LinhaLembrete[]).map(daLinha);
    },
  });
}

export interface LembreteParaSalvar {
  titulo: string;
  observacao: string | null;
  dia: string;
  horario: string | null;
  repeticao: Repeticao;
  avisar_dias_antes: Antecedencia | null;
}

/** Sem id cria; com id edita. */
export async function salvarLembrete(dados: LembreteParaSalvar, id?: string) {
  const linha = {
    titulo: dados.titulo.trim(),
    observacao: dados.observacao?.trim() || null,
    dia: dados.dia,
    horario: dados.horario || null,
    repeticao: dados.repeticao,
    avisar_dias_antes: dados.avisar_dias_antes,
  };
  const { error } = id
    ? await supabase.from("lembretes").update(linha).eq("id", id)
    : await supabase.from("lembretes").insert(linha as never);
  if (error) throw error;
}

export async function excluirLembrete(id: string) {
  const { error } = await supabase.from("lembretes").delete().eq("id", id);
  if (error) throw error;
}

/** Marca ou desmarca uma ocorrência como feita. */
export async function marcarFeito(l: Lembrete, ocorrencia: string, feito: boolean) {
  const outros = l.feitos.filter((f) => f !== ocorrencia);
  const feitos = feito ? [...outros, ocorrencia] : outros;
  const { error } = await supabase.from("lembretes").update({ feitos }).eq("id", l.id);
  if (error) throw error;
}

// ── contas a pagar na grade ──────────────────────────────────────────────────

export interface ContaNaGrade {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  paga: boolean;
}

export function useContasDoPeriodo(
  userId: string | undefined,
  inicio: string,
  fim: string,
  ativo: boolean,
) {
  return useQuery({
    queryKey: ["calendario-contas", userId, inicio, fim],
    enabled: !!userId && ativo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("id, descricao, valor, vencimento, status")
        .eq("user_id", userId!)
        .gte("vencimento", inicio)
        .lte("vencimento", fim)
        .order("vencimento", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (
        (data ?? []) as {
          id: string;
          descricao: string;
          valor: number;
          vencimento: string;
          status: string;
        }[]
      ).map(
        (c): ContaNaGrade => ({
          id: c.id,
          descricao: c.descricao,
          valor: Number(c.valor),
          vencimento: c.vencimento,
          paga: c.status === "paga",
        }),
      );
    },
  });
}
