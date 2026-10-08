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

// % do preço de venda que sobra, presa em 0 de propósito: serve pra largura de
// barra (não existe barra negativa). Pra TEXTO, use sobraDoProduto, que mostra
// o prejuízo em vez de esconder atrás de "0%".
export function calcularSobraPct(input: QuantoSobraInput): number {
  if (input.precoVenda <= 0) return 0;
  return Math.max(0, Math.round((calcularQuantoSobra(input) / input.precoVenda) * 100));
}

export interface SobraDoProduto {
  /** R$ que sobra por venda; negativo = cada venda fica abaixo do custo. */
  valor: number;
  /** % do preço que sobra, COM sinal (pode ser negativa). */
  pct: number;
  /** % presa entre 0 e 100, só pra largura de barra. */
  pctBarra: number;
  prejuizo: boolean;
}

// Sobra de um produto do catálogo. Devolve null quando a conta não existe:
// sem preço de venda (produto criado pelo Planejamento com "preço a definir")
// ou sem custo cadastrado. Antes, custo vazio virava custo 0 e a venda rápida
// do Financeiro anunciava "sobram R$ 49" de um produto sem custo conhecido.
export function sobraDoProduto(params: {
  precoVenda: number;
  precoCusto: number | null;
  breakdown: CalculadoraBreakdown | null | undefined;
}): SobraDoProduto | null {
  const { precoVenda, precoCusto } = params;
  if (!(precoVenda > 0) || precoCusto == null) return null;
  const input: QuantoSobraInput = {
    precoVenda,
    precoCusto,
    ...taxasDoBreakdown(params.breakdown),
  };
  const valor = calcularQuantoSobra(input);
  const pct = Math.round((valor / precoVenda) * 100);
  return {
    valor,
    pct,
    pctBarra: Math.min(100, Math.max(0, pct)),
    prejuizo: Math.round(valor * 100) < 0,
  };
}

// Simulador de desconto da calculadora. Taxa e imposto são % do preço, então
// caem junto com ele. O preço com desconto nunca fica negativo, e a sobra NÃO
// passa por calcularQuantoSobra: aquela devolve 0 quando o preço é 0, e com
// 100% de desconto o custo continua saindo do bolso (bug do QA-26: 100% ou
// mais mostrava "sobram R$ 0,00" sem o aviso de prejuízo).
// null = sem simulação (campo vazio, zero ou negativo).
export function simularDesconto(params: {
  precoVenda: number;
  precoCusto: number;
  taxaVendaPct?: number;
  impostosPct?: number;
  descontoPct: number;
}): { precoComDesconto: number; sobra: number; prejuizo: boolean } | null {
  const { descontoPct } = params;
  if (!Number.isFinite(descontoPct) || descontoPct <= 0) return null;
  const precoComDesconto = Math.max(0, params.precoVenda * (1 - descontoPct / 100));
  const taxas = calcularTaxas({
    precoVenda: precoComDesconto,
    precoCusto: params.precoCusto,
    taxaVendaPct: params.taxaVendaPct,
    impostosPct: params.impostosPct,
  });
  const sobra = precoComDesconto - params.precoCusto - taxas;
  return { precoComDesconto, sobra, prejuizo: Math.round(sobra * 100) < 0 };
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

// Custo DIRETO de uma unidade, sem o rateio dos custos fixos. O perfil
// "produto" da calculadora salva em preco_custo o custo direto + o rateio
// (fixos do mês / quantas vende). Pra quem já soma os custos fixos à parte
// (a Projeção), usar o preco_custo contava o fixo duas vezes (ONE-95,
// 08/10/2026): caderno a R$ 30,43 com R$ 300 de fixos dava 50 vendas pra
// empatar em vez de 25. Só desconta o rateio quando o preco_custo ainda é o
// que a calculadora salvou; custo editado à mão depois fica como está.
export function custoDiretoDoProduto(
  precoCusto: number | null,
  bk: CalculadoraBreakdown | null | undefined,
): number {
  const custo = precoCusto ?? 0;
  if (!bk || bk.perfil !== "produto") return custo;
  const n = (s?: string) => (s ? parseFloat(s.replace(",", ".")) || 0 : 0);
  const v = bk.valores;
  const direto = n(v.materiaPrima) + n(v.embalagem) + n(v.maoObra) + n(v.outrosDiretos);
  const rateio = n(v.despesasFixas) / Math.max(n(v.qtd), 1);
  if (rateio <= 0) return custo;
  const salvoPelaCalculadora = Math.abs(custo - (direto + rateio)) < 0.01;
  return salvoPelaCalculadora ? direto : custo;
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
