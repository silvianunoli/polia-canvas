// Clientes que voltam e clientes sumidas (ONE-131). Puro: recebe o resumo de
// compras por cliente (função compras_por_cliente no banco) e as vendas do
// período. Benchmark Bling (Novo x Recorrentes e Atividade da Carteira, ONE-126).
//
// Só conta venda ligada a uma ficha de Clientes: nome solto não dá pra seguir.

import { diasEntreDatas } from "./data.functions";

export interface ComprasDoCliente {
  clienteId: string;
  /** Nome da ficha (vem no join da função do banco). */
  nome: string;
  primeiraCompra: string; // AAAA-MM-DD
  ultimaCompra: string;
  compras: number;
  total: number;
}

export interface VendaDoPeriodo {
  clienteId: string | null;
  status: string;
  total: number;
}

export interface NovasERecorrentes {
  /** Primeira compra dentro do período. */
  novas: { clientes: number; total: number };
  /** Já tinha comprado antes do período e comprou de novo nele. */
  voltaram: { clientes: number; total: number };
  /** Vendas sem ficha de cliente: ficam fora da conta, mas a tela conta quantas. */
  semFicha: { vendas: number; total: number };
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function novasERecorrentes(
  vendas: readonly VendaDoPeriodo[],
  compras: ReadonlyMap<string, ComprasDoCliente>,
  inicioDoPeriodo: string,
): NovasERecorrentes {
  const novas = new Set<string>();
  const voltaram = new Set<string>();
  const r: NovasERecorrentes = {
    novas: { clientes: 0, total: 0 },
    voltaram: { clientes: 0, total: 0 },
    semFicha: { vendas: 0, total: 0 },
  };
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    const c = v.clienteId ? compras.get(v.clienteId) : undefined;
    if (!v.clienteId || !c) {
      r.semFicha.vendas += 1;
      r.semFicha.total += v.total;
      continue;
    }
    if (c.primeiraCompra >= inicioDoPeriodo) {
      novas.add(v.clienteId);
      r.novas.total += v.total;
    } else {
      voltaram.add(v.clienteId);
      r.voltaram.total += v.total;
    }
  }
  r.novas.clientes = novas.size;
  r.voltaram.clientes = voltaram.size;
  r.novas.total = centavos(r.novas.total);
  r.voltaram.total = centavos(r.voltaram.total);
  r.semFicha.total = centavos(r.semFicha.total);
  return r;
}

export interface ClienteSumida {
  clienteId: string;
  nome: string;
  ultimaCompra: string;
  diasSemComprar: number;
  compras: number;
  total: number;
}

/**
 * Quem já comprou e não compra há `dias` ou mais (o corte é inclusivo).
 * Independe do período e do canal da página. Ordena por quanto já comprou:
 * quem mais comprou e sumiu vem primeiro.
 */
export function clientesSumidas(
  compras: readonly ComprasDoCliente[],
  hoje: string,
  dias: number,
): ClienteSumida[] {
  const lista: ClienteSumida[] = [];
  for (const c of compras) {
    const diasSemComprar = diasEntreDatas(c.ultimaCompra, hoje);
    if (diasSemComprar < dias) continue;
    lista.push({
      clienteId: c.clienteId,
      nome: c.nome,
      ultimaCompra: c.ultimaCompra,
      diasSemComprar,
      compras: c.compras,
      total: c.total,
    });
  }
  return lista.sort(
    (a, b) => b.total - a.total || b.compras - a.compras || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
