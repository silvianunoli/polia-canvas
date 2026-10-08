import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * "Meta do mês": a meta em R$ que o Planejamento cria (trigger
 * materializar_planejamento, a partir de financeiro.meta_boa) e que Painel,
 * Financeiro, Calculadora, Projeção, Assistente e Raio-x leem.
 *
 * Fonte única da busca desde 08/10/2026 (QA-19). Antes cada tela fazia
 * `.eq("titulo", "Meta do mês").maybeSingle()`, o que quebrava de três jeitos:
 *  - duas linhas com esse título (criada à mão + criada pelo Planejamento)
 *    faziam o maybeSingle devolver erro, e Painel/Financeiro/Projeção caíam
 *    inteiros na tela de "não carregou";
 *  - meta arquivada continuava mandando nos números das 5 telas;
 *  - não havia critério de desempate.
 *
 * O título continua sendo a chave (é o que a trigger usa), por isso a tela de
 * Metas trava a renomeação dessa meta. Trocar a chave por uma coluna própria é
 * mudança de banco e ficou fora deste conserto.
 */
export const TITULO_META_DO_MES = "Meta do mês";

export interface LinhaMetaDoMes {
  id: string;
  valor_alvo: number | null;
  valor_atual: number | null;
  status: string | null;
  da_jornada: boolean | null;
  updated_at: string | null;
}

export type MetaDoMes = Pick<LinhaMetaDoMes, "id" | "valor_alvo" | "valor_atual">;

/** Arquivada é "não quero mais acompanhar": não manda em número nenhum. */
export function metaDoMesConta(status: string | null | undefined): boolean {
  return status !== "arquivada";
}

/**
 * Escolhe a linha que vale como Meta do mês entre as que têm o título.
 * Ordem de preferência: ativa antes de concluída (concluir a meta do mês não
 * apaga o alvo do mês), a criada pelo Planejamento antes da criada à mão, e a
 * atualizada mais recentemente. Arquivada nunca entra.
 */
export function escolherMetaDoMes<T extends LinhaMetaDoMes>(linhas: readonly T[]): T | null {
  const validas = linhas.filter((l) => metaDoMesConta(l.status));
  if (validas.length === 0) return null;
  const peso = (l: T) => (l.status === "ativa" ? 2 : 0) + (l.da_jornada ? 1 : 0);
  return [...validas].sort((a, b) => {
    const p = peso(b) - peso(a);
    if (p !== 0) return p;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  })[0];
}

type ClienteMetas = Pick<SupabaseClient<Database>, "from">;

/**
 * Busca a Meta do mês da usuária. Devolve no formato { data, error } do
 * supabase-js pra entrar no mesmo Promise.all das telas sem mudar o
 * tratamento de erro delas. `data` é null quando não há meta válida.
 */
export async function buscarMetaDoMes(
  client: ClienteMetas,
  userId: string,
): Promise<{ data: MetaDoMes | null; error: unknown }> {
  const { data, error } = await client
    .from("metas")
    .select("id, valor_alvo, valor_atual, status, da_jornada, updated_at")
    .eq("user_id", userId)
    .eq("titulo", TITULO_META_DO_MES);
  if (error) return { data: null, error };
  const escolhida = escolherMetaDoMes((data ?? []) as LinhaMetaDoMes[]);
  return {
    data: escolhida
      ? { id: escolhida.id, valor_alvo: escolhida.valor_alvo, valor_atual: escolhida.valor_atual }
      : null,
    error: null,
  };
}

/**
 * Teto de metas ativas ao mesmo tempo. Vale pra TODO plano: é regra de foco,
 * não cota de assinatura (ver a nota em src/lib/planos.ts).
 *
 * A Meta do mês NÃO conta no teto (ONE-87, decisão da Sil em 08/10/2026): ela
 * é a meta do Planejamento, nasce pela trigger materializar_planejamento mesmo
 * com 3 ativas, e contá-la fazia a usuária com 3 metas próprias ver "4 de 3".
 */
export const LIMITE_METAS_ATIVAS = 3;

/** Metas ativas que ocupam vaga no teto: todas menos a Meta do mês. */
export function ativasNoLimite<T extends { titulo: string; status: string | null }>(
  metas: readonly T[],
): T[] {
  return metas.filter((m) => m.status === "ativa" && m.titulo !== TITULO_META_DO_MES);
}

/** Pode ativar (criar, reabrir ou desfazer a conclusão de) esta meta? */
export function podeAtivarMeta<T extends { id: string; titulo: string; status: string | null }>(
  meta: Pick<T, "id" | "titulo">,
  metas: readonly T[],
): boolean {
  if (meta.titulo === TITULO_META_DO_MES) return true;
  return ativasNoLimite(metas).filter((m) => m.id !== meta.id).length < LIMITE_METAS_ATIVAS;
}
