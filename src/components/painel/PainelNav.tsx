// PainelNav — NEUTRALIZADO na migração pra Sidebar (Fase 1 do redesign 2.0).
//
// A navegação agora vive em `components/layout/Sidebar.tsx`, montada uma vez no
// layout `_authenticated`. Este componente virou no-op pra não duplicar o nav
// nas ~31 telas que ainda o chamam (<PainelNav .../>). Mantém a assinatura pra
// não quebrar essas telas; será removido quando elas forem limpas numa próxima fase.
export function PainelNav(_props?: { initial?: string; streak?: number; navActive?: string }) {
  return null;
}
