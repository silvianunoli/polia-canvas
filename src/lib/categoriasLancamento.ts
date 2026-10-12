// Categorias-semente do Financeiro. Moraram no ModalLancamento até o ONE-124,
// quando a importação de extrato passou a precisar da mesma lista pra sugerir
// categoria. Insumos e Pró-labore vêm das mesmas constantes que a Projeção usa
// pra tirar essas saídas dos custos fixos: renomear aqui sem renomear lá
// voltaria a contar insumo duas vezes no ponto de empate. Os custos fixos vêm
// da lista dos campos da calculadora (custosFixos.functions.ts), pro "puxar do
// Financeiro" de lá cair no campo certo.

import { CATEGORIA_INSUMOS } from "@/lib/projecao.functions";
import { CATEGORIAS_CUSTO_FIXO } from "@/lib/custosFixos.functions";
import { CATEGORIA_PRO_LABORE } from "@/lib/resumoContador.functions";
import { CATEGORIAS_DE_VENDA } from "@/lib/numerosDoMes";

// As duas de venda são as mesmas que o Painel conta em "Pedidos · mês".
export const CATEGORIAS_ENTRADA: string[] = [...CATEGORIAS_DE_VENDA, "Outros"];

export const CATEGORIAS_SAIDA: string[] = [
  CATEGORIA_INSUMOS,
  ...CATEGORIAS_CUSTO_FIXO,
  CATEGORIA_PRO_LABORE,
  "Outros",
];
