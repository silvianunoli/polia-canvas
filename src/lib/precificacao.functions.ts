// "Quanto sobra" de uma venda: fonte única usada pela calculadora de preço,
// pelo card de Produtos e pelo passo de dinheiro do onboarding. Antes cada
// tela tinha sua própria conta inline e divergiam entre si (o card ignorava
// taxa/imposto e mostrava número maior que a calculadora, na mesma sessão).
//
// Fórmula "por dentro": taxa, imposto e lucro são % do PREÇO final, não do
// custo — então o preço sugerido = custo / (1 − soma_dos_percentuais/100).

export interface QuantoSobraInput {
  precoVenda: number;
  precoCusto: number;
  taxaVendaPct?: number;
  impostosPct?: number;
}

export function calcularTaxas({
  precoVenda,
  taxaVendaPct = 0,
  impostosPct = 0,
}: QuantoSobraInput): number {
  if (precoVenda <= 0) return 0;
  return precoVenda * ((taxaVendaPct + impostosPct) / 100);
}

// O que sobra de uma venda depois do custo direto e das taxas/impostos sobre o preço.
export function calcularQuantoSobra(input: QuantoSobraInput): number {
  if (input.precoVenda <= 0) return 0;
  return input.precoVenda - input.precoCusto - calcularTaxas(input);
}

// % do preço de venda que sobra — pro card de produto e pra barra de margem.
export function calcularSobraPct(input: QuantoSobraInput): number {
  if (input.precoVenda <= 0) return 0;
  return Math.max(0, Math.round((calcularQuantoSobra(input) / input.precoVenda) * 100));
}

// Preço sugerido a partir do custo unitário e dos percentuais desejados
// (taxa + imposto + margem de lucro), todos como % do preço final.
export function calcularPrecoSugerido(custoUnitario: number, pctTotal: number): number {
  if (pctTotal >= 100) return custoUnitario;
  return custoUnitario / (1 - pctTotal / 100);
}

// Composição que a calculadora de preço salva junto ao produto (produtos.tsx),
// reaproveitada por qualquer tela que precise saber a taxa/imposto usados.
export interface CalculadoraBreakdown {
  perfil: "produto" | "servico" | "encomenda";
  valores: Record<string, string>;
}

export function taxasDoBreakdown(bk: CalculadoraBreakdown | null | undefined): {
  taxaVendaPct: number;
  impostosPct: number;
} {
  if (!bk) return { taxaVendaPct: 0, impostosPct: 0 };
  const n = (s?: string) => (s ? parseFloat(s.replace(",", ".")) || 0 : 0);
  if (bk.perfil === "produto") {
    return { taxaVendaPct: n(bk.valores.taxaVenda), impostosPct: n(bk.valores.impostos) };
  }
  if (bk.perfil === "encomenda") {
    return { taxaVendaPct: n(bk.valores.taxaVendaE), impostosPct: n(bk.valores.impostosE) };
  }
  return { taxaVendaPct: n(bk.valores.taxaVendaS), impostosPct: n(bk.valores.impostosS) };
}

// ── Modo Encomenda (Projete): material por item + trabalho por hora + custos
// extras, na mesma fórmula "por dentro" acima — sem conta paralela. O piso é
// o mesmo cálculo do preço sugerido, só que sem a margem (quantoSobraPct).
export interface EncomendaInput {
  itensMaterial: { quantidade: number; custoUnitario: number }[];
  horas: number;
  valorHora: number;
  itensExtras: { valor: number }[];
  taxaVendaPct: number;
  impostosPct: number;
  quantoSobraPct: number;
}

export interface EncomendaResultado {
  custoMaterial: number;
  custoTrabalho: number;
  custoExtras: number;
  custoTotal: number;
  piso: number;
  precoSugerido: number;
  taxasReais: number;
  lucroReais: number;
  sobraPct: number;
  invalido: boolean;
}

export function calcularEncomenda(input: EncomendaInput): EncomendaResultado {
  const custoMaterial = input.itensMaterial.reduce(
    (acc, it) => acc + it.quantidade * it.custoUnitario,
    0,
  );
  const custoTrabalho = input.horas * input.valorHora;
  const custoExtras = input.itensExtras.reduce((acc, it) => acc + it.valor, 0);
  const custoTotal = custoMaterial + custoTrabalho + custoExtras;

  const pctVenda = input.taxaVendaPct + input.impostosPct;
  const pctTotal = pctVenda + input.quantoSobraPct;
  const invalido = pctTotal >= 100;

  const piso = calcularPrecoSugerido(custoTotal, pctVenda);
  const precoSugerido = calcularPrecoSugerido(custoTotal, pctTotal);

  const sobraInput: QuantoSobraInput = {
    precoVenda: precoSugerido,
    precoCusto: custoTotal,
    taxaVendaPct: input.taxaVendaPct,
    impostosPct: input.impostosPct,
  };
  const taxasReais = calcularTaxas(sobraInput);
  const lucroReais = calcularQuantoSobra(sobraInput);
  const sobraPct = calcularSobraPct(sobraInput);

  return {
    custoMaterial,
    custoTrabalho,
    custoExtras,
    custoTotal,
    piso,
    precoSugerido,
    taxasReais,
    lucroReais,
    sobraPct,
    invalido,
  };
}
