// Domínio do "Resumo do mês pro contador" (Projete). Puro — sem UI, sem
// Supabase. Recebe os lançamentos já carregados por quem chama (financeiro.tsx),
// pra nunca divergir do "quanto sobrou" que a própria tela mostra.

export const CATEGORIA_PRO_LABORE = "Pró-labore";

export interface LancamentoResumo {
  id: string;
  data: string; // "YYYY-MM-DD"
  // string (não union) pra aceitar direto o `Lancamento` de financeiro.tsx,
  // onde `tipo` vem da tabela como texto livre; só "entrada"/"saida" contam.
  tipo: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
}

export interface ResumoContadorMes {
  mes: number;
  ano: number;
  receitas: { total: number; itens: LancamentoResumo[] };
  // total inclui pró-labore (pra bater com "receitas - despesas" do Financeiro);
  // porCategoria e itens NÃO incluem pró-labore, que ganha sua própria seção.
  despesas: {
    total: number;
    porCategoria: { categoria: string; total: number }[];
    itens: LancamentoResumo[];
  };
  proLabore: { total: number; itens: LancamentoResumo[] };
  resultado: number;
}

export function pertenceAoMes(dataISO: string, mes: number, ano: number): boolean {
  const [y, m] = dataISO.split("-").map(Number);
  return y === ano && m === mes;
}

export function montarResumoContador(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): ResumoContadorMes {
  const doMes = lancamentos.filter((l) => pertenceAoMes(l.data, mes, ano));

  const receitasItens = doMes.filter((l) => l.tipo === "entrada");
  const receitasTotal = receitasItens.reduce((acc, l) => acc + Number(l.valor), 0);

  const saidas = doMes.filter((l) => l.tipo === "saida");
  const proLaboreItens = saidas.filter((l) => l.categoria === CATEGORIA_PRO_LABORE);
  const despesasItens = saidas.filter((l) => l.categoria !== CATEGORIA_PRO_LABORE);

  const proLaboreTotal = proLaboreItens.reduce((acc, l) => acc + Number(l.valor), 0);
  const despesasSemProLaboreTotal = despesasItens.reduce((acc, l) => acc + Number(l.valor), 0);
  const despesasTotal = despesasSemProLaboreTotal + proLaboreTotal;

  const porCategoriaMap = new Map<string, number>();
  for (const l of despesasItens) {
    const cat = l.categoria?.trim() || "Sem categoria";
    porCategoriaMap.set(cat, (porCategoriaMap.get(cat) ?? 0) + Number(l.valor));
  }
  const porCategoria = [...porCategoriaMap.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    mes,
    ano,
    receitas: { total: receitasTotal, itens: receitasItens },
    despesas: { total: despesasTotal, porCategoria, itens: despesasItens },
    proLabore: { total: proLaboreTotal, itens: proLaboreItens },
    resultado: receitasTotal - despesasTotal,
  };
}

const TIPO_LABEL: Record<LancamentoResumo["tipo"], string> = {
  entrada: "Receita",
  saida: "Despesa",
};

export function linhasCsvResumoContador(resumo: ResumoContadorMes): string[][] {
  const todos = [
    ...resumo.receitas.itens,
    ...resumo.despesas.itens,
    ...resumo.proLabore.itens,
  ].sort((a, b) => a.data.localeCompare(b.data));
  return todos.map((l) => [
    l.data,
    TIPO_LABEL[l.tipo],
    l.categoria ?? "",
    l.descricao ?? "",
    l.valor.toFixed(2).replace(".", ","),
  ]);
}
