// Linha de material "pelo pacote" da calculadora (Produto): estado em texto,
// como os outros campos, e a ponte pra conta pura de precificacao.functions.
import { somarInsumos } from "@/lib/precificacao.functions";
import { num } from "./tipos";

export interface ItemInsumo {
  id: string;
  nome: string;
  /** R$ pagos no pacote. */
  pago: string;
  /** Quanto veio no pacote (500 folhas, 100 m). Vazio = 1. */
  rende: string;
  /** Texto livre só pra orientar ("folhas", "m", "g"). Não entra na conta. */
  unidade: string;
  /** Quanto vai em uma peça, na mesma unidade. */
  uso: string;
}

export function itemParaConta(it: ItemInsumo) {
  return { pago: num(it.pago), rende: num(it.rende), usoPorPeca: num(it.uso) };
}

export function totalDosInsumos(itens: ItemInsumo[]): number {
  return somarInsumos(itens.map(itemParaConta));
}
