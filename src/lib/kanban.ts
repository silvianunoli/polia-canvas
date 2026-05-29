// Util de pluralização para o kanban de Tarefas (Pólia).
// Mantém a voz Caveat ("sementes pra plantar · brotando · já floresceram"),
// com tratamento de zero para empty state acolhedor.

export interface KanbanCounts {
  a_fazer: number;
  brotando: number;
  floresceu: number;
}

function fazer(n: number) {
  if (n === 0) return "nada pra plantar ainda";
  if (n === 1) return "1 semente pra plantar";
  return `${n} sementes pra plantar`;
}
function brotar(n: number) {
  if (n === 0) return "nada brotando ainda";
  return `${n} brotando`;
}
function florescer(n: number) {
  if (n === 0) return "nada floresceu ainda";
  if (n === 1) return "1 já floresceu";
  return `${n} já floresceram`;
}

export function pluralizeKanban(counts: KanbanCounts): string {
  return `${fazer(counts.a_fazer)} · ${brotar(counts.brotando)} · ${florescer(counts.floresceu)}`;
}
