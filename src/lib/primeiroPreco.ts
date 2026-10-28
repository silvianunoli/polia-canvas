// A Calculadora guarda o primeiro preço sozinha (GRW-90, 27/10/2026, plano
// docs/plano-primeiro-preco-guardado.md aprovado pela Sil). 87 contas novas
// abriram a Calculadora e 9 guardaram: guardar abria um modal de 9 campos e a
// conta sumia ao fechar a aba. Aqui mora só a regra; a gravação fica em
// hooks/useGuardarPrimeiroPreco.ts.

import {
  calcularQuantoSobra,
  taxasDoBreakdown,
  type CalculadoraBreakdown,
} from "@/lib/precificacao.functions";

export type PerfilCalculadora = CalculadoraBreakdown["perfil"];

/** Tempo sem mudança no resultado antes de gravar: não grava um preço por tecla. */
export const PAUSA_PRIMEIRO_PRECO_MS = 2000;

/** Mesmo teto do nome no catálogo. */
export const NOME_PRODUTO_MAX = 120;

/**
 * A conta entra na regra: ainda não tem preço calculado (nenhum produto com
 * calculadora_breakdown, a mesma leitura do passo dos Primeiros passos), não
 * está recalculando um produto e a aba é Produto ou Serviço. A Encomenda é Pro
 * e tem trava própria, fica no botão de sempre.
 */
export function deveGuardarSozinho(p: {
  temPreco: boolean;
  recalculando: boolean;
  perfil: PerfilCalculadora;
}): boolean {
  return !p.temPreco && !p.recalculando && p.perfil !== "encomenda";
}

/** Dá pra gravar agora: preço válido e o resultado já apareceu na tela. */
export function resultadoProntoPraGuardar(p: {
  precoNaoSalvavel: boolean;
  resultadoVisto: boolean;
}): boolean {
  return !p.precoNaoSalvavel && p.resultadoVisto;
}

export function nomeProvisorio(perfil: PerfilCalculadora): string {
  return perfil === "servico" ? "Primeiro serviço" : "Primeiro produto";
}

/** O que ela digitou, limpo; vazio volta pro provisório. */
export function nomeParaGuardar(digitado: string, perfil: PerfilCalculadora): string {
  const limpo = digitado.trim().slice(0, NOME_PRODUTO_MAX).trim();
  return limpo || nomeProvisorio(perfil);
}

/** Mesmo mapeamento do "Guardar esse preço" da Calculadora. */
export function tipoDoProduto(perfil: PerfilCalculadora): "fisico" | "servico" {
  return perfil === "servico" ? "servico" : "fisico";
}

/** A trigger assert_cota_confere recusou (catálogo do Grátis cheio). */
export function ehErroDeCota(mensagem: string | null | undefined): boolean {
  return !!mensagem && /limite do plano|cota do plano/i.test(mensagem);
}

/** Lucro por venda de um produto guardado pela Calculadora, com as taxas do breakdown. */
export function lucroDoProdutoCalculado(p: {
  precoVenda: number;
  precoCusto: number | null;
  breakdown: CalculadoraBreakdown | null;
}): number {
  return calcularQuantoSobra({
    precoVenda: p.precoVenda,
    precoCusto: p.precoCusto ?? 0,
    ...taxasDoBreakdown(p.breakdown),
  });
}
