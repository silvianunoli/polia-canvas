// Formas de pagamento e de recebimento dos lançamentos (ONE-207). As de
// entrada são as mesmas das taxas (lib/taxas.ts, FORMAS_RECEBIMENTO). A saída
// tem também boleto (Sil, 23/11/2026: forma nas saídas), que é como se paga
// aluguel e fornecedor. O check de lancamentos.forma e contas_pagar.forma
// (migration 20261123120000) repete esta lista: forma nova pede migration.

import { FORMAS_RECEBIMENTO, ROTULO_TAXA, type FormaRecebimento } from "@/lib/taxas";

export type FormaLancamento = FormaRecebimento | "boleto";

export const FORMAS_ENTRADA: readonly FormaLancamento[] = FORMAS_RECEBIMENTO;

/** Boleto e Pix primeiro: é como a maioria das contas é paga. */
export const FORMAS_SAIDA: readonly FormaLancamento[] = [
  "pix",
  "boleto",
  "debito",
  "credito",
  "credito_parcelado",
  "dinheiro",
  "link",
];

export const TODAS_AS_FORMAS: readonly FormaLancamento[] = [...FORMAS_RECEBIMENTO, "boleto"];

export const ROTULO_FORMA_LANCAMENTO: Record<FormaLancamento, string> = {
  pix: ROTULO_TAXA.pix,
  dinheiro: ROTULO_TAXA.dinheiro,
  debito: ROTULO_TAXA.debito,
  credito: ROTULO_TAXA.credito,
  credito_parcelado: ROTULO_TAXA.credito_parcelado,
  link: ROTULO_TAXA.link,
  boleto: "Boleto",
};

export const formasDoTipo = (tipo: string): readonly FormaLancamento[] =>
  tipo === "saida" ? FORMAS_SAIDA : FORMAS_ENTRADA;

/** Forma guardada que não vale pro tipo (boleto numa entrada) vira vazio. */
export function formaValidaPara(
  tipo: string,
  forma: string | null | undefined,
): FormaLancamento | "" {
  return formasDoTipo(tipo).includes(forma as FormaLancamento) ? (forma as FormaLancamento) : "";
}
