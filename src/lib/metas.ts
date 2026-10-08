/**
 * Percentual de progresso de uma meta, sempre entre 0 e 100.
 *
 * QA-32 (08/10/2026): com valor atual negativo o percentual saía negativo, e o
 * `scaleX` negativo da barra espelhava o preenchimento pra fora do trilho. O
 * texto "R$ -50 de R$ 1.000" continua mostrando o número real; só a barra é
 * que não desenha abaixo de zero nem acima de cheio.
 */
export function progressoPct(m: { valor_atual: number | null; valor_alvo: number | null }): number {
  const alvo = m.valor_alvo ?? 0;
  if (!(alvo > 0)) return 0;
  const pct = Math.round(((m.valor_atual ?? 0) / alvo) * 100);
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}
