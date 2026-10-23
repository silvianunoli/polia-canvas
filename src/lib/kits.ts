// Kit e combo (ONE-132). Puro: a gravação é da RPC salvar_kit e a baixa no
// estoque é do registrar_venda (migration 20261023260000). Aqui mora o que a
// tela mostra: quantos kits dá pra montar com o estoque e quanto custa um.

export interface ComponenteKit {
  componenteId: string;
  /** null = variação padrão do componente. */
  skuId: string | null;
  quantidade: number;
}

export interface ProdutoParaKit {
  id: string;
  nome: string;
  precoCusto: number | null;
  controlaEstoque: boolean;
  skus: { id: string; variacao: string | null; saldo: number }[];
}

/**
 * Quantos kits dá pra montar: o menor "saldo ÷ quantidade" entre os
 * componentes com estoque ligado. null quando nenhum componente controla
 * estoque (não há limite pra mostrar). Saldo negativo conta como zero.
 */
export function kitsQueDaPraMontar(
  componentes: readonly ComponenteKit[],
  produtos: ReadonlyMap<string, ProdutoParaKit>,
): number | null {
  let menor: number | null = null;
  for (const c of componentes) {
    const p = produtos.get(c.componenteId);
    // Quantidade apagada no meio da digitação não vira "Infinity kits".
    if (!p?.controlaEstoque || !(c.quantidade >= 1)) continue;
    const sku = c.skuId
      ? p.skus.find((s) => s.id === c.skuId)
      : p.skus.find((s) => s.variacao == null);
    const saldo = Math.max(0, sku?.saldo ?? 0);
    const montaveis = Math.floor(saldo / c.quantidade);
    menor = menor == null ? montaveis : Math.min(menor, montaveis);
  }
  return menor;
}

/** Custo de um kit: soma de quantidade x custo. null se algum componente não tem custo. */
export function custoDoKit(
  componentes: readonly ComponenteKit[],
  produtos: ReadonlyMap<string, ProdutoParaKit>,
): number | null {
  if (componentes.length === 0) return null;
  let total = 0;
  for (const c of componentes) {
    if (!(c.quantidade >= 1)) return null;
    const custo = produtos.get(c.componenteId)?.precoCusto;
    if (custo == null) return null;
    total += c.quantidade * custo;
  }
  return Math.round(total * 100) / 100;
}

export type ErroKit = "vazio" | "quantidade" | "variacao" | "repetido";

/**
 * Mesmas travas do salvar_kit, ditas antes de gravar. `precisaVariacao` diz
 * se o componente tem variações com nome e estoque ligado.
 */
export function validarKit(
  componentes: readonly ComponenteKit[],
  precisaVariacao: (componenteId: string) => boolean,
): ErroKit | null {
  if (componentes.length === 0) return "vazio";
  const vistos = new Set<string>();
  for (const c of componentes) {
    if (!Number.isInteger(c.quantidade) || c.quantidade < 1 || c.quantidade > 1000)
      return "quantidade";
    if (!c.skuId && precisaVariacao(c.componenteId)) return "variacao";
    const chave = `${c.componenteId}:${c.skuId ?? ""}`;
    if (vistos.has(chave)) return "repetido";
    vistos.add(chave);
  }
  return null;
}
