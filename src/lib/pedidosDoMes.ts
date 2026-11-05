import { ehLancamentoDeVenda, type LancamentoComOrigem } from "@/lib/lucroDoMes";
import { chaveDoMes, ehEntradaDeVenda } from "@/lib/numerosDoMes";
import type { StatusVenda } from "@/lib/vendas";

/**
 * Quantos pedidos a marca teve no mês (cartão "Pedidos · mês" do Painel, ONE-172).
 *
 * Era a contagem de lançamentos de venda. Venda a receber só vira lançamento
 * quando é paga, então 8 pedidos, 4 pagos e 4 a receber, davam 4 aqui e 8 no
 * cartão "Vendas · mês" logo abaixo.
 *
 * A regra:
 *   pedidos = vendas do mês que não foram canceladas (o mesmo número do cartão
 *             de Vendas, pagas e a receber)
 *           + entradas de venda ou serviço lançadas à mão (sem venda por trás)
 *
 * O lançamento que uma venda paga gravou não conta de novo. Sem as vendas
 * (`null` = leitura falhou), sobra a contagem de lançamentos de venda.
 */
export interface PedidosDoMes {
  total: number;
  /** Vendas do mês, pagas e a receber. */
  vendas: number;
  /** Entradas de venda ou serviço lançadas à mão. */
  avulsas: number;
  vendasLidas: boolean;
}

export function pedidosDoMes(
  lancamentos: readonly LancamentoComOrigem[],
  vendas: readonly { status: StatusVenda }[] | null,
  ano: number,
  mes: number,
): PedidosDoMes {
  const chave = chaveDoMes(ano, mes);
  const deVenda = lancamentos.filter(
    (l) => l.data?.slice(0, 7) === chave && Number.isFinite(Number(l.valor)) && ehEntradaDeVenda(l),
  );
  if (vendas == null) {
    return { total: deVenda.length, vendas: 0, avulsas: deVenda.length, vendasLidas: false };
  }
  const validas = vendas.filter((v) => v.status !== "cancelada").length;
  const avulsas = deVenda.filter((l) => !ehLancamentoDeVenda(l)).length;
  return { total: validas + avulsas, vendas: validas, avulsas, vendasLidas: true };
}

/** A frase embaixo do número. `entradas` = quantas entradas houve no mês, venda ou não. */
export function legendaDosPedidos(p: PedidosDoMes, entradas: number): string {
  if (!p.vendasLidas) return "entradas marcadas como venda · as vendas não carregaram agora";
  if (p.total === 0) {
    return entradas > 0 ? "nenhuma entrada marcada como venda ou serviço" : "nenhuma ainda";
  }
  // Quando há as duas, a frase diz de onde veio a diferença pro cartão de Vendas.
  if (p.vendas > 0 && p.avulsas > 0) {
    const venda = p.vendas === 1 ? "1 venda" : `${p.vendas} vendas`;
    const avulsa =
      p.avulsas === 1 ? "1 entrada lançada à mão" : `${p.avulsas} entradas lançadas à mão`;
    return `${venda} e ${avulsa}`;
  }
  return p.total === 1 ? "venda ou serviço registrado" : "vendas e serviços registrados";
}
