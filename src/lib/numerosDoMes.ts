import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";

/**
 * Os números do mês corrente, numa conta só (08/10/2026).
 *
 * Existe porque a Meta do mês mostrava progresso diferente por tela: Painel e
 * Financeiro somavam as entradas do mês, e Metas usava o `valor_atual` digitado
 * à mão. Agora as três telas usam esta soma.
 */

/**
 * Categorias de entrada que contam como venda no cartão "Pedidos · mês".
 * São as duas que o produto grava sozinho: "Venda de produto" (venda de
 * cliente e venda de produto do catálogo) e "Prestação de serviço" (semente
 * do modal de lançamento). Entrada sem categoria, "Outros" e categoria criada
 * pela usuária (aporte, empréstimo, reembolso) não são pedido: contar toda
 * entrada inflava o número de vendas com dinheiro que não veio de venda.
 */
export const CATEGORIAS_DE_VENDA = ["Venda de produto", "Prestação de serviço"] as const;

export interface LancamentoDoMes {
  tipo: string;
  valor: number | string | null;
  data: string | null;
  categoria?: string | null;
}

export interface NumerosDoMes {
  entradas: number;
  saidas: number;
  /** entradas - saidas */
  sobra: number;
  /** Quantas entradas são venda (ver CATEGORIAS_DE_VENDA). */
  vendas: number;
  /** Quantas entradas houve no mês, venda ou não. */
  registrosDeEntrada: number;
}

/** "AAAA-MM" de um mês; `mes` vai de 1 a 12. */
export function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function ehEntradaDeVenda(l: Pick<LancamentoDoMes, "tipo" | "categoria">): boolean {
  if (l.tipo !== "entrada") return false;
  const c = (l.categoria ?? "").trim();
  return (CATEGORIAS_DE_VENDA as readonly string[]).includes(c);
}

export function numerosDoMes(
  lancamentos: readonly LancamentoDoMes[],
  ano: number,
  mes: number,
): NumerosDoMes {
  const chave = chaveDoMes(ano, mes);
  let entradas = 0;
  let saidas = 0;
  let vendas = 0;
  let registrosDeEntrada = 0;
  for (const l of lancamentos) {
    if (!l.data || l.data.slice(0, 7) !== chave) continue;
    const valor = Number(l.valor);
    if (!Number.isFinite(valor)) continue;
    if (l.tipo === "entrada") {
      entradas += valor;
      registrosDeEntrada += 1;
      if (ehEntradaDeVenda(l)) vendas += 1;
    } else if (l.tipo === "saida") {
      saidas += valor;
    }
  }
  return { entradas, saidas, sobra: entradas - saidas, vendas, registrosDeEntrada };
}

/**
 * Primeiro e último dia do mês de uma data AAAA-MM-DD, pro `min`/`max` do
 * campo de data. Usado no plano Grátis, que só vê o mês corrente: um
 * lançamento com data de outro mês sumia da tela pra sempre.
 */
export function limitesDoMes(iso: string): { min: string; max: string } {
  const [ano, mes] = iso.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const chave = chaveDoMes(ano, mes);
  return { min: `${chave}-01`, max: `${chave}-${String(ultimoDia).padStart(2, "0")}` };
}

/** A data está dentro do mês de `referencia` (as duas em AAAA-MM-DD). */
export function dataNoMesDe(data: string, referencia: string): boolean {
  const { min, max } = limitesDoMes(referencia);
  return data >= min && data <= max;
}

type ClienteLancamentos = Pick<SupabaseClient<Database>, "from">;

/**
 * Soma das entradas de um mês, lida inteira (página por página, QA-24).
 * É o "atual" da Meta do mês. Erro de leitura sobe: tela de dinheiro não
 * mostra soma parcial.
 */
export async function somarEntradasDoMes(
  client: ClienteLancamentos,
  userId: string,
  ano: number,
  mes: number,
): Promise<number> {
  const { inicio, fimExclusivo } = intervaloDoMes(ano, mes);
  const linhas = await lerTodasAsPaginas<{ valor: number | string | null }>((de, ate) =>
    client
      .from("lancamentos")
      .select("valor")
      .eq("user_id", userId)
      .eq("tipo", "entrada")
      .gte("data", inicio)
      .lt("data", fimExclusivo)
      .order("id", { ascending: true })
      .range(de, ate)
      .then((r) => ({
        data: r.data as unknown as { valor: number | string | null }[] | null,
        error: r.error,
      })),
  );
  let soma = 0;
  for (const l of linhas) {
    const v = Number(l.valor);
    if (Number.isFinite(v)) soma += v;
  }
  return soma;
}
