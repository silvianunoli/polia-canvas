import { createFileRoute, redirect } from "@tanstack/react-router";

// Qualquer coisa depois de /quiz cai na abertura do quiz, não no 404
// (PRD-quiz.md §2, "Alternativos"). O resultado é estado da página, então
// /quiz/resultado nunca existiu como rota, mas é o que a pessoa chuta ao
// tentar voltar pro diagnóstico pela URL.
//
// A página vive em quiz.index.tsx, NÃO em quiz.tsx, e isso é obrigatório:
// um splat casa também com o resto vazio, então com quiz.tsx o próprio
// /quiz caía aqui, entrava neste beforeLoad e redirecionava pra si mesmo.
// Loop de 307 em produção em 11/08/2026. Com a página como rota index, ela
// é quem casa com /quiz e o splat só pega o que vem depois. Mover a página
// de volta pra quiz.tsx derruba /quiz de novo.
export const Route = createFileRoute("/quiz/$")({
  beforeLoad: () => {
    throw redirect({ to: "/quiz", search: { origem: undefined } });
  },
});
