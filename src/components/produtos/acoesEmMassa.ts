// Gravação das ações em massa do Catálogo (27/11/2026, pedido da Sil): ativar,
// inativar, pôr e tirar da Vitrine e excluir um ou vários produtos de uma vez.
// A tela (routes/_authenticated/produtos.tsx) decide quem entra; aqui só grava.

import { supabase } from "@/integrations/supabase/client";
import { caminhoNoBucket } from "@/components/produtos/useFotosDoProduto";

const BUCKET = "produtos-fotos";

export type MudancaEmMassa = { arquivado: boolean } | { no_catalogo: boolean };

/** Um UPDATE só: no plano Grátis, se a cota estoura num produto, nada muda. */
export async function mudarProdutosEmMassa(
  userId: string,
  ids: string[],
  mudanca: MudancaEmMassa,
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from("produtos")
    .update(mudanca)
    .in("id", ids)
    .eq("user_id", userId);
  if (error) console.error("produtos_em_massa", error);
  return { error: error ? error.message : null };
}

export interface ProdutoBloqueado {
  id: string;
  nome: string;
  /** Nomes dos kits que usam o produto como peça, separados por vírgula. */
  kits: string;
}

export interface ResultadoExclusao {
  excluidos: number;
  bloqueados: ProdutoBloqueado[];
}

/**
 * Exclui pela função excluir_produtos (migration 20261127230000), que limpa o
 * histórico de estoque e deixa de fora quem é peça de kit. Depois apaga as
 * fotos do bucket; se essa limpeza falhar, o produto já saiu e o arquivo
 * órfão não aparece em lugar nenhum, então não vira erro pra dona.
 */
export async function excluirProdutos(
  userId: string,
  produtos: { id: string; foto_url?: string | null }[],
): Promise<{ error: string | null; resultado: ResultadoExclusao | null }> {
  const ids = produtos.map((p) => p.id);
  const { data, error } = await supabase.rpc("excluir_produtos" as never, { p_ids: ids } as never);
  if (error) {
    console.error("excluir_produtos", error);
    return { error: error.message, resultado: null };
  }
  const bruto = (data ?? {}) as {
    excluidos?: number;
    bloqueados?: ProdutoBloqueado[];
    fotos?: string[];
  };
  const bloqueados = bruto.bloqueados ?? [];
  const ficaram = new Set(bloqueados.map((b) => b.id));
  const caminhos = new Set(bruto.fotos ?? []);
  for (const p of produtos) {
    if (ficaram.has(p.id)) continue;
    const caminho = caminhoNoBucket(p.foto_url, userId);
    if (caminho) caminhos.add(caminho);
  }
  if (caminhos.size > 0) {
    const { error: erroFotos } = await supabase.storage.from(BUCKET).remove([...caminhos]);
    if (erroFotos) console.error("excluir_produtos_fotos", erroFotos);
  }
  return { error: null, resultado: { excluidos: bruto.excluidos ?? 0, bloqueados } };
}
