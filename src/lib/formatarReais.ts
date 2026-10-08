/**
 * Formatador único de dinheiro das telas logadas (08/10/2026).
 *
 * Existe porque cada tela tinha o seu: o Painel arredondava pra inteiro
 * (R$ 44,10 virava "R$ 44" e -0,40 virava "R$ -0"), o Financeiro passava
 * `Math.round` antes de formatar, Metas e Clientes mostravam "R$ 44,1".
 * A regra agora é uma só:
 *  - valor redondo sai sem centavos ("R$ 3.000"), pra caber nos cartões grandes;
 *  - com centavos, sempre duas casas ("R$ 44,10");
 *  - negativo leva o sinal antes do símbolo ("-R$ 0,40");
 *  - o que arredonda pra zero sai "R$ 0", nunca "R$ -0".
 *
 * Sem `style: "currency"` de propósito: ele insere um espaço não separável
 * depois do "R$", e o resto do produto usa espaço comum.
 */
export function formatarReais(valor: number): string {
  if (!Number.isFinite(valor)) return "R$ 0";
  const centavos = Math.round(valor * 100);
  if (centavos === 0) return "R$ 0";
  const casas = centavos % 100 === 0 ? 0 : 2;
  const corpo = (Math.abs(centavos) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${centavos < 0 ? "-" : ""}R$ ${corpo}`;
}

/**
 * Percentual inteiro de `parte` sobre `total`, com sinal. Mesma regra no Painel
 * e no Financeiro: um mês que gastou mais do que entrou mostra o negativo
 * (antes o Painel prendia em 0% e o Financeiro mostrava -50% pro mesmo mês).
 * Sem total positivo não há percentual: devolve 0.
 */
export function percentualDe(parte: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(parte)) return 0;
  const pct = Math.round((parte / total) * 100);
  return pct === 0 ? 0 : pct;
}
