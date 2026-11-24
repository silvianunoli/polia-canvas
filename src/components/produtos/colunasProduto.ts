/**
 * Colunas que o cadastro de produto lê. Uma lista só pra lista de Produtos e
 * pra página de editar (ONE-254): coluna que falta aqui some do formulário e
 * o "Salvar produto" grava o padrão por cima.
 */
export const SELECT_PRODUTO =
  "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, observacao_interna, canal, controla_estoque, no_catalogo, usa_paleta, cor_da_foto, max_cores, preco_sob_consulta, cor_sob_consulta, tamanho_sob_consulta, pronta_entrega, catalogo_ordem, categoria_id, preco_promocional, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at";

/** Chaves que a lista de Produtos relê depois de salvar um cadastro. */
export function chavesDoCatalogo(userId: string | undefined): unknown[][] {
  return [
    ["produtos", userId],
    ["produtos-arquivados", userId],
    ["painel-produtos-inativos", userId],
    ["estoque", userId],
    ["produto-skus"],
    ["produtos-total-ativos", userId],
    ["calculadora-tem-preco", userId],
    ["primeiros-passos", userId],
  ];
}
