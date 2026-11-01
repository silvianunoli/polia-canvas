import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { percentualDe } from "@/lib/formatarReais";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { chaveDoMes, numerosDoMes, type LancamentoDoMes } from "@/lib/numerosDoMes";
import { ehCategoriaInsumos } from "@/lib/projecao.functions";
import { lucroDaVenda, type ItemVenda, type Venda } from "@/lib/vendas";

/**
 * Quanto a marca lucrou no mês, descontado o custo de cada produto vendido
 * (01/11/2026).
 *
 * Existe por causa do teste de 01/11 com conta nova: produto de custo R$ 15
 * vendido a R$ 23,08, 2 unidades. O cartão de Vendas dizia "a marca lucrou
 * R$ 16,16" e o "Quanto lucrou" do Painel dizia R$ 46,16, "100% de tudo que
 * entrou", porque era entradas - saídas do Financeiro e a conta nova não tinha
 * saída nenhuma. O custo do produto vendido não saía de lugar nenhum.
 *
 * A regra:
 *   lucro = soma de lucroDaVenda das vendas do mês
 *         + entradas do mês que não vieram de venda registrada (avulsas)
 *         - saídas do mês, menos as de Insumos (o material já está no custo
 *           de cada produto; tirar de novo contava o mesmo dinheiro duas vezes)
 *
 * Cai na conta antiga (entradas - saídas) quando não dá pra usar as vendas:
 * mês sem venda registrada, venda com item sem custo (a Pólia não inventa o
 * custo) ou leitura das vendas que falhou.
 */

/** Prefixo do `id_externo` que as RPCs de venda gravam no lançamento ("venda:<id>"). */
export const PREFIXO_LANCAMENTO_DE_VENDA = "venda:";

export interface LancamentoComOrigem extends LancamentoDoMes {
  /**
   * Origem do lançamento. `undefined` quando a leitura não trouxe a coluna:
   * aí a conta das avulsas usa entradas - recebido das vendas (mínimo 0).
   */
  id_externo?: string | null;
}

export type VendaDoMes = Pick<Venda, "status" | "desconto" | "taxaCanal" | "custoEnvio"> & {
  total: number;
  itens: ItemVenda[];
};

export type MotivoContaDeCaixa = "sem_vendas" | "venda_sem_custo" | "vendas_nao_lidas";

