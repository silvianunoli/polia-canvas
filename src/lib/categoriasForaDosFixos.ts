// Saídas que nunca são custo fixo: insumo e compra de equipamento. Moravam em
// projecao.functions.ts; saíram pra cá em 24/11/2026 (ONE-251) porque a
// Projeção passou a ler a lista de custos fixos de custosFixos.functions.ts, e
// esse arquivo já importava estas duas de lá (import circular).
// projecao.functions.ts reexporta tudo, então os imports antigos seguem valendo.

function mesmaCategoria(categoria: string | null | undefined, alvo: string): boolean {
  if (!categoria) return false;
  return categoria.trim().toLocaleLowerCase("pt-BR") === alvo.toLocaleLowerCase("pt-BR");
}

// ── Insumo fora dos custos fixos (decisão da Sil, 07/10/2026) ──
// Compra de insumo/matéria-prima já entra no custo de CADA produto (é o
// "custo médio" que sai do ticket pra dar a sobra por venda). Somar essa
// compra também nos custos fixos contava o mesmo dinheiro duas vezes e
// inflava o ponto de empate (caderno a R$ 49 com sobra de R$ 19,60, R$ 600 de
// fixos e R$ 1.000 de insumo: 82 vendas em vez de 31).
//
// Mesmo texto do chip padrão de saída (categoriasLancamento.ts,
// CATEGORIAS_SAIDA). Se o chip for renomeado lá, renomeie aqui.
export const CATEGORIA_INSUMOS = "Insumos / estoque";

export function ehCategoriaInsumos(categoria: string | null | undefined): boolean {
  return mesmaCategoria(categoria, CATEGORIA_INSUMOS);
}

// A compra da máquina acontece uma vez e o preço já entra como reserva por mês
// (ONE-193). Contar a compra inteira no mês em que foi paga derrubava o lucro e
// o ponto de empate daquele mês. A mesma string está na RPC
// marcar_equipamento_comprado: renomear aqui exige migration.
export const CATEGORIA_EQUIPAMENTO = "Compra de equipamento";

export function ehCompraDeEquipamento(categoria: string | null | undefined): boolean {
  return mesmaCategoria(categoria, CATEGORIA_EQUIPAMENTO);
}
