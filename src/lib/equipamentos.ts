// Equipamentos da marca (ONE-193): o que ela compra uma vez e usa por anos.
// Comprado é quem tem a saída no Financeiro; os outros ainda são orçamento.

export const MESES_USO_PADRAO = 36;
export const VALOR_MAXIMO = 1_000_000;
export const MESES_MAXIMO = 240;

export interface Equipamento {
  id: string;
  nome: string;
  valor: number;
  mesesUso: number;
  lancamentoId: string | null;
  /** Data da saída no Financeiro, AAAA-MM-DD. */
  compradoEm: string | null;
}

export interface ResumoEquipamentos {
  investido: number;
  faltaComprar: number;
  reservaDoMes: number;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function reservaDoEquipamento(e: Pick<Equipamento, "valor" | "mesesUso">): number {
  return e.mesesUso > 0 ? e.valor / e.mesesUso : 0;
}

/** A reserva soma comprados e planejados: o preço cobre a troca dos dois. */
export function resumoEquipamentos(lista: readonly Equipamento[]): ResumoEquipamentos {
  let investido = 0;
  let faltaComprar = 0;
  let reserva = 0;
  for (const e of lista) {
    if (e.lancamentoId) investido += e.valor;
    else faltaComprar += e.valor;
    reserva += reservaDoEquipamento(e);
  }
  return {
    investido: centavos(investido),
    faltaComprar: centavos(faltaComprar),
    reservaDoMes: centavos(reserva),
  };
}

export function erroDoValor(v: number): string | undefined {
  return v > 0 && v <= VALOR_MAXIMO ? undefined : "Coloque o preço, como 1359,00.";
}

export function erroDosMeses(v: number): string | undefined {
  return Number.isInteger(v) && v >= 1 && v <= MESES_MAXIMO
    ? undefined
    : `Coloque um número inteiro de meses, de 1 a ${MESES_MAXIMO}.`;
}
