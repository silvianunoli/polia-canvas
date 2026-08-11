import { createFileRoute, redirect } from "@tanstack/react-router";

// Qualquer coisa depois de /quiz cai na abertura do quiz, não no 404
// (PRD-quiz.md §2, "Alternativos"). O resultado é estado da página, então
// /quiz/resultado nunca existiu como rota, mas é o que a pessoa chuta ao
// tentar voltar pro diagnóstico pela URL.
export const Route = createFileRoute("/quiz/$")({
  beforeLoad: () => {
    throw redirect({ to: "/quiz", search: { origem: undefined } });
  },
});
