// Sugestão de reposição (ONE-134). Puro: o quanto saiu vem somado do banco
// (saidas_por_sku / consumo_por_insumo, migration 20261023300000). A conta é a
// mesma pra produto e pra insumo:
//
//   sai por dia  = o que saiu na janela ÷ dias de histórico
//   precisa ter  = sai por dia x dias que ela quer cobrir + mínimo
//   repor        = precisa ter − o que tem
//
// A Pólia mostra o número e de onde ele vem; quem decide comprar é ela.

/** Quantos dias de histórico entram na conta do giro. */
export const JANELA_DIAS = 60;
/** Menos que isso de histórico, uma venda só fazia o giro explodir. */
const HISTORICO_MINIMO = 7;
/** Acaba em até isso, ou já está no mínimo: entra como "repor agora". */
export const DIAS_URGENTE = 7;

export const COBERTURAS = [15, 30, 60] as const;
export type Cobertura = (typeof COBERTURAS)[number];

export interface ItemParaRepor {
  chave: string;
  nome: string;
  saldo: number;
  minimo: number;
  /** Quanto saiu na janela (venda menos devolução; produção menos estorno). */
  saiu: number;
  /** Dias de histórico que valem pra este item (ver diasDeHistorico). */
  dias: number;
}

export interface Sugestao extends ItemParaRepor {
  porDia: number;
  /** Em quantos dias acaba no ritmo de hoje. null sem saída na janela. */
  acabaEm: number | null;
  /** Quanto precisa ter pra cobrir o prazo, já com o mínimo. */
  precisa: number;
  /** precisa − saldo, exato: a tela mostra os três e a conta fecha. */
  repor: number;
  urgente: boolean;
}

/** "2026-10-23" ou ISO completo → dias inteiros entre as duas datas (UTC). */
function diasEntre(de: string, ate: string): number {
  const a = Date.parse(de.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(ate.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return JANELA_DIAS;
  return Math.round((b - a) / 86400000);
}

/**
 * Item cadastrado há 10 dias não pode dividir o que saiu por 60: parecia
 * girar 6 vezes menos. Usa a idade do cadastro, entre 7 e a janela.
 */
export function diasDeHistorico(criadoEm: string | null | undefined, hoje: string): number {
  if (!criadoEm) return JANELA_DIAS;
  return Math.min(JANELA_DIAS, Math.max(HISTORICO_MINIMO, diasEntre(criadoEm, hoje)));
}

/** Arredonda pra cima: produto em peça inteira, insumo em até 3 casas. */
function paraCima(v: number, inteiro: boolean): number {
  const passo = inteiro ? 1 : 1000;
  // Folga de ponto flutuante: 12,0000000001 não vira 13.
  return Math.ceil(v * passo - 1e-9) / passo;
}

export function sugerirReposicao(
  itens: readonly ItemParaRepor[],
  cobertura: number,
  /** Peça inteira (produto, "un", folhas) ou fração (g, m). Por item. */
  opcoes: { inteiro: boolean | ((chave: string) => boolean) },
): Sugestao[] {
  const lista: Sugestao[] = [];
  for (const i of itens) {
    const saiu = Math.max(0, i.saiu);
    const porDia = saiu > 0 ? saiu / Math.max(1, i.dias) : 0;
    const noMinimo = i.saldo <= i.minimo;
    // Sem saída e acima do mínimo, nada indica que vai faltar.
    if (porDia === 0 && !noMinimo) continue;
    const inteiro = typeof opcoes.inteiro === "function" ? opcoes.inteiro(i.chave) : opcoes.inteiro;
    // Arredonda o "precisa ter" e só depois subtrai: arredondar os dois
    // separados fazia "precisa de 15, tem 3, faltam 13".
    const precisa = paraCima(porDia * cobertura + i.minimo, inteiro);
    const repor = Math.round((precisa - i.saldo) * 1000) / 1000;
    if (!(repor > 0)) continue;
    const acabaEm = porDia > 0 ? Math.max(0, i.saldo) / porDia : null;
    lista.push({
      ...i,
      porDia,
      acabaEm,
      precisa,
      repor,
      urgente: noMinimo || (acabaEm != null && acabaEm <= DIAS_URGENTE),
    });
  }
  return lista.sort(
    (a, b) =>
      Number(b.urgente) - Number(a.urgente) ||
      (a.acabaEm ?? Infinity) - (b.acabaEm ?? Infinity) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Insumo contado em peça ("un", folhas, pacotes) compra em número inteiro. */
export function contaEmPeca(unidade: string): boolean {
  return /^(un|unid|unidades?|pe[çc]as?|folhas?|pacotes?|cx|caixas?|rolos?)$/i.test(unidade.trim());
}
