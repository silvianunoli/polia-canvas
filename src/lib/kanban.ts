// Util de pluralização para o kanban de Tarefas (Pólia).
// Voz literal e clara — mundo cósmico é o único mundo metafórico da marca.
// Revertido de jardim (sementes/brotando/floresceram) em 2026-05-30.

export interface KanbanCounts {
  a_fazer: number;
  brotando: number;
  floresceu: number;
}

function fazer(n: number) {
  if (n === 0) return "nada pra fazer ainda";
  if (n === 1) return "1 tarefa pra fazer";
  return `${n} tarefas pra fazer`;
}
function brotar(n: number) {
  if (n === 0) return "nada em progresso";
  if (n === 1) return "1 em progresso";
  return `${n} em progresso`;
}
function florescer(n: number) {
  if (n === 0) return "nada pronto ainda";
  if (n === 1) return "1 pronta";
  return `${n} prontas`;
}

export function pluralizeKanban(counts: KanbanCounts): string {
  return `${fazer(counts.a_fazer)} · ${brotar(counts.brotando)} · ${florescer(counts.floresceu)}`;
}
