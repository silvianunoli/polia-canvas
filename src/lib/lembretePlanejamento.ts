// Lembrete diário do Planejamento (05/10/2026, pedido da Sil): no primeiro
// acesso do dia, quem ainda não fechou os 6 módulos vê em qual parou.

import { TOTAL_MODULOS, moduloInfo, secoesDoModulo } from "@/lib/planejamento";

export interface ProgressoPlanejamento {
  modulo: number;
  nome: string;
  feitas: number;
  total: number;
}

/** Primeiro módulo com seção aberta, ou null quando os 6 estão concluídos. */
export function progressoPlanejamento(
  concluidas: ReadonlySet<string>,
): ProgressoPlanejamento | null {
  for (let n = 1; n <= TOTAL_MODULOS; n++) {
    const secoes = secoesDoModulo(n);
    const feitas = secoes.filter((s) => concluidas.has(s.id)).length;
    if (feitas < secoes.length) {
      return { modulo: n, nome: moduloInfo(n).nome, feitas, total: secoes.length };
    }
  }
  return null;
}

/** Data local AAAA-MM-DD (o "dia" da usuária, não o UTC do servidor). */
export function dataLocal(d: Date): string {
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lembra uma vez por dia: só quando o último lembrete não foi hoje. */
export function deveLembrarHoje(ultimoLembrete: string | null, hoje: string): boolean {
  return ultimoLembrete !== hoje;
}
