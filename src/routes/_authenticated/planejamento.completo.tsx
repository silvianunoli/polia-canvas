import { createFileRoute, redirect } from "@tanstack/react-router";

// O documento compilado virou parte do /planejamento (outputs inline, handoff
// 2026-07-03). Rota antiga redireciona pra lá.
export const Route = createFileRoute("/_authenticated/planejamento/completo")({
  beforeLoad: () => {
    throw redirect({ to: "/planejamento" });
  },
});