export interface LucroDoMes {
  valor: number;
  /** Base do percentual: o que entrou no mês (e, com venda a receber, o que vai entrar). */
  base: number;
  /** "vendas" = pelo custo de cada produto; "caixa" = entradas - saídas. */
  fonte: "vendas" | "caixa";
  /** Só na conta de caixa: por que as vendas não entraram. */
  motivo: MotivoContaDeCaixa | null;
  /** Líquido das vendas do mês ainda a receber (já está no lucro). */
  aReceber: number;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function ehLancamentoDeVenda(l: Pick<LancamentoComOrigem, "id_externo">): boolean {
  return (l.id_externo ?? "").startsWith(PREFIXO_LANCAMENTO_DE_VENDA);
}

/**
 * @param lancamentos lançamentos do Financeiro (o mês é filtrado aqui).
 * @param vendas vendas do mês, já no período do cartão de Vendas
 *   (`intervaloDoPeriodo("mes")`); canceladas são ignoradas aqui.
 *   `null` = a leitura das vendas falhou.
 */
export function lucroDoMes(
  lancamentos: readonly LancamentoComOrigem[],
  vendas: readonly VendaDoMes[] | null,
  ano: number,
  mes: number,
): LucroDoMes {
  const n = numerosDoMes(lancamentos, ano, mes);
  const caixa = (motivo: MotivoContaDeCaixa): LucroDoMes => ({
    valor: centavos(n.sobra),
    base: n.entradas,
    fonte: "caixa",
    motivo,
    aReceber: 0,
  });

  if (vendas == null) return caixa("vendas_nao_lidas");
  const validas = vendas.filter((v) => v.status !== "cancelada");
  if (validas.length === 0) return caixa("sem_vendas");

  let lucroVendas = 0;
  let recebido = 0;
  let aReceber = 0;
  for (const v of validas) {
    const lucro = lucroDaVenda(v);
    if (lucro == null) return caixa("venda_sem_custo");
    lucroVendas += lucro;
    // Mesmo valor que a RPC grava no lançamento: total - taxa - frete pago por ela.
    const liquido = v.total - v.taxaCanal - (v.custoEnvio ?? 0);
    if (v.status === "a_receber") aReceber += liquido;
    else recebido += liquido;
  }

  const chave = chaveDoMes(ano, mes);
  const doMes = lancamentos.filter((l) => l.data && l.data.slice(0, 7) === chave);
  const origemConhecida = doMes.every((l) => l.id_externo !== undefined);

  let avulsas = 0;
  let saidasSemInsumo = 0;
  for (const l of doMes) {
    const valor = Number(l.valor);
    if (!Number.isFinite(valor)) continue;
    if (l.tipo === "entrada" && origemConhecida && !ehLancamentoDeVenda(l)) avulsas += valor;
    if (l.tipo === "saida" && !ehCategoriaInsumos(l.categoria)) saidasSemInsumo += valor;
  }
  // Sem a origem de cada lançamento, a avulsa é o que entrou além do que as
  // vendas recebidas deixaram no caixa.
  if (!origemConhecida) avulsas = Math.max(0, n.entradas - recebido);

  return {
    valor: centavos(lucroVendas + avulsas - saidasSemInsumo),
    base: centavos(recebido + aReceber + avulsas),
    fonte: "vendas",
    motivo: null,
    aReceber: centavos(aReceber),
  };
}

/**
 * A frase embaixo do número (Painel, Financeiro). Diz de onde o número veio,
 * pra ele não parecer contradizer o cartão de Vendas nem a soma de entradas
 * menos saídas que está do lado.
 */
export function legendaDoLucro(l: LucroDoMes): string {
  const pct = percentualDe(l.valor, l.base);
  if (l.fonte === "vendas") {
    return l.aReceber > 0
      ? `${pct}% do que vendeu · pelo custo de cada produto`
      : `${pct}% do que entrou · pelo custo de cada produto`;
  }
  // O custo do item é guardado na hora da venda (registrar_venda): cadastrar
  // o custo em Produtos vale pras próximas vendas, não refaz a que já entrou.
  if (l.motivo === "venda_sem_custo") {
    return "entradas menos saídas: tem venda sem o custo do produto · cadastre o custo em Produtos";
  }
  if (l.motivo === "vendas_nao_lidas")
    return "entradas menos saídas · as vendas não carregaram agora";
  return l.base > 0 ? `${pct}% de tudo que entrou` : "registre entradas e saídas pra ver";
}

type ClienteVendas = Pick<SupabaseClient<Database>, "from">;

type VendaLida = {
  status: string;
  desconto: number | string | null;
  taxa_canal: number | string | null;
  custo_envio: number | string | null;
  total: number | string | null;
  venda_itens:
    | {
        produto_id: string | null;
        produto_nome: string;
        quantidade: number | string;
        preco_unitario: number | string;
        custo_unitario: number | string | null;
      }[]
    | null;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * Vendas com data entre `de` e `ate` (AAAA-MM-DD, inclusivas), lidas inteiras.
 * Serve a quem lê no servidor (Raio-x, Assistente) e não tem o hook useVendas.
 * Cliente com service role precisa deste filtro por user_id: não há RLS.
 * Erro de leitura sobe.
 */
export async function lerVendasDoPeriodo(
  client: ClienteVendas,
  userId: string,
  de: string,
  ate: string,
): Promise<VendaDoMes[]> {
  const linhas = await lerTodasAsPaginas<VendaLida>((ini, fim) =>
    client
      .from("vendas")
      .select(
        "status, desconto, taxa_canal, custo_envio, total, venda_itens(produto_id, produto_nome, quantidade, preco_unitario, custo_unitario)",
      )
      .eq("user_id", userId)
      .gte("data", de)
      .lte("data", ate)
      .order("id", { ascending: true })
      .range(ini, fim)
      .then((r) => ({ data: r.data as unknown as VendaLida[] | null, error: r.error })),
  );
  return linhas.map((v) => ({
    status: v.status as Venda["status"],
    desconto: num(v.desconto),
    taxaCanal: num(v.taxa_canal),
    custoEnvio: num(v.custo_envio),
    total: num(v.total),
    itens: (v.venda_itens ?? []).map((i) => ({
      produtoId: i.produto_id,
      produtoNome: i.produto_nome,
      quantidade: num(i.quantidade),
      precoUnitario: num(i.preco_unitario),
      custoUnitario: i.custo_unitario == null ? null : Number(i.custo_unitario),
    })),
  }));
}
