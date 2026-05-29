// Util de pluralização para o kanban de Tarefas (Pólia).
// Mantém a voz Caveat ("sementes pra plantar · brotando · já floresceram"),
// concordando singular/plural conforme contagem.

export interface KanbanCounts {
  a_fazer: number;
  brotando: number;
  floresceu: number;
}

function p(n: number, sing: string, plur: string) {
  return `${n} ${n === 1 ? sing : plur}`;
}

export function pluralizeKanban(counts: KanbanCounts): string {
  const aFazer = p(counts.a_fazer, "semente pra plantar", "sementes pra plantar");
  const brotando =
    counts.brotando === 1 ? "1 brotando" : `${counts.brotando} brotando`;
  const floresceu = p(counts.floresceu, "já floresceu", "já floresceram");
  return `${aFazer} · ${brotando} · ${floresceu}`;
}
